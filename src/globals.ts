// this file will contain pseudo global variables
// variables that are shared through out the app.

// #region imports
import type { BaseTelegramClient, SentCodeDeliveryType } from "@mtcute/web";
import { TelegramClient, tl } from "@mtcute/web";

import { telegramPort } from "@workers";

import { EventEmitter } from "tseep";
import { NOOP, sleep, startLogin, startLoginQr } from "@utils";
import { isTlRpcError } from "@mtcute/core/utils.js";
import { MtProxyTcpTransport, SocksProxyTcpTransport, TcpTransport } from "@proxies";
import {
	$dialogFilters,
	$dialogs,
	$loggedIn,
	$loginPhase,
	$mtproxyConfig,
	$proxyMode,
	$qrLink,
	$ready,
	$room,
	$socksConfig,
	$view,
	setStatusbarColor,
} from "@stores";
import UIDialogFilter from "@ui/UIDialogFilter";
import UIDialog from "@ui/UIDialog";
import DialogsJar from "./ui/DialogJar";
import type { SocksProxySettings } from "@fuman/net";
import { apiHash, apiId, cloudphone } from "./config";
import SpatialNavigation from "./lib/spatial_navigation";
import ContactsJar from "./ui/ContactsJar";
import UserStatusJar from "./ui/UserStatusJar";
import TypingIndicatorPrivateJar from "./ui/TypingIndicatorPrivate";
import UIMessage from "./ui/UIMessage";
import { alert } from "./views/modals";
import { config } from "./workers/middlewares";
import UIGifPicker from "./ui/UIGifPicker";
import Deferred from "./lib/Deffered";
import { batch } from "solid-js";
import { closeAllNotifications, manuallyUnsubscribePushNotification } from "./workers/pushNotifications";

// #endregion

export const EE = new EventEmitter<{
	invalidCodeCallback: (type: "code" | "password") => void;
	codeSentCallback: (type: SentCodeDeliveryType) => void;
	phone: (phone: string) => void;
	password: (password: string) => void;
	code: (code: string) => void;
	requestLogin: (type: "phone" | "code" | "password") => void;
	loginError: () => void;
	abortQR: () => void;
	audio_rewind: () => void;
	audio_stop: () => void;
	requestJump: (msgId: number, chatId: number) => void;
}>();

export const dialogsJar = DialogsJar.jar;
export const contactsJar = new ContactsJar();
export const userStatusJar = new UserStatusJar();
export const typingIndicatorPrivateJar = new TypingIndicatorPrivateJar();
export const gifPicker = new UIGifPicker();

const transportConfig = () => {
	const proxyMode = $proxyMode.get();

	const mtproxyConfig = () => {
		const config = $mtproxyConfig.get();
		return {
			...config,
			port: Number.parseInt(config.port),
		};
	};

	const socksConfig = () => {
		const { host, port, password, user } = $socksConfig.get();

		const config: SocksProxySettings = {
			host,
			port: Number.parseInt(port),
		};

		if (password) config.password = password;
		if (user) config.user = user;

		return config;
	};

	if (proxyMode == "none" || proxyMode == "sync") return {};

	return {
		transport:
			proxyMode == "mtproto"
				? new MtProxyTcpTransport(mtproxyConfig())
				: proxyMode == "socks"
					? new SocksProxyTcpTransport(socksConfig())
					: proxyMode == "tcp"
						? new TcpTransport()
						: undefined,
	};
};

export const tg = new TelegramClient(
	// tgPort is null when using proxy
	telegramPort
		? { client: telegramPort, logLevel: 3 }
		: {
				apiId,
				apiHash,

				...config,
				...transportConfig(),
			},
);

const refreshDialogsByPeer = UIDialog.refreshDialogsByPeer;

