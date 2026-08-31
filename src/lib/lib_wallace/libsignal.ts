/**
 * libsignal module for the Wallace library.
 *
 * Provides access to the daemon's Signal / libsignal service
 * (http_root/api/v1/libsignal/service.js, UMD global `lib_libsignal`).
 *
 * This module is fully self-contained for tree-shaking: importing it pulls
 * in the generic session + service helpers, but never settings (or any other
 * service) code.
 *
 * The daemon exposes a `Signal` manager obtained via
 * `lib_libsignal.Signal.get(session)`. From it you can create a
 * `GlobalContext` (key generation, pre-keys, sender keys) and then build
 * session/group ciphers, session builders, HMAC/SHA-512 digests, etc.
 *
 * The store objects (sessionStore, preKeyStore, signedPreKeyStore,
 * identityKeyStore, senderKeyStore) are tracked daemon objects. You create
 * them by subclassing the `*StoreBase` classes exported here and passing the
 * instance to `trackStore()`, or by implementing the callback methods on a
 * plain object and wrapping it with `trackStore()`.
 */
import { ensureService } from "./service";
import { DAEMON_ORIGIN } from "./session";

// ---------------------------------------------------------------------------
// Types (mirror the daemon's libsignal data model)
// ---------------------------------------------------------------------------

/** The daemon WebSocket session (lib_session.Session). */
export interface Session {
  next_id: number;
  track(obj: unknown): void;
  untrack(id: number): void;
}

/** A Curve25519 key pair (raw bytes). */
export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/** A pre-key record. */
export interface PreKey {
  id: number;
  keyPair: KeyPair;
}

/** A signed pre-key record. */
export interface SignedPreKey {
  id: number;
  keyPair: KeyPair;
  timestamp: number;
  signature: Uint8Array;
}

/** A Signal protocol address (name + device id). */
export interface SignalAddress {
  name: string;
  deviceId: number;
}

/** A sender key name (group id + sender address). */
export interface SenderKeyName {
  groupId: string;
  sender: SignalAddress;
}

/** A pre-key bundle used to establish a session. */
export interface PreKeyBundle {
  registrationId: number;
  deviceId: number;
  preKeyId: number;
  preKeyPublic: Uint8Array;
  signedPreKeyId: number;
  signedPreKeyPublic: Uint8Array;
  signedPreKeySignature: Uint8Array;
  identityKey: Uint8Array;
}

/** A distribution message for group sessions. */
export interface DistributionMessage {
  serialized: Uint8Array;
}

/** The result of encrypting a message with a SessionCipher. */
export interface CiphertextMessage {
  messageType: number;
  serialized: Uint8Array;
}

/** The result of downloadAndDecrypt. */
export interface DownloadAndDecryptResult {
  tail: Uint8Array;
  plainTextHash: Uint8Array;
  hmac: Uint8Array;
}

/** A decryption callback invoked by the daemon with the plaintext. */
export type DecryptionCallback = (plaintext: Uint8Array) => Promise<void>;

/** The identity key store (implemented by the app). */
export interface IdentityKeyStore {
  id: number;
  getKeyPair(): Promise<KeyPair>;
  getLocalRegistrationId(): Promise<number>;
  isTrustedIdentity(
    address: SignalAddress,
    keyData: Uint8Array,
  ): Promise<boolean>;
  saveIdentity(address: SignalAddress, keyData: Uint8Array): Promise<void>;
}

/** The (signed) pre-key store (implemented by the app). */
export interface PreKeyStore {
  id: number;
  contains(preKeyId: number): Promise<boolean>;
  load(preKeyId: number): Promise<Uint8Array | undefined>;
  remove(preKeyId: number): Promise<void>;
}

/** The sender key store (implemented by the app). */
export interface SenderKeyStore {
  id: number;
  load(senderKeyName: SenderKeyName): Promise<Uint8Array | undefined>;
  store(senderKeyName: SenderKeyName, record: Uint8Array): Promise<boolean>;
}

/** The session store (implemented by the app). */
export interface SessionStore {
  id: number;
  contains(address: SignalAddress): Promise<boolean>;
  delete(address: SignalAddress): Promise<boolean>;
  deleteAllSessions(name: string): Promise<number>;
  getSubDeviceSessions(name: string): Promise<number[]>;
  load(address: SignalAddress): Promise<Uint8Array | undefined>;
  store(address: SignalAddress, record: Uint8Array): Promise<void>;
}

/** A decryption callback object (from DecryptionCallbackBase). */
export interface DecryptionCallbackObject {
  id: number;
  callback(plaintext: Uint8Array): Promise<void>;
}

