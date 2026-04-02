interface MessageKeyData {
	aesKey: Uint8Array;
	aesIv: Uint8Array;
}

export interface DecryptedPushResult<T = Record<string, unknown>> {
	jsonString: string;
	payload: T;
}

const AES_BLOCK_SIZE = 16;
const IGE_IV_SIZE = 32;
const ZERO_IV_16 = new Uint8Array(AES_BLOCK_SIZE);
const PKCS7_FULL_BLOCK = new Uint8Array(AES_BLOCK_SIZE).fill(AES_BLOCK_SIZE);

let subtleCryptoPromise: Promise<SubtleCrypto> | null = null;

function concatBytes(...parts: Uint8Array[]): Uint8Array {
	let total = 0;
	for (let i = 0; i < parts.length; i++) total += parts[i].length;

	const result = new Uint8Array(total);
	let offset = 0;

	for (let i = 0; i < parts.length; i++) {
		result.set(parts[i], offset);
		offset += parts[i].length;
	}

	return result;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function xorBlock(a: Uint8Array, b: Uint8Array): Uint8Array {
	const out = new Uint8Array(AES_BLOCK_SIZE);
	for (let i = 0; i < AES_BLOCK_SIZE; i++) {
		out[i] = a[i] ^ b[i];
	}
	return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.length);
	copy.set(bytes);
	return copy.buffer as ArrayBuffer;
}

function getSubtleCrypto(): Promise<SubtleCrypto> {
	if (!subtleCryptoPromise) {
		subtleCryptoPromise = Promise.resolve().then(() => {
			const c = crypto;
			if (!c?.subtle) {
				throw new Error("WebCrypto subtle API is not available");
			}
			return c.subtle;
		});
	}

	return subtleCryptoPromise;
}

export function decodeBase64Url(input: string): Uint8Array {
	const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
	const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
	const base64 = normalized + padding;
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
}

export function encodeBase64Url(input: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < input.length; i++) {
		binary += String.fromCharCode(input[i]);
	}

	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha1(bytes: Uint8Array): Promise<Uint8Array> {
	const subtle = await getSubtleCrypto();
	const hash = await subtle.digest("SHA-1", toArrayBuffer(bytes));
	return new Uint8Array(hash);
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
	const subtle = await getSubtleCrypto();
	const hash = await subtle.digest("SHA-256", toArrayBuffer(bytes));
	return new Uint8Array(hash);
}