async function refreshDialogs() {
	const _dialogs = dialogsJar.list();

	const ids_to_keep = new Set<number>();

	for await (const dialog of tg.iterDialogs({
		pinned: "keep",
		archived: "exclude",
	})) {
		if ("left" in dialog.peer.raw && dialog.peer.raw.left) {
			continue;
		}

		if ("deactivated" in dialog.peer.raw && dialog.peer.raw.deactivated) {
			continue;
		}

		const found = dialogsJar.get(dialog.peer.id);
		if (found) {
			found.update(dialog);
			ids_to_keep.add(found.id);
		} else {
			const _dialog = dialogsJar.add(dialog);
			_dialogs.push(_dialog);
			ids_to_keep.add(_dialog.id);
		}
	}

	$dialogs.set(
		DialogsJar.sort(
			_dialogs.filter((a) => {
				const keep = ids_to_keep.has(a.id);

				if (!keep) {
					dialogsJar.remove(a.id);
				}

				return keep;
			}),
		),
	);
}

async function initDialogs() {
	const dialogs = [];

	for await (const dialog of tg.iterDialogs({
		pinned: "keep",
		archived: "exclude",
	})) {
		if ("left" in dialog.peer.raw && dialog.peer.raw.left) {
			continue;
		}

		if ("deactivated" in dialog.peer.raw && dialog.peer.raw.deactivated) {
			continue;
		}

		const _dialog = new UIDialog(dialog);
		dialogsJar.add(_dialog);
		dialogs.push(_dialog);
	}

	$dialogs.set(DialogsJar.sort(dialogs));
}

async function initTabs() {
	const folders = await tg.getFolders();
	const tabs: UIDialogFilter[] = [];
	folders.filters.forEach((a) => {
		if (a._ == "dialogFilter") {
			tabs.push(new UIDialogFilter(a));
		}
	});

	$dialogFilters.set(tabs);
}

function showProxySettings(e: KeyboardEvent) {
	if (e.key != "0") return;
	if (cloudphone) return;
	// only show proxy settings when user is properly logged in to begin with
	if (!$loggedIn.get() && $loginPhase.get() === "done") return;
	const proxyMode = $proxyMode.get();

	if (proxyMode == "mtproto" || proxyMode == "socks") {
		const view = $view.get();

		if (view == "home") {
			$view.set("proxy");
		}
	}
}

const _ready = new Deferred<void>();

window.addEventListener("keydown", showProxySettings, true);

/**
 * When login success
 */
