import "core-js/actual/symbol";
import "./abort-controller.js";

const apiId = import.meta.env.VITE_APP_ID;
const apiHash = import.meta.env.VITE_APP_HASH;

import { BaseTelegramClient, defaultReconnectionStrategy, TelegramWorker } from "@mtcute/web";
import parseUserAgent from "./parseUserAgent.js";

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

const tg = new BaseTelegramClient({
	apiId,
	apiHash,

	initConnectionOptions: {
		deviceModel: navigator.userAgent,
		systemVersion: fromUA.systemVersion.replace("/", " "),
		appVersion: version,
	},

	reconnectionStrategy: (params, lastError, consequentFails, previousWait) => {
		console.error("RECONNECTION STRATEGYYYY", params, lastError, consequentFails, previousWait);
		return defaultReconnectionStrategy(params, lastError, consequentFails, previousWait);
	},

	testMode: false,

	logLevel: 3,
});

Object.assign(self, { tg });

new TelegramWorker({
	client: tg,
});