/** The store context passed to ciphers/builders. */
export interface StoreContext {
  sessionStore: SessionStore;
  preKeyStore: PreKeyStore;
  signedPreKeyStore: PreKeyStore;
  identityKeyStore: IdentityKeyStore;
  senderKeyStore: SenderKeyStore;
}

/** A group cipher (from GlobalContext.groupCipher). */
export interface GroupCipher {
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
  encrypt(paddedPlaintext: Uint8Array): Promise<Uint8Array>;
}

/** A group session builder (from GlobalContext.groupSessionBuilder). */
export interface GroupSessionBuilder {
  createSession(senderKeyName: SenderKeyName): Promise<DistributionMessage>;
  processSession(
    senderKeyName: SenderKeyName,
    distributionMessage: DistributionMessage,
  ): Promise<void>;
}

/** A session builder (from GlobalContext.sessionBuilder). */
export interface SessionBuilder {
  processPreKeyBundle(bundle: PreKeyBundle): Promise<void>;
}

/** A session cipher (from GlobalContext.sessionCipher). */
export interface SessionCipher {
  decryptMessage(ciphertext: Uint8Array): Promise<Uint8Array>;
  decryptPreKeyMessage(ciphertext: Uint8Array): Promise<Uint8Array>;
  encrypt(paddedMessage: Uint8Array): Promise<CiphertextMessage>;
  remoteRegistrationId(): Promise<number>;
}

/** An incremental digest (HmacSha256 or Sha512Digest). */
export interface Digest {
  update(data: Uint8Array): Promise<void>;
  finalize(): Promise<Uint8Array>;
}

/** The Signal manager (from lib_libsignal.Signal.get). */
export interface SignalManager {
  service_id: number;
  curveCalculateAgreement(
    publicKey: Uint8Array,
    privateKey: Uint8Array,
  ): Promise<Uint8Array>;
  curveVerifySignature(
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array,
  ): Promise<boolean>;
  downloadAndDecrypt(
    url: string,
    iv: Uint8Array,
    cipherKey: Uint8Array,
    hmacKey: Uint8Array,
    numCiphertextBytes: number,
    numTailBytes: number,
    callback?: DecryptionCallback,
  ): Promise<DownloadAndDecryptResult>;
  newGlobalContext(): Promise<GlobalContext>;
  startHmacSha256(key: Uint8Array): Promise<Digest>;
  startSha512Digest(): Promise<Digest>;
}

/** The GlobalContext - entry point for key generation and ciphers. */
export interface GlobalContext {
  generateIdentityKeyPair(): Promise<KeyPair>;
  generatePreKeys(start: number, count: number): Promise<PreKey[]>;
  generateRegistrationId(extendedRange: boolean): Promise<number>;
  generateSenderKey(): Promise<Uint8Array>;
  generateSenderKeyId(): Promise<number>;
  generateSenderSigningKey(): Promise<KeyPair>;
  generateSignedPreKey(
    identityKeyPair: KeyPair,
    signedPreKeyId: number,
    timestamp: number,
  ): Promise<SignedPreKey>;
  groupCipher(
    storeContext: StoreContext,
    senderKeyName: SenderKeyName,
    callback?: DecryptionCallback,
  ): Promise<GroupCipher>;
  groupSessionBuilder(storeContext: StoreContext): Promise<GroupSessionBuilder>;
  sessionBuilder(
    address: SignalAddress,
    storeContext: StoreContext,
  ): Promise<SessionBuilder>;
  sessionCipher(
    address: SignalAddress,
    storeContext: StoreContext,
    callback?: DecryptionCallback,
  ): Promise<SessionCipher>;
}

/** A constructor for a tracked store/callback object. */
export interface StoreBaseConstructor<T> {
  new (serviceId: number, session: Session): T;
}

/** The UMD global `lib_libsignal` defined by the daemon's service.js. */
interface LibSignalGlobal {
  Signal: {
    get(session: Session): Promise<SignalManager>;
  };
  IdentityKeyStoreBase: StoreBaseConstructor<IdentityKeyStore>;
  KeyStoreBase: StoreBaseConstructor<PreKeyStore>;
  SenderKeyStoreBase: StoreBaseConstructor<SenderKeyStore>;
  SessionStoreBase: StoreBaseConstructor<SessionStore>;
  DecryptionCallbackBase: StoreBaseConstructor<DecryptionCallbackObject>;
}

/**
 * Typed access to the daemon's `lib_libsignal` global. This is the single
 * place that touches the untyped global scope; everything else in this module
 * is fully typed.
 */