async function onLoggedIn() {
	$loggedIn.set(true);
	$loginPhase.set("done");

	// seems like mtcute doesn't do this?
	$ready.set(await tg.getMe());

	await initDialogs().catch((e) => {
		console.error("onLoggedIn error:", e);
	});

	window.removeEventListener("keydown", showProxySettings, true);

	await initTabs();

	// for some reason I have to delay listening to events
	await sleep(10);

	// #region tg events
	// events should be handled after dialogs are ready!
	tg.onUpdate.add((update) => {
		console.log("PARSED UPDATE: ", update.name, update.data);

		switch (update.name) {
			case "new_message": {
				const message = update.data;
				const found = dialogsJar.get(message.chat.id);
				if (found) {
					console.info("UPDATING LAST MESSAGE");

					found.$lastMessage.set(
						found.messages.add(
							new UIMessage(message),
							// should only sort when necessary
							found.messages.cached,
						),
					);

					refreshDialogsByPeer(found.peer.id);
				} else {
					console.error("dialog was not found for message, refreshing");
					refreshDialogsByPeer(message.chat.id);
				}

				break;
			}

			case "history_read": {
				const data = update.data;

				const peerId = data.chatId;

				const found = dialogsJar.get(peerId);

				if (found) {
					if (data.isOutbox) {
						found.$lastReadOutgoing.set(data.maxReadId);
					} else if (!data.isDiscussion) {
						found.$count.set(data.unreadCount);
					}
				} else {
					console.error("dialog was not found for history read refreshing");
					refreshDialogsByPeer(peerId);
				}

				break;
			}

			case "delete_message": {
				const message = update.data;

				const _dialogs = $dialogs.get();

				const found = _dialogs.find((a) => {
					if (message.channelId === a.id) return true;
					return message.messageIds.find((b) => a.messages.has(b));
				});

				if (found) {
					const messages = found.messages;
					messages.deleteBulk(message.messageIds, found.messages.cached);
					if (messages.$sorted.get().length == 0) {
						messages.loadMore();
					}
					refreshDialogsByPeer(found.peer);
				} else {
					console.error("dialog was not found for message, refreshing", message);
					if (message.channelId) {
						refreshDialogsByPeer(message.channelId);
					} else refreshDialogs();
				}

				break;
			}

			case "edit_message": {
				const message = update.data;

				const found = dialogsJar.get(message.chat.id);

				if (found) {
					// if the lastMessage was the thing edited then use that UIMessage object
					const hasLastMessage = found.$lastMessage.get();
					if (hasLastMessage && hasLastMessage.id == message.id) {
						found.messages.add(hasLastMessage.update(message), found.messages.cached);
					} else {
						// else just add it to the jar
						found.messages.update(message.id, message, found.messages.cached);
					}
				} else {
					console.error("dialog was not found for message, refreshing", message);
					refreshDialogsByPeer(message.chat);
				}

				break;
			}

			case "user_status": {
				const status = update.data;
				const _ = userStatusJar.get(status.userId).update(status);
				console.log("STATUS", _);
				break;
			}

			case "poll": {
				// TODO
				// const pollUpdate = update.data;

				// const id = pollUpdate.pollId.toInt();

				// if (pollUpdate.isShort) {
				// 	const pollCached = pollJar.get(id);
				// 	if (!pollCached) {
				// 		console.error("isShort poll update and poll not cached", pollUpdate);
				// 		break;
				// 	}

				// 	if (!pollUpdate.poll.results) {
				// 		console.error("isShort poll does not have results, useless", pollUpdate);
				// 		break;
				// 	}

				// 	pollCached.resultsUpdate(pollUpdate.poll.results);
				// } else {
				// 	const pollCached = pollJar.add(pollUpdate.poll);

				// 	pollCached.update(pollUpdate.poll);
				// }
				break;
			}

			case "user_typing": {
				const data = update.data;

				// is PM
				if (data.chatType == "user") {
					console.error("USER TYPING OMG", data);
					typingIndicatorPrivateJar.get(data.userId).update(data.status);
				}

				break;
			}
		}
	});

	tg.onRawUpdate.add(({ update: upd }) => {
		console.log("RAW_UPDATE:", upd._, upd);

		switch (upd._) {
			case "updateChatParticipants": {
				if (upd.participants._ == "chatParticipants") {
					const has = dialogsJar.get(upd.participants.chatId);

					if (has) {
						has.$memberCount.set(upd.participants.participants.length);
					} else {
						console.error("chat participant was not found, refreshing dialogs");
						refreshDialogsByPeer(upd.participants.chatId);
					}
				}

				break;
			}

			case "updateChannel": {
				refreshDialogsByPeer(upd.channelId);
				break;
			}

			// this doesn't seem to work well when doing pinned messages stuff?
			case "updateFolderPeers":
			case "updatePinnedDialogs": {
				// tg.getPeerDialogs seems to be cached
				refreshDialogs();
				break;
			}

			case "updateNotifySettings": {
				if ("peer" in upd.peer) {
					const rawPeer = upd.peer.peer;
					tg.getPeer(rawPeer).then((peer) => {
						dialogsJar.get(peer.id)?.updateNotifySettings(upd.notifySettings);
					});
				}
				break;
			}

			// TODO: updateDialogFilter
			case "updateDialogFilter": {
				// EXAMPLE:
				/*
				
				{
  "_": "updateDialogFilter",
  "id": 4,
  "filter": {
    "_": "dialogFilter",
    "contacts": false,
    "nonContacts": false,
    "groups": false,
    "broadcasts": true,
    "bots": false,
    "excludeMuted": false,
    "excludeRead": false,
    "excludeArchived": false,
    "titleNoanimate": false,
    "id": 4,
    "title": {
      "_": "textWithEntities",
      "text": "Channels",
      "entities": []
    },
    "color": 4,
    "pinnedPeers": [],
    "includePeers": [],
    "excludePeers": []
  }
}
				*/
				break;
			}
		}
	});

	// #endregion

	await sleep();

	if ($view.get() == "home") SpatialNavigation.focus("dialogs");

	tg.setOnline(true);
	_ready.resolve();
}

