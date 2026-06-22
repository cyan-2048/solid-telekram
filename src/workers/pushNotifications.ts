import { openDB } from "idb";
import ServiceWorkerURL from "./sw.ts?serviceworker";
import { handleNotificationClick, tg } from "@globals";
import { telegramPort } from "./index";
import type { BaseTelegramClient } from "@mtcute/web";
import { isCloudphone } from "@/config";
import { NOOP } from "@helpers";
import { encodeBase64Url } from "./pushCrypto";

const cachedDatabase = openDB("solid-telekram", 5, {
	upgrade: (db) => {
		const name = "appPreferences";
		if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
	},
});

const APP_VERSION_STORAGE_KEY = "sw_version";

async function handleAppUpdateIfNeeded() {
	const currentVersion = import.meta.env.APP_VERSION + ServiceWorkerURL;
	const storedVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY);

	if (storedVersion === currentVersion) return;

	if (storedVersion != null) {
		await manuallyUnsubscribePushNotification().catch(() => null);
		await manuallySubscribePushNotification().catch(() => null);
	}

	localStorage.setItem(APP_VERSION_STORAGE_KEY, currentVersion);
}

if ("serviceWorker" in navigator && !import.meta.env.DEV && !isCloudphone) {
	console.log("START SERVICE WORKER", ServiceWorkerURL);

	navigator.serviceWorker
		.register(ServiceWorkerURL)
		.then(() => {
			if (navigator.serviceWorker.controller) {
				navigator.serviceWorker.controller.postMessage({ type: 1, visibilityState: document.visibilityState });
				navigator.serviceWorker.addEventListener("message", (event) => {
					console.log("[SW]addEventListener:", event.data);
				});
			}
		})
		.catch((error) => {
			console.error("Service Worker", error);
		});

	cachedDatabase.then(async (db) => {
		// Object.assign(window, { cachedDatabase: db });

		const pushSubscription = await db.get("appPreferences", "pushSubscription");

		if (pushSubscription) {
			const updatedPushSubscription = await db.get("appPreferences", "updatedPushSubscription");
			if (updatedPushSubscription != null) {
				await unregisterDevice(pushSubscription);
				// console.log('unregisterDevice result:', result);
				await registerDevice(updatedPushSubscription);
				// console.log('registerDevice result:', result);
				db.delete("appPreferences", "updatedPushSubscription");
			} else {
				await handleAppUpdateIfNeeded();
			}
		}
	});
} else {
	console.warn("Service Worker not supported");
}

export async function setNotoColorEmojiFix(needsFix: boolean) {
	const db = await cachedDatabase;
	await db.put("appPreferences", needsFix, "notoColorEmojiFix");
	navigator.serviceWorker.controller?.postMessage({ type: 3, needsFix });
}

export async function getNotificationClickData(): Promise<object | null> {
	const db = await cachedDatabase;
	const data = await db.get("appPreferences", "notificationClickData");

	if (data) {
		await db.delete("appPreferences", "notificationClickData");
		return data;
	}
	return null;
}

export async function getNotifications() {
	if (import.meta.env.DEV) return [];
	const registration = await navigator.serviceWorker.ready;
	return Promise.resolve(registration.getNotifications());
}

export async function closeAllNotifications() {
	return getNotifications()
		.then((notifs) => notifs.forEach((a) => a.close()))
		.catch(NOOP);
}

if ("mozSetMessageHandler" in navigator) {
	navigator.mozSetMessageHandler("serviceworker-notification", () => {
		if (navigator.mozApps) {
			let request = navigator.mozApps.getSelf();
			request.onsuccess = () => {
				if (request.result) {
					request.result.launch();
				}
			};
		} else {
			window.open(document.location.origin, "_blank");
		}
	});
}

document.addEventListener("visibilitychange", () => {
	navigator.serviceWorker.controller?.postMessage({ type: 1, visibilityState: document.visibilityState });
	console.log("visibilitychange", document.visibilityState);

	if (document.visibilityState == "visible")
		getNotificationClickData().then((data) => {
			// console.log("NOTIFICATION CLIKED?", data);
			if (data) {
				handleNotificationClick(data);
			}
		});
});