function libsignalGlobal(): LibSignalGlobal {
  return (window as any).lib_libsignal;
}

// ---------------------------------------------------------------------------
// Service initialization (libsignal-specific)
// ---------------------------------------------------------------------------

// Module-scoped handles (kept off `window` so no global augmentation is needed).
let signalSession: Session | null = null;
let signalManagerInstance: SignalManager | null = null;

/** Ensure the libsignal service is ready and return its Signal manager. */
function ensureSignal(): Promise<SignalManager> {
  return ensureService(
    "libsignal",
    `${DAEMON_ORIGIN}/libsignal/service.js`,
    (session) => {
      signalSession = session;
      return libsignalGlobal().Signal.get(session);
    },
  ).then((manager) => {
    signalManagerInstance = manager;
    return manager;
  });
}

/** The Signal manager handle (from lib_libsignal.Signal.get). */
function signalManager(): SignalManager {
  if (!signalManagerInstance) {
    throw new Error("libsignal service not ready; call ready() first");
  }
  return signalManagerInstance;
}

// ---------------------------------------------------------------------------
// Store / callback helpers
// ---------------------------------------------------------------------------

/**
 * Create a tracked daemon store object from a class that extends one of the
 * `*StoreBase` classes (IdentityKeyStoreBase, KeyStoreBase, SenderKeyStoreBase,
 * SessionStoreBase) or DecryptionCallbackBase.
 *
 * The daemon's store constructors already call `session.track(this)`, so the
 * returned object is tracked and has an `.id` you pass inside a StoreContext.
 *
 * @param ctor - the store/callback class (e.g. `libsignal.IdentityKeyStoreBase`)
 * @param impl  - an object implementing the class's callback methods
 */
export function trackStore<T extends { id: number }>(
  ctor: StoreBaseConstructor<T>,
  impl: Omit<T, "id">,
): T {
  if (!signalSession) {
    throw new Error("libsignal service not ready; call ready() first");
  }
  const serviceId = signalManager().service_id;
  const obj = new ctor(serviceId, signalSession);
  Object.assign(obj, impl);
  return obj;
}

/**
 * Convenience: build a StoreContext from the five store objects.
 * @param stores - { sessionStore, preKeyStore, signedPreKeyStore, identityKeyStore, senderKeyStore }
 */