export async function handleNotificationClick(data: any) {
	if (!data) return;

	await _ready.promise;

	const markedPeerId = Number(data?.custom?.markedPeerId);

	if (Number.isNaN(markedPeerId)) return;

	const dialog = (await tg.getPeerDialogs(markedPeerId))[0];

	if (!dialog) return;

	const uiDialog = dialogsJar.add(dialog);

	if (!uiDialog.messages.hasLoadedBefore) {
		uiDialog.messages.loadMore();
	}

	batch(() => {
		setStatusbarColor("#1c96c3");
		$room.set(uiDialog);
		$view.set("room");
	});
}

// #region LOGIN PROCESS

type GetEventTypes<C extends EventEmitter<any>> = C extends EventEmitter<infer T> ? T : unknown;

function waitFor<T extends "phone" | "code" | "password">(evt: T) {
	return new Promise<Parameters<GetEventTypes<typeof EE>[T]>[0]>((resolve) => {
		// attach event listener
		EE.once(evt, (e) => resolve(e));
		// request this from user
		EE.emit("requestLogin", evt);
	});
}

function waitForBinded<T extends "phone" | "code" | "password">(evt: T) {
	return () => {
		// of course
		$loggedIn.set(false);
		$loginPhase.set(evt);
		return waitFor(evt);
	};
}

let abortLogin = new AbortController();

async function start(abortSignal: AbortSignal) {
	console.info("Normal login has started.");

	try {
		await startLogin(tg, {
			phone: waitForBinded("phone"),
			code: waitForBinded("code"),
			password: waitForBinded("password"),
			async invalidCodeCallback(type) {
				console.error("Invalid " + type);
				await alert("Invalid " + type + "!");
				EE.emit("invalidCodeCallback", type);
				EE.emit("loginError");
			},
			codeSentCallback(code) {
				console.log("code sent: ", code);
				// console.log("code type: ", code.type);
				// console.log("code next:", code.nextType);
				// console.log("code length:", code.length);
				EE.emit("codeSentCallback", code.type);
			},
			abortSignal,
		});

		console.log("Login successful");

		onLoggedIn();
	} catch (e) {
		// if this error was caused by abortion😳 do nothing
		if (abortSignal.aborted) return;

		console.error("Error Login: ", e);

		EE.emit("loginError");

		if (tl.RpcError.is(e)) {
			// auth key duplicated!!
			// seems to be a rare error to occur, just reinstall app to fix I guess
			if (
				e.code == 406 ||
				// AUTH_TOKEN_EXPIRED: happens when user terminates unfinished login attempts
				e.code == 400
			) {
				await tg.storage.clear(true).catch(NOOP);
				await logOut(true);
			}

			await alert(e.code + ":" + e.text + "\n\n" + e.message);
		} else if (isTlRpcError(e)) {
			await alert(e.errorCode + ":" + e.errorMessage);
		} else if (e instanceof Error) {
			await alert("Unknown Error Occured!\n\n" + e.name + ": " + e.message);
		} else {
			await alert("Unknown Error Occured!");
		}

		// we don't set abortLogin to another AbortController
		// the one responsible for aborting should do it
		start(abortLogin.signal);
	}
}

