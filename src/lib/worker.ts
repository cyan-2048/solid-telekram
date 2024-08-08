import "core-js/actual/symbol";
import "./abort-controller.js";

import * as Comlink from "comlink";

const apiId = import.meta.env.VITE_APP_ID;
const apiHash = import.meta.env.VITE_APP_HASH;

import { BaseTelegramClient, defaultReconnectionStrategy, TelegramWorker, WebPlatform } from "@mtcute/web";
import parseUserAgent from "./parseUserAgent.js";
import { setPlatform } from "@mtcute/core/platform.js";
import type { AsmCryptoProvider } from "@mtcute/web/asmjs/crypto.js";

const isKai3 = import.meta.env.VITE_KAIOS == 3;

const appVersion = (() => {
	if (import.meta.env.DEV) {
		const manifest = import.meta.env.MANIFEST;
		const version = isKai3 ? manifest.b2g_features.version : manifest.version;

		return version;
	}

	if (import.meta.env.PROD) {
		const manifestURL = isKai3 ? "/manifest.webmanifest" : "/manifest.webapp";

		const xhr = new XMLHttpRequest();
		xhr.open("GET", manifestURL, false);
		xhr.responseType = "json";
		xhr.send();
		const manifest = xhr.response;
		const version = isKai3 ? manifest.b2g_features.version : manifest.version;

		return version;
	}
})();

// not available
// console.error("WORKER TEST IF STORAGE AVAILABLE IN WORKER", navigator.getDeviceStorage);

const fromUA = parseUserAgent(navigator.userAgent);
const version = appVersion;

class KaiPlatform extends WebPlatform {
	onNetworkChanged(fn: (connected: boolean) => void): () => void {
		// console.error("onNetwork change handler omfg");
		return () => {};
	}

	isOnline() {
		// console.error("isONline WAA");
		return true;
	}
}

setPlatform(new KaiPlatform());
const tg = new BaseTelegramClient({
	platformless: true,
	apiId,
	apiHash,

	initConnectionOptions: {
		deviceModel: navigator.userAgent,
		systemVersion: fromUA.systemVersion.replace("/", " "),
		appVersion: version,
	},

	// reconnectionStrategy: (params, lastError, consequentFails, previousWait) => {
	// 	// console.error("RECONNECTION STRATEGYYYY", params, lastError, consequentFails, previousWait);
	// 	return defaultReconnectionStrategy(params, lastError, consequentFails, previousWait);
	// },

	testMode: false,

	logLevel: 3,
});

Object.assign(self, { tg });

new TelegramWorker({
	client: tg,
});

const exposed = {
	gzip(data: Uint8Array, maxSize?: number) {
		return tg.crypto.gzip(data, maxSize ?? Math.floor(data.length * 0.9));
	},

	gunzip(data: Uint8Array) {
		return tg.crypto.gunzip(data);
	},

	getAvailableMemory() {
		if (!isKai3) {
			if ("instance" in tg.crypto) {
				return (tg.crypto.instance as any).getAvailableMemory() as number;
			}
		}

		return null;
	},

	webp(buff: Uint8Array, width: number, height: number) {
		if (!isKai3) {
			if ("instance" in tg.crypto) {
				return (tg.crypto.instance as AsmCryptoProvider).webp(buff, width, height);
			}
		}

		return null;
	},
};

export type Exposed = typeof exposed;

Comlink.expose(exposed);
