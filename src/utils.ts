// this file contains utils that should only be used in the main thread

import { type FileLocation, type Photo, type Sticker, tl, type MessageMedia } from "@mtcute/web";
import { type MaybeDynamic, type MaybePromise, type Peer, type SentCode, type TelegramClient, User } from "@mtcute/web";
import { normalizePhoneNumber, resolveMaybeDynamic } from "@mtcute/web/utils";
import sanitize from "sanitize-filename";
import { sleep } from "./helpers";

import type { Store, StoreValue } from "nanostores";
import type { Accessor } from "solid-js";
import { createComputed, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { useStore as _useStore } from "@nanostores/solid";
import type { TelegramIcons } from "@components/Softkeys";
import type UIMessage from "./ui/UIMessage";
import type UIDialog from "./ui/UIDialog";

export * from "./helpers";

const countriesURL = new URL("@/assets/country_dial_info.json", import.meta.url).href;

import type { Country } from "@components/CountryCodePicker";

let countriesCache = null as any;

export const countries: () => Country[] = () => {
	if (countriesCache) return countriesCache;
	console.error(countriesURL);
	const xhr = new XMLHttpRequest();
	xhr.open("GET", countriesURL, false);
	xhr.send();
	return (countriesCache = JSON.parse(xhr.responseText));
};

export const WALLPAPER_AVERAGE_COLORS = Object.freeze([
	"#72b0db",
	"#76a2c9",
	"#869095",
	"#aebb98",
	"#416275",
	"#d3ba90",
	"#bbc787",
	"#a9a5a2",
	"#b0b0b0",
	"#d4b38a",
	"#947767",
	"#b3b3bc",
	"#d0cac2",
	"#4a7d19",
	"#a1877f",
	"#c1799f",
	"#375f91",
	"#86a48b",
	"#c1b4b0",
	"#7d8956",
	"#ccbcad",
	"#a87e56",
	"#a8bbac",
	"#e1c598",
	"#354e64",
	"#9fa2a3",
	"#a28992",
	"#658783",
	"#fbfbfb",
	"#bab2ae",
	"#48d5d8",
	"#56971d",
	"#a8a3a1",
	"#606a33",
	"#6881a3",
	"#ae5a52",
	"#46291f",
	"#5ec4c8",
	"#cdb38f",
	"#5d5a6e",
	"#a7c5c0",
	"#278ea5",
	"#9884a3",
	"#849aba",
	"#e1d5ca",
	"#158091",
	"#bbc2cc",
	"#9b7c7f",
	"#69ae13",
	"#a09c9c",
	"#212d30",
	"#92aea6",
	"#a2c1db",
	"#1a2d38",
	"#4e4843",
	"#243647",
]);

// #region scrollIntoView

function getScrollParent(node: any): HTMLElement | null {
	if (node == null) {
		return null;
	}

	if (node.scrollHeight > node.clientHeight) {
		return node;
	} else {
		return getScrollParent(node.parentNode);
	}
}

export function scrollIntoView(element: HTMLElement | Element) {
	const scrollerElement = getScrollParent(element);
	if (!scrollerElement) return;

	const rect = element.getBoundingClientRect();

	if (rect.top - scrollerElement.offsetTop < 0) {
		element.scrollIntoView(true); // top
		return;
	}

	const diff = rect.bottom - (scrollerElement.offsetHeight + scrollerElement.offsetTop);

	if (diff >= -0.5) {
		element.scrollIntoView(false); // bottom
	}
}

// #endregion

// #region tg.start methods

async function startLogin_(
	tg: TelegramClient,
	params: {
		phone: MaybeDynamic<string>;
		code: () => MaybePromise<string>;
		password: () => MaybePromise<string>;
		codeSentCallback: (code: SentCode) => MaybePromise<void>;
		invalidCodeCallback: (type: "code" | "password") => MaybePromise<void>;
		abortSignal?: AbortSignal;
	},
) {
	let has2fa = false;
	let sentCode: SentCode | undefined;
	let phone: string | null = null;

	try {
		const me = await tg.getMe();

		// user is already authorized

		tg.log.info("Logged in as %s (ID: %s, username: %s, bot: %s)", me.displayName, me.id, me.username, me.isBot);

		await tg.notifyLoggedIn(me.raw);

		return me;
	} catch (e) {
		if (tl.RpcError.is(e)) {
			if (e.text === "SESSION_PASSWORD_NEEDED") has2fa = true;
			else if (e.text === "SESSION_REVOKED" || e.text === "USER_DEACTIVATED" || e.text === "USER_DEACTIVATED_BAN") {
				// session is dead, we need to explicitly log out before we can log in again
				await tg.logOut().catch((err) => {
					console.error("failed to logout!", err);
				});
			}
		} else {
			throw e;
		}
	}

	// if has2fa == true, then we are half-logged in, but need to enter password
	if (!has2fa) {
		phone = normalizePhoneNumber(await resolveMaybeDynamic(params.phone));

		// aborting should only be possible at this point of time.
		if (params.abortSignal?.aborted) {
			params.abortSignal.throwIfAborted();
		}

		try {
			const res = await tg.sendCode({
				phone,
				// abortSignal
			});

			if (res instanceof User) {
				return res;
			}

			sentCode = res;
		} catch (e) {
			if (tl.RpcError.is(e, "SESSION_PASSWORD_NEEDED")) {
				has2fa = true;
			} else {
				throw e;
			}
		}
	}

	if (sentCode) {
		await params.codeSentCallback(sentCode);

		for (;;) {
			const code = await resolveMaybeDynamic(params.code);
			if (!code) throw new tl.RpcError(400, "PHONE_CODE_EMPTY");

			try {
				return await tg.signIn({
					phone: phone!,
					phoneCodeHash: sentCode.phoneCodeHash,
					phoneCode: code,
					// abortSignal,
				});
			} catch (e) {
				if (!tl.RpcError.is(e)) throw e;

				if (e.is("SESSION_PASSWORD_NEEDED")) {
					has2fa = true;
					break;
				} else if (
					e.is("PHONE_CODE_EMPTY") ||
					e.is("PHONE_CODE_EXPIRED") ||
					e.is("PHONE_CODE_INVALID") ||
					e.is("PHONE_CODE_HASH_EMPTY")
				) {
					await params.invalidCodeCallback("code");

					continue;
				} else {
					throw e;
				}
			}
		}
	}

	if (has2fa) {
		for (;;) {
			const password = await resolveMaybeDynamic(params.password);

			try {
				return await tg.checkPassword(password);
			} catch (e) {
				if (tl.RpcError.is(e, "PASSWORD_HASH_INVALID")) {
					await params.invalidCodeCallback("password");

					continue;
				} else {
					throw e;
				}
			}
		}
	}

	throw new Error("Failed to log in with provided credentials");
}

export async function startLogin(
	tg: TelegramClient,
	params: Parameters<typeof startLogin_>[1],
): ReturnType<typeof startLogin_> {
	return new Promise((resolve, reject) => {
		const signal = params.abortSignal;

		if (signal) {
			if (signal.aborted) return reject(signal.reason);

			signal.addEventListener("abort", function fn() {
				signal.removeEventListener("abort", fn);
				reject(signal.reason);
			});
		}

		startLogin_(tg, params).then(resolve, reject);
	});
}

export async function startLoginQr(
	tg: TelegramClient,
	params: {
		/**
		 * Function that will be called whenever the login URL is changed.
		 *
		 * The app is expected to display `url` as a QR code to the user
		 */
		onUrlUpdated: (url: string, expires: Date) => void;
		/**
		 * Function that will be called when the user has scanned the QR code
		 * (i.e. when `updateLoginToken` is received), and the library is finalizing the auth
		 */
		onQrScanned: () => void;
		/** Password for 2FA */
		password: MaybeDynamic<string>;

		/**
		 * Function that will be called after the server has rejected the password.
		 *
		 * Note that in case {@link password} is not a function,
		 * this callback will never be called, and an error will be thrown instead.
		 */
		invalidPasswordCallback: () => MaybePromise<void>;

		/** Abort signal */
		abortSignal?: AbortSignal;
	},
) {
	let has2fa = false;

	try {
		const me = await tg.getMe();

		// user is already authorized

		tg.log.info("Logged in as %s (ID: %s, username: %s, bot: %s)", me.displayName, me.id, me.username, me.isBot);

		await tg.notifyLoggedIn(me.raw);

		return me;
	} catch (e) {
		if (tl.RpcError.is(e)) {
			if (e.text === "SESSION_PASSWORD_NEEDED") has2fa = true;
			else if (e.text === "SESSION_REVOKED" || e.text === "USER_DEACTIVATED" || e.text === "USER_DEACTIVATED_BAN") {
				// session is dead, we need to explicitly log out before we can log in again
				await tg.logOut().catch((err) => {
					console.error("failed to logout!", err);
				});
			}
		} else {
			throw e;
		}
	}

	if (has2fa) {
		for (;;) {
			const password = await resolveMaybeDynamic(params.password);

			try {
				return await tg.checkPassword(password);
			} catch (e) {
				if (tl.RpcError.is(e, "PASSWORD_HASH_INVALID")) {
					params.invalidPasswordCallback();
					continue;
				} else {
					throw e;
				}
			}
		}
	}

	return tg.signInQr(params);
}

// #endregion tg.start methods

// #region setSoftkeys

// TypeScript issue lol
// #region
export function setSoftkeys(
	_left?: string | null,
	_center?: TelegramIcons | null,
	_right?: TelegramIcons | null,
	_loading?: boolean | null,
	_black?: boolean | null,
): void;
export function setSoftkeys(
	_left?: TelegramIcons | null,
	_center?: string | null,
	_right?: TelegramIcons | null,
	_loading?: boolean | null,
	_black?: boolean | null,
): void;
export function setSoftkeys(
	_left?: TelegramIcons | null,
	_center?: TelegramIcons | null,
	_right?: string | null,
	_loading?: boolean | null,
	_black?: boolean | null,
): void;
export function setSoftkeys(
	_left?: string | null,
	_center?: string | null,
	_right?: TelegramIcons | null,
	_loading?: boolean | null,
	_black?: boolean | null,
): void;
export function setSoftkeys(
	_left?: string | null,
	_center?: TelegramIcons | null,
	_right?: string | null,
	_loading?: boolean | null,
	_black?: boolean | null,
): void;
export function setSoftkeys(
	_left?: TelegramIcons | null,
	_center?: string | null,
	_right?: string | null,
	_loading?: boolean | null,
	_black?: boolean | null,
): void;
export function setSoftkeys(
	_left?: string | null,
	_center?: TelegramIcons | string | null,
	_right?: TelegramIcons | string | null,
	_loading?: boolean | null,
	_black?: boolean | null,
): void;
// #endregion
export function setSoftkeys(
	_left?: string | null,
	_center?: string | null,
	_right?: string | null,
	_loading?: boolean | null,
	_black?: boolean | null,
) {
	setSoftkeys.v.apply(null, arguments as any);
}

setSoftkeys.v = (
	_left?: string | null,
	_center?: string | null,
	_right?: string | null,
	_loading?: boolean | null,
	_black?: boolean | null,
) => {};

setSoftkeys.hide = (_hide: boolean) => {};

export function hideSoftkeys(hide: boolean) {
	setSoftkeys.hide(hide);
}

// #endregion setSoftkeys

// #region toaster
interface ToastOptions {
	latency?: number;
	/**
	 * force usage of a native toast
	 */
	native?: boolean;
}

const toastConnections = navigator.mozApps
	?.getSelf()
	.then((a) => a.connect("systoaster"))
	.catch(() => null);

export async function toaster(text: string, opts?: ToastOptions) {
	const latency = opts?.latency ?? 2000;

	if (opts?.native) {
		// thanks tbrrss
		if (typeof WebActivity != "undefined") {
			const s = new WebActivity("show-toast", {
				text,
				timeout: latency,
			});
			await s.start();
		}

		const conns = await toastConnections;

		if (conns) {
			conns.forEach((conn) => conn.postMessage({ message: text, latency }));
		} else {
			// this might be good enough really...
			const notif = new Notification(text, {
				tag: "kaigram-toast",
				data: {},
				silent: true,
			});

			await sleep(latency);
			notif.close();
		}
	} else {
		await toaster.v(text, latency);
	}
}

toaster.v = async (_text: string, _latency: number) => {};

// #endregion toaster

// #region hooks

/**
 * custom behavior
 *
 * @param _store Store instance.
 * @returns Store value.
 */
export function useStore<SomeStore extends Store, Value extends StoreValue<SomeStore>>(
	store: SomeStore | (() => SomeStore | undefined | void),
): Accessor<Value> {
	// if it's a function we do my implementation
	if (typeof store == "function") {
		const _store = createMemo(store);

		const [state, setState] = createSignal(untrack(_store)?.get());

		createComputed(() => {
			const unsub = _store()?.subscribe((state) => {
				setState(state);
			});

			onCleanup(() => {
				unsub?.();
			});
		});

		return state;
	}

	return _useStore(store);
}

export function useMessageChecks(message: () => UIMessage | null, dialog: () => UIDialog) {
	const lastReadOutgoing = useStore(() => dialog().$lastReadOutgoing);

	// returns false if double check
	const check = () => (message() ? (dialog().isSelf ? false : lastReadOutgoing() < message()!.id) : true);
	return check;
}

// #endregion hooks

export function isUser(peer: Peer): peer is User {
	return peer.type == "user";
}

export function typeInTextbox(
	newText: string,
	el = document.activeElement as HTMLTextAreaElement | HTMLInputElement | HTMLElement,
) {
	if ("value" in el) {
		const start = el.selectionStart!;
		const end = el.selectionEnd!;
		const text = el.value;
		const before = text.substring(0, start);
		const after = text.substring(end, text.length);
		el.value = before + newText + after;
		el.selectionStart = el.selectionEnd = start + newText.length;
		el.focus();
	} else {
		el.focus();
		try {
			document.execCommand("insertText", false, newText);
		} catch {}
	}

	el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function getTextFromContentEditable(e: HTMLElement) {
	let text = "";

	e.childNodes.forEach((node, i, parent) => {
		if (node.nodeType === Node.TEXT_NODE) {
			text = text + node.nodeValue;
			// get rid of trailing \n ?
		} else if (node.nodeName === "BR" && i != parent.length - 1) {
			text = text + "\n";
		}
	});

	return text;
}

export function isSelectionAtStart() {
	const selection = document.getSelection();

	if (!selection) return false;

	if (!selection.anchorNode) return false;

	if (selection.anchorOffset != 0) return false;

	if ((selection.anchorNode as HTMLElement).isContentEditable) return true;

	const parent = selection.anchorNode.parentElement;

	if (parent) {
		return parent.isContentEditable && parent.firstChild == selection.anchorNode;
	}

	return false;
}

export function downloadToFile(url: string | Blob | URL, fileName?: string) {
	let downloadLink = String(url);

	if (url instanceof Blob) {
		downloadLink = URL.createObjectURL(url);
	}

	const a = document.createElement("a");
	a.href = downloadLink;
	a.download = fileName ?? "file_" + Date.now() + ".bin";
	document.body.appendChild(a); // Required for Firefox
	a.click();
	//console.error("HELLO????", url instanceof Blob);
	document.body.removeChild(a);

	if (url instanceof Blob) {
		URL.revokeObjectURL(downloadLink);
	}
}

type DownloadableMedia = Extract<
	Exclude<MessageMedia, null | Sticker>,
	{ fileId: string; type: string } | FileLocation
>;

// https://github.com/morethanwords/tweb/blob/8a2c0476c94738d792a894a2d9e60738cf798a3b/src/environment/mimeTypeMap.ts
const MIME_TYPE_EXTENSION_MAP = Object.freeze({
	"application/pdf": "pdf",
	"application/x-tgwallpattern": "tgv",
	"application/x-tgsticker": "tgs",
	"application/json": "json",
	"audio/wav": "wav",
	"audio/mpeg": "mp3",
	"audio/ogg": "ogg",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/gif": "gif",
	"image/webp": "webp",
	"video/mp4": "mp4",
	"video/webm": "webm",
	"video/quicktime": "mov",
	"image/svg+xml": "svg",
	"image/avif": "avif",
	"image/jxl": "jxl",
	"image/bmp": "bmp",
}) as Record<string, string>;

// behavior of Telegram Web K
function photoFilename(photo: Photo) {
	const best = photo.getThumbnail((photo as any)._bestSize.type);
	const type = best?.type;

	return `photo_${photo.id.toString()}${type ? "_" + type : ""}.jpg`;
}

function _mediaFilename(media: DownloadableMedia): string {
	const type = media.type;
	if (type == "photo") return photoFilename(media);
	if (media.fileName) return media.fileName;

	const inputDocumentId = media.inputDocument.id.toString();

	const mimeType = media.mimeType;

	const fileExtensionByMimeType = MIME_TYPE_EXTENSION_MAP[mimeType];

	if (type == "audio") {
		const base = media.title || `audio_${inputDocumentId}`;
		return `${base}.${fileExtensionByMimeType || "mp3"}`;
	}

	return type + "_" + inputDocumentId + "." + (fileExtensionByMimeType || "bin");
}

export function mediaFilename(media: DownloadableMedia): string {
	return sanitize(_mediaFilename(media));
}
