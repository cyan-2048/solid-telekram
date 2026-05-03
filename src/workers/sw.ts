console.info("[SW] sw.ts start!");

import { openDB } from "idb";
import { generateIcon } from "./sw~badges";
import { decodeBase64Url, decryptTelegramPushPayload } from "./pushCrypto";

let visibilityState = "visible";

const sw = self as unknown as ServiceWorkerGlobalScope;

function collapse(str: string) {
	return str.replace(/\s+/g, " ").trim();
}

const cachedDatabase = openDB("solid-telekram", 5, {
	upgrade: (db) => {
		const name = "appPreferences";
		if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
	},
});

sw.addEventListener("install", (event) => {
	console.info("[SW] on install");
	event.waitUntil(sw.skipWaiting());
});

const CACHE_NAME = "static-cache-v2";

sw.addEventListener("activate", (event) => {
	console.info("[SW] on activate");
	event.waitUntil(
		Promise.all([
			sw.clients.claim(),
			caches.keys().then((cacheNames) => {
				const cachesToKeep = [CACHE_NAME, "files-cache-v1"];

				return Promise.all(cacheNames.filter((a) => !cachesToKeep.includes(a)).map((name) => caches.delete(name)));
			}),
		]),
	);
});

// Function to check if a request is for an image and matches the desired prefix
function shouldCacheRequest(request: Request) {
	const url = request.url;
	// console.log("[SW] fetch url:", url);
	return (
		url.startsWith("https://cyan-2048.github.io/kaigram-assets/emoji2/") ||
		url.startsWith("https://cyan-2048.github.io/kaigram-assets/wallpapers/") ||
		url.startsWith("https://cyan-2048.github.io/kaigram-assets/stickers/") ||
		url.startsWith("https://file-icons.cyan-2048.workers.dev/") ||
		url.startsWith("https://cyan-2048.github.io/kaigram-assets/Humanity/")
	);
}

function isEmoji2Request(request: Request) {
	return request.url.startsWith("https://cyan-2048.github.io/kaigram-assets/emoji2/");
}

function fetchAndMaybeCache(request: Request, skip404Cache: boolean) {
	return fetch(request).then((networkResponse) => {
		if (skip404Cache && networkResponse.status === 404) {
			return networkResponse;
		}

		return caches.open(CACHE_NAME).then((cache) => {
			cache.put(request, networkResponse.clone()); // Store in cache
			return networkResponse;
		});
	});
}

sw.addEventListener("fetch", (event) => {
	if (shouldCacheRequest(event.request)) {
		const skip404Cache = isEmoji2Request(event.request);

		event.respondWith(
			caches.match(event.request).then((cachedResponse) => {
				if (cachedResponse) {
					if (skip404Cache && cachedResponse.status === 404) {
						return caches.open(CACHE_NAME).then((cache) => {
							cache.delete(event.request);
							return fetchAndMaybeCache(event.request, skip404Cache);
						});
					}

					return cachedResponse; // Serve from cache
				}

				return fetchAndMaybeCache(event.request, skip404Cache);
			}),
		);
	}
});

sw.addEventListener("push", (event) => {
	const obj = event.data?.json();
	if (!obj) return;
	// let hasActiveWindows = false;
	console.log("[SW] on push", obj);
	event.waitUntil(
		resolvePushPayload(obj).then((resolvedPayload) =>
			sw.clients
				.matchAll({ type: "window" })
				.then((clientList) => {
					// console.info("matched clients", clientList);
					// hasActiveWindows = clientList.length > 0;
					if (visibilityState !== "visible") {
						return fireNotification(resolvedPayload);
					}
					if (
						// hasActiveWindows
						clientList.length > 0
					) {
						console.info("Supress notification because some instance is alive", resolvedPayload);
						return;
					}
					return fireNotification(resolvedPayload);
				})
				.catch((err) => {
					console.error(err);
				}),
		),
	);
});

async function resolvePushPayload(payload: unknown): Promise<Record<string, unknown>> {
	if (!payload || typeof payload !== "object") {
		return {};
	}

	const maybeEncrypted = (payload as { p?: unknown }).p;
	if (typeof maybeEncrypted !== "string") {
		return payload as Record<string, unknown>;
	}

	try {
		const db = await cachedDatabase;
		const pushAuthKeyEncoded = await db.get("appPreferences", "pushAuthKey");
		if (typeof pushAuthKeyEncoded !== "string" || !pushAuthKeyEncoded) {
			return payload as Record<string, unknown>;
		}

		const pushAuthKey = decodeBase64Url(pushAuthKeyEncoded);
		const decrypted = await decryptTelegramPushPayload(maybeEncrypted, pushAuthKey);
		return decrypted.payload as Record<string, unknown>;
	} catch (error) {
		console.error("[SW] push decrypt error", error);
		return payload as Record<string, unknown>;
	}
}