export function subscribePush(): Promise<any> {
	return new Promise((resolve, reject) => {
		Notification.requestPermission()
			.then((result) => {
				if (result === "granted") return navigator.serviceWorker.ready;
				return Promise.reject("Denied");
			})
			.then((reg) => {
				return reg.pushManager.subscribe({ userVisibleOnly: true });
			})
			.then((subscription) => {
				if (subscription) resolve(subscription);
				else reject(subscription);
			})
			.catch(reject);
	});
}

export function unsubscribePush(): Promise<any> {
	return new Promise((resolve, reject) => {
		getPushSubscription()
			.then((subscription) => {
				if (!subscription) reject("Please subscribe");
				else return subscription.unsubscribe();
			})
			.then((result) => {
				resolve(result);
			})
			.catch(reject);
	});
}

export function getPushSubscription(): Promise<any> {
	return new Promise((resolve, reject) => {
		navigator.serviceWorker.ready
			.then((reg) => {
				return reg.pushManager.getSubscription();
			})
			.then((subscription) => {
				if (!subscription) reject("Please subscribe");
				else resolve(subscription);
			})
			.catch(reject);
	});
}

export async function registerDevice(subscription: any) {
	let authKey: Uint8Array;

	if (telegramPort) {
		authKey = await telegramPort.invokeCustom("getAuthKey");
	} else {
		const client = tg._client as BaseTelegramClient;
		const primaryDcs = (await client.mt.storage.dcs.fetch()) ?? client.mt._defaultDcs;

		const _authKey = await client.mt.storage.provider.authKeys.get(primaryDcs.main.id);
		if (!_authKey) throw new Error("Auth key is not ready yet");
		authKey = _authKey;
	}

	console.error("REGISTER DEVICE", subscription);
	// @ts-ignore
	const result = await tg.call({
		_: "account.registerDevice",
		tokenType: 10,
		token: JSON.stringify(subscription),
		otherUids: [],
		appSandbox: false,
		secret: authKey,
		noMuted: true,
	});

	await (await cachedDatabase).put("appPreferences", subscription, "pushSubscription");
	await (await cachedDatabase).put("appPreferences", encodeBase64Url(authKey), "pushAuthKey");

	return result;
}

export async function unregisterDevice(subscription: any) {
	const db = await cachedDatabase;

	console.error("UNREGISTER DEVICE", subscription);
	const result = await tg.call({
		_: "account.unregisterDevice",
		tokenType: 10,
		token: JSON.stringify(subscription),
		otherUids: [],
	});

	await db.delete("appPreferences", "pushSubscription");
	await db.delete("appPreferences", "pushAuthKey");
	return result;
}

export async function checkState() {
	return !!(await (await cachedDatabase).get("appPreferences", "pushSubscription"));
}

export async function manuallyUnsubscribePushNotification() {
	try {
		const db = await cachedDatabase;
		const pushSubscription = await db.get("appPreferences", "pushSubscription");
		if (pushSubscription) {
			await unregisterDevice(pushSubscription).catch(() => null);
		}
		await db.delete("appPreferences", "pushSubscription");
		await db.delete("appPreferences", "pushAuthKey");

		await unsubscribePush().catch(() => null);
		return true;
	} catch {
		return false;
	}
}

export async function manuallySubscribePushNotification() {
	try {
		const db = await cachedDatabase;
		await db.delete("appPreferences", "updatedPushSubscription");
		let pushSubscription = await db.get("appPreferences", "pushSubscription");
		if (pushSubscription) {
			await unregisterDevice(pushSubscription);
		}
		try {
			await unsubscribePush();
		} catch (err) {}
		pushSubscription = await subscribePush();
		pushSubscription = pushSubscription.toJSON();
		delete pushSubscription["expirationTime"];
		await registerDevice(pushSubscription);
		return true;
	} catch (err) {
		return false;
	}
}