start(abortLogin.signal);

/**
 * trigger a sort to occur on the dialogs
 */
export function sortDialogs() {
	$dialogs.set(dialogsJar.sorted());
}

export async function startQr() {
	console.info("Login via QR has started.");

	// ABORT normal login
	abortLogin.abort();

	$qrLink.set(null);

	const abortQrLogin = (abortLogin = new AbortController());
	const abortSignal = abortQrLogin.signal;

	EE.once("abortQR", () => {
		abortQrLogin.abort();
	});

	let hasUpdated = false;

	try {
		await startLoginQr(tg, {
			password: waitForBinded("password"),
			async invalidPasswordCallback() {
				const type = "password";
				console.error("Invalid " + type);
				await alert("Invalid " + type + "!");
				EE.emit("invalidCodeCallback", type);
				EE.emit("loginError");
			},
			onQrScanned() {
				console.log("QR was scanned!");
				$qrLink.set(null);
			},
			onUrlUpdated(url, expires) {
				const secondsLeftTillExpired = Math.floor((expires.getTime() - new Date().getTime()) / 1000);
				console.log("QR URL update:", url, secondsLeftTillExpired);
				// we only show qr code if we generated a newer one
				// the timeout will be longer if it's new
				if (!hasUpdated) {
					hasUpdated = true;
					// if there's little time left to scan, we wait for a newer one
					// we need to have a good amount of time
					// kaios takes super long to do the qr verification
					if (secondsLeftTillExpired < 20) return;
				}
				$qrLink.set(url);
			},
			abortSignal,
		});

		console.log("Login successful (Via QR)");
		onLoggedIn();
	} catch (e) {
		// if an abort didn't occur,
		// we show a bunch of errors on screen.
		if (!abortSignal.aborted) {
			console.error("Error Login (QR): ", e);

			EE.emit("loginError");

			if (tl.RpcError.is(e)) {
				// auth key duplicated!!
				// seems to be a rare error to occur, just reinstall app to fix I guess
				if (
					e.code == 406 ||
					// AUTH_TOKEN_EXPIRED: happens when user terminates unfinished login attempts
					e.code == 400
				) {
					await tg.storage.clear(true).catch(NOOP);
					await logOut(true);
				}
				await alert(e.code + ":" + e.text + "\n\n" + e.message);
			} else if (isTlRpcError(e)) {
				await alert(e.errorCode + ":" + e.errorMessage);
			} else if (e instanceof Error) {
				await alert("Unknown Error Occured!\n\n" + e.name + ": " + e.message);
			} else {
				await alert("Unknown Error Occured!");
			}
		}

		$qrLink.set(null);

		// let's make a new one just to be sure
		abortLogin = new AbortController();
		// we go back to the normal login process
		start(abortLogin.signal);
	}
}

export async function deleteAuthkeyByDC(dcId: number) {
	if (telegramPort) {
		await telegramPort.invokeCustom("deleteAuthkeyByDC", dcId);
	} else if (dcId != (await tg.getPrimaryDcId())) {
		const _tg = tg._client as BaseTelegramClient;
		await _tg.mt.storage.provider.authKeys.deleteByDc(dcId);
	}
}

/**
 * properly log out!!
 */
export async function logOut(silent = false) {
	try {
		await Promise.all([
			// unsubscribe push notifs when logging out
			manuallyUnsubscribePushNotification(),
			closeAllNotifications(),
		]);

		const result = await tg
			.logOut()
			.then(() => true)
			.catch(() => false);

		if (!result) throw null;
	} catch {
		await tg.storage.clear(true);
		if (!silent) await alert("Log out was not successful!");
	}

	$loginPhase.set("phone");
	$loggedIn.set(false);

	// no longer needed
	// mtcute may have fixed it
	// await tg.storage.clear(true);
	location.reload();
}

// #endregion