async function importAesKey(key: Uint8Array): Promise<CryptoKey> {
	const subtle = await getSubtleCrypto();
	return subtle.importKey("raw", toArrayBuffer(key), { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
}

async function aesEcbDecryptBlock(key: CryptoKey, block: Uint8Array): Promise<Uint8Array> {
	if (block.length !== AES_BLOCK_SIZE) {
		throw new Error("AES-ECB block size must be 16 bytes");
	}

	const subtle = await getSubtleCrypto();

	// WebCrypto AES-CBC decrypt enforces PKCS#7 padding and throws OperationError for arbitrary blocks.
	// To obtain deterministic ECB decrypt for one block y, decrypt [y, c2] where c2 is crafted so
	// the second plaintext block is valid full-block padding (0x10 repeated).
	const xoredPadding = xorBlock(PKCS7_FULL_BLOCK, block);
	const encryptedXoredPadding = await subtle.encrypt(
		{ name: "AES-CBC", iv: toArrayBuffer(ZERO_IV_16) },
		key,
		toArrayBuffer(xoredPadding),
	);
	const c2 = new Uint8Array(encryptedXoredPadding).subarray(0, AES_BLOCK_SIZE);

	const composedCiphertext = new Uint8Array(AES_BLOCK_SIZE * 2);
	composedCiphertext.set(block, 0);
	composedCiphertext.set(c2, AES_BLOCK_SIZE);

	const out = await subtle.decrypt(
		{ name: "AES-CBC", iv: toArrayBuffer(ZERO_IV_16) },
		key,
		toArrayBuffer(composedCiphertext),
	);
	const plain = new Uint8Array(out);

	if (plain.length !== AES_BLOCK_SIZE) {
		throw new Error("Unexpected AES-CBC output size while emulating ECB decrypt");
	}

	return plain;
}

async function computePushAuthKeyId(pushAuthKey: Uint8Array): Promise<Uint8Array> {
	const hash = await sha1(pushAuthKey);
	return hash.subarray(hash.length - 8);
}

async function generateMessageKeyData(
	pushAuthKey: Uint8Array,
	messageKey: Uint8Array,
	x: 0 | 8,
): Promise<MessageKeyData> {
	const sha256a = await sha256(concatBytes(messageKey, pushAuthKey.subarray(x, x + 36)));
	const sha256b = await sha256(concatBytes(pushAuthKey.subarray(x + 40, x + 76), messageKey));

	const aesKey = concatBytes(sha256a.subarray(0, 8), sha256b.subarray(8, 24), sha256a.subarray(24, 32));
	const aesIv = concatBytes(sha256b.subarray(0, 8), sha256a.subarray(8, 24), sha256b.subarray(24, 32));

	return { aesKey, aesIv };
}

function readInt32LE(bytes: Uint8Array, offset: number): number {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return view.getInt32(offset, true);
}

async function aesIgeDecrypt(data: Uint8Array, keyBytes: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
	if (data.length % AES_BLOCK_SIZE !== 0) {
		throw new Error("AES-IGE data length must be multiple of 16 bytes");
	}

	if (iv.length !== IGE_IV_SIZE) {
		throw new Error("AES-IGE IV length must be 32 bytes");
	}

	const key = await importAesKey(keyBytes);
	const out = new Uint8Array(data.length);

	let ivX = iv.subarray(0, AES_BLOCK_SIZE);
	let ivY = iv.subarray(AES_BLOCK_SIZE, IGE_IV_SIZE);

	for (let offset = 0; offset < data.length; offset += AES_BLOCK_SIZE) {
		const y = data.subarray(offset, offset + AES_BLOCK_SIZE);
		const decrypted = await aesEcbDecryptBlock(key, xorBlock(y, ivX));
		const x = xorBlock(decrypted, ivY);

		out.set(x, offset);

		ivX = x;
		ivY = y;
	}

	return out;
}

export async function decryptTelegramPushPayload<T = Record<string, unknown>>(
	encryptedPayloadBase64Url: string,
	pushAuthKey: Uint8Array,
): Promise<DecryptedPushResult<T>> {
	const input = decodeBase64Url(encryptedPayloadBase64Url);

	if (input.length < 24) {
		throw new Error("Encrypted push payload is too short");
	}

	const inAuthKeyId = input.subarray(0, 8);
	const expectedAuthKeyId = await computePushAuthKeyId(pushAuthKey);

	if (!arraysEqual(inAuthKeyId, expectedAuthKeyId)) {
		throw new Error("push auth key id mismatch");
	}

	const messageKey = input.subarray(8, 24);
	const encrypted = input.subarray(24);
	let decrypted: Uint8Array | null = null;

	const variants: Array<{ x: 0 | 8; swapIv: boolean }> = [
		{ x: 8, swapIv: false },
		{ x: 0, swapIv: false },
		{ x: 8, swapIv: true },
		{ x: 0, swapIv: true },
	];

	for (let i = 0; i < variants.length; i++) {
		const variant = variants[i];
		const { aesKey, aesIv } = await generateMessageKeyData(pushAuthKey, messageKey, variant.x);
		const iv = variant.swapIv ? concatBytes(aesIv.subarray(AES_BLOCK_SIZE), aesIv.subarray(0, AES_BLOCK_SIZE)) : aesIv;

		const candidate = await aesIgeDecrypt(encrypted, aesKey, iv);
		const messageKeyFull = await sha256(concatBytes(pushAuthKey.subarray(96, 128), candidate));
		const messageKeySlice = messageKeyFull.subarray(8, 24);

		if (arraysEqual(messageKey, messageKeySlice)) {
			decrypted = candidate;
			break;
		}
	}

	if (!decrypted) {
		throw new Error("message key verification failed");
	}

	const jsonLength = readInt32LE(decrypted, 0);
	if (jsonLength < 0 || jsonLength > decrypted.length - 4) {
		throw new Error("Invalid JSON length in decrypted payload");
	}

	const jsonBytes = decrypted.subarray(4, 4 + jsonLength);
	const jsonString = new TextDecoder().decode(jsonBytes);
	const payload = JSON.parse(jsonString) as T;

	return {
		jsonString,
		payload,
	};
}