sw.addEventListener("message", (event) => {
	console.log("[SW] on message:", event.data);
	switch (event.data.type) {
		case 0: // clearNotification
			break;
		case 1: // visibilityState
			visibilityState = event.data.visibilityState;
			console.log("visibilityState :", visibilityState);
			break;
		case 2: // test fire notification
			console.log("firing notification: ", event.data);
			fireNotification(event.data);
			break;
	}
});

async function openApp(notification: Notification) {
	try {
		await (await cachedDatabase).put("appPreferences", notification.data || {}, "notificationClickData");
	} catch {}

	try {
		// KaiOS docs says this should be available?
		if ("openApp" in sw.clients && typeof sw.clients.openApp == "function") {
			return sw.clients.openApp() as void;
		}

		const clientList = await sw.clients.matchAll({ type: "window" });

		for (var i = 0; i < clientList.length; i++) {
			let client = clientList[i];
			if ("focus" in client) {
				return client.focus();
			}
		}

		if (typeof sw.clients.openWindow == "function") {
			return sw.clients.openWindow(new URL("/", self.location.origin)).then((client) => client?.focus());
		}
	} catch (err) {
		console.log(err);
	}
}

sw.addEventListener("notificationclick", (event) => {
	console.log("[SW] on notificationclick");
	event.notification.close();

	event.waitUntil(openApp(event.notification));
});

sw.addEventListener("notificationclose", () => {
	console.log("[SW] on notificationclose");
});

// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event
sw.addEventListener("pushsubscriptionchange", (ev) => {
	const event = ev as any as ExtendableEvent;
	console.log("[SW] on pushsubscriptionchange", event);
	const result = sw.registration.pushManager
		.subscribe({ userVisibleOnly: true })
		.then((subscription) => {
			const subscriptionObj = subscription.toJSON();
			delete subscriptionObj["expirationTime"];
			return Promise.all([cachedDatabase, Promise.resolve(subscriptionObj)]);
		})
		.then((values) => {
			return values[0].put("appPreferences", values[1], "updatedPushSubscription");
		})
		.then((key) => {
			console.log("[SW]@pushsubscriptionchange:", key);
			fireSystemNotification("System Update", "Please re-launch app to apply new push notification subscription");
		})
		.catch((err) => {
			console.error("[SW]@pushsubscriptionchange:", err);
			fireSystemNotification("System Update", "Unable to resubscribe for push notification");
		});
	event.waitUntil(result);
});

function fireSystemNotification(title: string, body: string, requireInteraction = false, actions = []) {
	sw.registration.showNotification(title || "TeleKram", {
		body: collapse(body) || "Hello from TeleKram",
		requireInteraction: requireInteraction,
		// @ts-ignore
		actions: actions,
	});
}

const ZERO_CHANNEL_ID = -1000000000000;

async function fireNotification(data: any) {
	let title = data.title || "Telegram";
	let body = data.description || "";
	let icon = "/icon56.png";

	if (data.badge && !Number.isNaN(Number(data.badge)) && String(data.badge).length < 5) {
		icon = generateIcon(data.badge);
	}

	let markedPeerId: number = 0;

	if (data.custom) {
		/**
		 * follow mtcute getMarkedPeerID
		 *
		 * - ID stays the same for users
		 * - ID is negated for chats
		 * - ID is negated and `-1e12` is subtracted for channels
		 */
		if (data.custom.channel_id) {
			markedPeerId = ZERO_CHANNEL_ID - data.custom.channel_id;
		} else if (data.custom.chat_id) {
			markedPeerId = -data.custom.chat_id;
		} else {
			markedPeerId = data.custom.from_id || 0;
		}
		data.custom.markedPeerId = markedPeerId;
	}

	const tag = "peer" + markedPeerId;

	let silent = false;

	// we avoid the annoying push notifs flood noise
	const previous = await sw.registration.getNotifications({ tag });
	const now = Date.now();

	for (let i = 0; i < previous.length; i++) {
		const notif = previous[i];
		const created = notif.data?.__created__;
		if (created && now - created < 30_000) {
			// Notification was created within last 30 seconds
			silent = true;
			break;
		}
	}

	data.__created__ = now;

	console.log("[SW] show notify", { title, body, icon }, data);

	sw.registration.showNotification(title, {
		body: collapse(body),
		icon: icon,
		tag: tag,
		data: data,
		silent,
	});
}