export function storeContext(stores: StoreContext): StoreContext {
  return stores;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ensure the libsignal service is ready.
 */
export async function ready(): Promise<void> {
  await ensureSignal();
}

/**
 * Compute a Curve25519 shared secret (agreement) between a public and a
 * private key.
 * @param publicKey - the remote public key
 * @param privateKey - our private key
 */
export async function curveCalculateAgreement(
  publicKey: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  await ensureSignal();
  return signalManager().curveCalculateAgreement(publicKey, privateKey);
}

/**
 * Verify a Curve25519 signature over a message.
 * @param publicKey - the signer's public key
 * @param message   - the signed message
 * @param signature - the signature to verify
 */
export async function curveVerifySignature(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  await ensureSignal();
  return signalManager().curveVerifySignature(publicKey, message, signature);
}

/**
 * Download a URL and decrypt it (Signal attachment download).
 * @param url               - the attachment URL
 * @param iv                - the AES IV
 * @param cipherKey         - the AES cipher key
 * @param hmacKey           - the HMAC key
 * @param numCiphertextBytes - number of ciphertext bytes
 * @param numTailBytes       - number of tail bytes
 * @param callback          - optional progress callback
 */
export async function downloadAndDecrypt(
  url: string,
  iv: Uint8Array,
  cipherKey: Uint8Array,
  hmacKey: Uint8Array,
  numCiphertextBytes: number,
  numTailBytes: number,
  callback?: (plaintext: Uint8Array) => Promise<void>,
): Promise<DownloadAndDecryptResult> {
  await ensureSignal();
  return signalManager().downloadAndDecrypt(
    url,
    iv,
    cipherKey,
    hmacKey,
    numCiphertextBytes,
    numTailBytes,
    callback,
  );
}

/**
 * Create a new GlobalContext - the entry point for all key generation and
 * cipher construction.
 */
export async function newGlobalContext(): Promise<GlobalContext> {
  await ensureSignal();
  return signalManager().newGlobalContext();
}

/**
 * Start an HMAC-SHA256 computation.
 * @param key - the HMAC key
 */
export async function startHmacSha256(key: Uint8Array): Promise<Digest> {
  await ensureSignal();
  return signalManager().startHmacSha256(key);
}

/**
 * Start a SHA-512 digest computation.
 */
export async function startSha512Digest(): Promise<Digest> {
  await ensureSignal();
  return signalManager().startSha512Digest();
}

// ---------------------------------------------------------------------------
// GlobalContext helpers
// ---------------------------------------------------------------------------

/**
 * Generate an identity key pair.
 * @param context - a GlobalContext from newGlobalContext()
 */
export async function generateIdentityKeyPair(
  context: GlobalContext,
): Promise<KeyPair> {
  return context.generateIdentityKeyPair();
}

/**
 * Generate a batch of pre-keys.
 * @param context - a GlobalContext
 * @param start   - the first pre-key id
 * @param count   - how many to generate
 */
export async function generatePreKeys(
  context: GlobalContext,
  start: number,
  count: number,
): Promise<PreKey[]> {
  return context.generatePreKeys(start, count);
}

/**
 * Generate a registration id.
 * @param context       - a GlobalContext
 * @param extendedRange - use the extended (larger) range
 */
export async function generateRegistrationId(
  context: GlobalContext,
  extendedRange: boolean,
): Promise<number> {
  return context.generateRegistrationId(extendedRange);
}

/**
 * Generate a sender key.
 * @param context - a GlobalContext
 */
export async function generateSenderKey(
  context: GlobalContext,
): Promise<Uint8Array> {
  return context.generateSenderKey();
}

/**
 * Generate a sender key id.
 * @param context - a GlobalContext
 */
export async function generateSenderKeyId(
  context: GlobalContext,
): Promise<number> {
  return context.generateSenderKeyId();
}

/**
 * Generate a sender signing key.
 * @param context - a GlobalContext
 */
export async function generateSenderSigningKey(
  context: GlobalContext,
): Promise<KeyPair> {
  return context.generateSenderSigningKey();
}

/**
 * Generate a signed pre-key.
 * @param context          - a GlobalContext
 * @param identityKeyPair  - the identity key pair
 * @param signedPreKeyId   - the signed pre-key id
 * @param timestamp        - the signing timestamp
 */
export async function generateSignedPreKey(
  context: GlobalContext,
  identityKeyPair: KeyPair,
  signedPreKeyId: number,
  timestamp: number,
): Promise<SignedPreKey> {
  return context.generateSignedPreKey(
    identityKeyPair,
    signedPreKeyId,
    timestamp,
  );
}

/**
 * Create a group cipher for a sender key name.
 * @param context       - a GlobalContext
 * @param storeContext  - the store context
 * @param senderKeyName - the sender key name
 * @param callback      - optional decryption callback
 */
export async function groupCipher(
  context: GlobalContext,
  storeContext: StoreContext,
  senderKeyName: SenderKeyName,
  callback?: DecryptionCallback,
): Promise<GroupCipher> {
  return context.groupCipher(storeContext, senderKeyName, callback);
}

/**
 * Create a group session builder.
 * @param context      - a GlobalContext
 * @param storeContext - the store context
 */
export async function groupSessionBuilder(
  context: GlobalContext,
  storeContext: StoreContext,
): Promise<GroupSessionBuilder> {
  return context.groupSessionBuilder(storeContext);
}

/**
 * Create a session builder for an address.
 * @param context      - a GlobalContext
 * @param address      - the remote address
 * @param storeContext - the store context
 */
export async function sessionBuilder(
  context: GlobalContext,
  address: SignalAddress,
  storeContext: StoreContext,
): Promise<SessionBuilder> {
  return context.sessionBuilder(address, storeContext);
}

/**
 * Create a session cipher for an address.
 * @param context      - a GlobalContext
 * @param address      - the remote address
 * @param storeContext - the store context
 * @param callback     - optional decryption callback
 */
export async function sessionCipher(
  context: GlobalContext,
  address: SignalAddress,
  storeContext: StoreContext,
  callback?: DecryptionCallback,
): Promise<SessionCipher> {
  return context.sessionCipher(address, storeContext, callback);
}

// ---------------------------------------------------------------------------
// Cipher / builder method helpers
// ---------------------------------------------------------------------------

/**
 * Encrypt a padded plaintext with a group cipher.
 * @param cipher           - a GroupCipher from groupCipher()
 * @param paddedPlaintext  - the padded plaintext
 */
export async function groupEncrypt(
  cipher: GroupCipher,
  paddedPlaintext: Uint8Array,
): Promise<Uint8Array> {
  return cipher.encrypt(paddedPlaintext);
}

/**
 * Decrypt a group ciphertext.
 * @param cipher     - a GroupCipher
 * @param ciphertext - the ciphertext
 */
export async function groupDecrypt(
  cipher: GroupCipher,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  return cipher.decrypt(ciphertext);
}

/**
 * Create a group session (returns a serialized distribution message).
 * @param builder       - a GroupSessionBuilder
 * @param senderKeyName - the sender key name
 */
export async function createSession(
  builder: GroupSessionBuilder,
  senderKeyName: SenderKeyName,
): Promise<DistributionMessage> {
  return builder.createSession(senderKeyName);
}

/**
 * Process a group distribution message.
 * @param builder            - a GroupSessionBuilder
 * @param senderKeyName      - the sender key name
 * @param distributionMessage - the distribution message
 */
export async function processSession(
  builder: GroupSessionBuilder,
  senderKeyName: SenderKeyName,
  distributionMessage: DistributionMessage,
): Promise<void> {
  return builder.processSession(senderKeyName, distributionMessage);
}

/**
 * Process a pre-key bundle to establish a session.
 * @param builder - a SessionBuilder
 * @param bundle  - the pre-key bundle
 */
export async function processPreKeyBundle(
  builder: SessionBuilder,
  bundle: PreKeyBundle,
): Promise<void> {
  return builder.processPreKeyBundle(bundle);
}

/**
 * Encrypt a padded message with a session cipher.
 * @param cipher        - a SessionCipher
 * @param paddedMessage - the padded message
 */
export async function sessionEncrypt(
  cipher: SessionCipher,
  paddedMessage: Uint8Array,
): Promise<CiphertextMessage> {
  return cipher.encrypt(paddedMessage);
}

/**
 * Decrypt a session ciphertext.
 * @param cipher     - a SessionCipher
 * @param ciphertext - the ciphertext
 */
export async function sessionDecryptMessage(
  cipher: SessionCipher,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  return cipher.decryptMessage(ciphertext);
}

/**
 * Decrypt a pre-key session ciphertext.
 * @param cipher     - a SessionCipher
 * @param ciphertext - the ciphertext
 */
export async function sessionDecryptPreKeyMessage(
  cipher: SessionCipher,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  return cipher.decryptPreKeyMessage(ciphertext);
}

/**
 * Get the remote registration id for a session cipher.
 * @param cipher - a SessionCipher
 */
export async function remoteRegistrationId(
  cipher: SessionCipher,
): Promise<number> {
  return cipher.remoteRegistrationId();
}

// ---------------------------------------------------------------------------
// Digest helpers (HmacSha256 / Sha512Digest)
// ---------------------------------------------------------------------------

/**
 * Feed data into an HMAC-SHA256 or SHA-512 digest.
 * @param digest - an HmacSha256 or Sha512Digest
 * @param data   - the data to feed
 */
export async function digestUpdate(
  digest: Digest,
  data: Uint8Array,
): Promise<void> {
  return digest.update(data);
}

/**
 * Finalize a digest and get the result.
 * @param digest - an HmacSha256 or Sha512Digest
 */
export async function digestFinalize(digest: Digest): Promise<Uint8Array> {
  return digest.finalize();
}

// ---------------------------------------------------------------------------
// Store base classes (subclass + implement methods, then trackStore())
// ---------------------------------------------------------------------------

/**
 * The identity key store base class. Subclass it, implement the methods, and
 * pass the instance to trackStore().
 */
export const IdentityKeyStoreBase = (): StoreBaseConstructor<IdentityKeyStore> =>
  libsignalGlobal().IdentityKeyStoreBase;

/**
 * The (signed) pre-key store base class. Subclass it, implement the methods,
 * and pass the instance to trackStore().
 */
export const KeyStoreBase = (): StoreBaseConstructor<PreKeyStore> =>
  libsignalGlobal().KeyStoreBase;

/**
 * The sender key store base class. Subclass it, implement the methods, and
 * pass the instance to trackStore().
 */
export const SenderKeyStoreBase = (): StoreBaseConstructor<SenderKeyStore> =>
  libsignalGlobal().SenderKeyStoreBase;

/**
 * The session store base class. Subclass it, implement the methods, and pass
 * the instance to trackStore().
 */
export const SessionStoreBase = (): StoreBaseConstructor<SessionStore> =>
  libsignalGlobal().SessionStoreBase;

/**
 * The decryption callback base class. Subclass it, implement callback(), and
 * pass the instance to trackStore().
 */
export const DecryptionCallbackBase =
  (): StoreBaseConstructor<DecryptionCallbackObject> =>
    libsignalGlobal().DecryptionCallbackBase;
