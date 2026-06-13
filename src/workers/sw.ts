console.info("[SW] sw.ts start!");

import { openDB } from "idb";
import { generateIcon } from "./sw~badges";
import { decodeBase64Url, decryptTelegramPushPayload } from "./pushCrypto";

// @ts-expect-error
import twemojiMatcher from "@twemoji/parser/dist/lib/regex";

const kaiosEmojiMatcher =
	/[\u{23f8}-\u{23fa}\u{2611}\u{2614}-\u{2615}\u{2639}-\u{263a}\u{26a1}\u{26aa}-\u{26ab}\u{26bd}-\u{26be}\u{2705}\u{270a}-\u{270c}\u{2714}\u{2716}\u{2728}\u{274c}\u{274e}\u{2753}\u{2757}\u{2764}\u{2795}-\u{2797}\u{27b0}\u{27bf}\u{2b50}\u{2b55}\u{1f300}\u{1f308}\u{1f30a}\u{1f30e}\u{1f319}-\u{1f31a}\u{1f31d}-\u{1f31f}\u{1f331}\u{1f334}\u{1f337}-\u{1f33c}\u{1f33f}-\u{1f343}\u{1f345}-\u{1f346}\u{1f34a}-\u{1f34b}\u{1f34e}\u{1f351}-\u{1f353}\u{1f36b}\u{1f36d}\u{1f370}\u{1f377}\u{1f37a}-\u{1f37b}\u{1f37e}\u{1f380}-\u{1f382}\u{1f388}-\u{1f38a}\u{1f3a4}-\u{1f3a5}\u{1f3a7}\u{1f3af}\u{1f3b5}-\u{1f3b6}\u{1f3b8}\u{1f3bc}\u{1f3c0}-\u{1f3c1}\u{1f3c3}\u{1f3c6}\u{1f40c}\u{1f415}\u{1f41d}\u{1f41f}\u{1f431}\u{1f436}-\u{1f438}\u{1f43d}-\u{1f43e}\u{1f440}\u{1f444}-\u{1f451}\u{1f46a}-\u{1f46d}\u{1f476}\u{1f47b}\u{1f47d}\u{1f47f}-\u{1f480}\u{1f483}\u{1f485}-\u{1f486}\u{1f489}\u{1f48b}-\u{1f491}\u{1f493}-\u{1f49f}\u{1f4a1}-\u{1f4ad}\u{1f4af}-\u{1f4b0}\u{1f4b5}\u{1f4b8}\u{1f4cc}-\u{1f4cd}\u{1f4da}\u{1f4e2}-\u{1f4e3}\u{1f4f1}-\u{1f4f2}\u{1f4f7}-\u{1f4f8}\u{1f4fa}\u{1f514}\u{1f51d}\u{1f525}\u{1f52a}-\u{1f52b}\u{1f534}-\u{1f535}\u{1f57a}\u{1f595}-\u{1f596}\u{1f5a4}\u{1f600}-\u{1f637}\u{1f639}\u{1f63b}\u{1f641}-\u{1f64c}\u{1f64f}\u{1f680}\u{1f697}\u{1f6a8}-\u{1f6a9}\u{1f6ab}\u{1f6b6}\u{1f7e0}-\u{1f7e4}\u{1f910}-\u{1f915}\u{1f917}-\u{1f91a}\u{1f91d}-\u{1f924}\u{1f927}-\u{1f92f}\u{1f932}\u{1f937}\u{1f940}\u{1f942}\u{1f971}\u{1f984}\u{1f98b}\u{1f9d0}\u{1f9e1}]/u;

let visibilityState = "visible";

const sw = self as unknown as ServiceWorkerGlobalScope;

const PLACEHOLDER_CHARACTER_EMOJI = "�";
let notoColorEmojiFix = false;

function collapse(str: string) {
	const trimmed = str.replace(/\s+/g, " ").trim();

	if (notoColorEmojiFix) {
		return trimmed.replace(twemojiMatcher, (emoji) => {
			if (emoji.length == 2 || emoji.length == 1) {
				if (kaiosEmojiMatcher.test(emoji)) {
					return emoji;
				}
			}

			return PLACEHOLDER_CHARACTER_EMOJI;
		});
	}

	return trimmed;
}

const cachedDatabase = openDB("solid-telekram", 5, {
	upgrade: (db) => {
		const name = "appPreferences";
		if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
	},
});

cachedDatabase.then(async (db) => {
	const needsFix = await db.get("appPreferences", "notoColorEmojiFix");
	notoColorEmojiFix = !!needsFix;
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
			console.log("[SW] visibilityState :", visibilityState);
			break;
		case 2: // test fire notification
			console.log("firing notification: ", event.data);
			fireNotification(event.data);
			break;
		case 3: // notoColorEmojiFix
			notoColorEmojiFix = event.data.needsFix;
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
		body: body.trim() || "Hello from TeleKram",
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

	sw.registration.showNotification(collapse(title), {
		body: collapse(body),
		icon: icon,
		tag: tag,
		data: data,
		silent,
	});
}
