// this is where all ✨global✨ nanostores should be stored

import { persistentAtom, persistentMap } from "@nanostores/persistent";
import { atom } from "nanostores";
import type UIDialogFilter from "@ui/UIDialogFilter";
import type UIDialog from "@ui/UIDialog";
import type UIMessage from "./ui/UIMessage";
import type { User } from "@mtcute/core";
import localforage from "localforage";
import { cloudphone } from "./config";
import { isDeviceStorageSupportedAsync } from "./lib/storage/device";

const noListen = { listen: false };

const bool = {
	decode(e: string) {
		return Boolean(+e);
	},
	encode(e: boolean) {
		return e ? "1" : "0";
	},
	listen: false,
} as const;

const intOrString = {
	decode(e: any) {
		const result = Number(e);
		if (Number.isNaN(result)) return e;
		return Math.floor(result);
	},
	encode(e: any) {
		return String(typeof e == "number" ? Math.floor(e) : e);
	},
	listen: false,
} as const;

const json = {
	encode(value: any) {
		return JSON.stringify(value);
	},
	decode(value: any) {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	},
} as const;

//#region login
export const $loggedIn = persistentAtom("loggedIn", false, bool);

/**
 * what step of the login phase
 */
export const $loginPhase = persistentAtom<"phone" | "code" | "password" | "done">("loginPhase", "phone", noListen);

//#endregion

//#region wallpapers

export const DEFAULT_WALLPAPER = 20;
export const $wallpaper = persistentAtom<number | "custom" | "color" | "brat">(
	"wallpaper",
	DEFAULT_WALLPAPER,
	intOrString,
);

$wallpaper.subscribe((wallpaper) => {
	if (typeof wallpaper == "number") {
		document.body.style.setProperty("--wallpaper", `url(/wallpapers/${wallpaper}.jpg)`);
	}
});

export const $wallpaper_url = atom("");

localforage.ready().then(async () => {
	const wallpaper = await localforage.getItem<Blob>("custom_wallpaper");
	if ($wallpaper.get() === "custom" && wallpaper) {
		$wallpaper_url.set(URL.createObjectURL(wallpaper));
	}
});

// export const $wallpaper_brat = persistentMap(
// 	"brat_:",
// 	{
// 		fontSize: "",
// 		text: "",
// 	},
// 	noListen,
// );

export const DEFAULT_WALLPAPER_COLOR = "#b2cee1";

/**
 * must be a hex color
 */
export const $wallpaper_color = persistentAtom("wallpaper_color", DEFAULT_WALLPAPER_COLOR, noListen);

//#endregion

export const $ready = atom<null | User>(null);

export const $mtproxyConfig = persistentMap(
	"mtproxy:",
	{
		host: "",
		port: "",
		secret: "",
	},
	noListen,
);

export const $socksConfig = persistentMap(
	"socks:",
	{
		host: "",
		port: "",
		user: "",
		password: "",
	},
	noListen,
);

// people seem to prefer the whatsapp way of sending messages
export const $sendByEnter = persistentAtom("sendByEnter", true, bool);

// on cloudphone you can't send by pressing the Enter button
if (cloudphone) {
	$sendByEnter.set(false);
}

export const $cachedPhoneNumber = persistentMap("phone:", { number: "", iso2: "" }, noListen);

/**
 * - none - no proxies are used, can use worker
 * - sync - use main thread, useful for debugging errors
 * - tcp - use tcp transport
 * - socks
 * - mtproto
 */
export type ProxyModes = "none" | "mtproto" | "socks" | "tcp" | "sync";

export const $proxyMode = persistentAtom<ProxyModes>(
	"proxyMode",
	// sync gives better error handling
	// no bridge to worker, stacktrace much more readable
	import.meta.env.DEV ? "sync" : "none",
	noListen,
);

export const $emojiHistory = persistentAtom<string[]>("EMOJI_HISTORY", [], json);

export const $qrLink = atom<null | string>(null);

export const $dialogFilters = atom<UIDialogFilter[]>([]);
export const $currentTab = atom<UIDialogFilter | null>(null);

export const $dialogs = atom<UIDialog[]>([]);

type Views = "home" | "room" | "info" | "settings" | "new_chat" | "debug" | "proxy";

export const $view = atom<Views>("home");
export const $previousView = atom<Views>("home");

export const $room = atom<UIDialog | null>(null);

export const $handledDialogRefocus = atom(false);

export const $editingMessage = atom<null | UIMessage>(null);
export const $replyingMessage = atom<null | UIMessage>(null);

export const $toastText = atom("");
export const $showToast = atom(false);

const statusbarColor = atom("#000");

let themeColorMetaEl: Element | null = null;

statusbarColor.subscribe((color) => {
	(themeColorMetaEl ||= document.head.querySelector(`meta[name="theme-color"]`))?.setAttribute("content", color);
});

export function setStatusbarColor(color: string) {
	statusbarColor.set(color);
}

//#region storage
export const $storage = persistentAtom<"device" | "localforage" | "caches">("storage", "caches", noListen);

const $storage_device_storage_test = persistentAtom("device_storage_test", false, bool);

// prefer using device storage (better performance)
if (!$storage_device_storage_test.get() && !cloudphone) {
	isDeviceStorageSupportedAsync().then((supported) => {
		$storage_device_storage_test.set(true);
		if (supported) $storage.set("device");
	});
}

if (!cloudphone) {
	isDeviceStorageSupportedAsync().then((supported) => {
		// if device storage stops working, revert back to caches
		if (!supported && $storage.get() == "device") {
			$storage.set("caches");
		}
	});
}

//#endregion
