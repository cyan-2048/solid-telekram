import { readStringSession } from "@mtcute/core/utils";
import { TelegramClient } from "@mtcute/web";
import { openDB } from "idb";

const cachedDatabase = openDB("solid-telekram", 5, {
	upgrade: (db, oldVersion, newVersion) => {
		const tables = ["appPreferences"];
		tables.forEach((n) => {
			if (!db.objectStoreNames.contains(n)) db.createObjectStore(n);
		});
	},
});

if ("serviceWorker" in navigator) {
	console.log("START SERVICE WORKER");
	navigator.serviceWorker
		.register("/sw.js")
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
} else {
	console.warn("Service Worker not supported");
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
			.catch((err) => {
				reject(err);
			});
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
			.catch((err) => {
				reject(err);
			});
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
			.catch((err) => {
				reject(err);
			});
	});
}

export async function registerDevice(tg: TelegramClient, subscription: any) {
	// messy
	const data = readStringSession(await tg.exportSession());

	const result = await tg.call({
		_: "account.registerDevice",
		tokenType: 10,
		token: JSON.stringify(subscription),
		otherUids: [],
		appSandbox: false,
		secret: data.authKey,
	});

	await (await cachedDatabase).put("appPreferences", subscription, "pushSubscription");

	return result;
}

export async function unregisterDevice(tg: TelegramClient, subscription: any) {
	console.error("UNREGISTER DEVICE", subscription);
	const result = await tg.call({
		_: "account.unregisterDevice",
		tokenType: 10,
		token: JSON.stringify(subscription),
		otherUids: [],
	});

	await (await cachedDatabase).delete("appPreferences", "pushSubscription");
	return result;
}

export async function manuallySubscribePushNotification(client: TelegramClient) {
	try {
		(await cachedDatabase).delete("appPreferences", "updatedPushSubscription");
		let pushSubscription = await (await cachedDatabase).get("appPreferences", "pushSubscription");
		if (pushSubscription) {
			await unregisterDevice(client, pushSubscription);
		}
		try {
			await unsubscribePush();
		} catch (err) {}
		pushSubscription = await subscribePush();
		pushSubscription = pushSubscription.toJSON();
		delete pushSubscription["expirationTime"];
		await registerDevice(client, pushSubscription);
		return Promise.resolve(true);
	} catch (err) {
		return Promise.reject(err);
	}
}
