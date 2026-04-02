import type { ChatPermissions, Dialog, InputPeerLike, MaybeArray, TextWithEntities } from "@mtcute/core";
import { atom } from "nanostores";
import UIMessage from "./UIMessage";
import Queue from "queue";
import { tg } from "@globals";
import { sleep } from "@utils";
import DialogsJar from "./DialogJar";
import MessagesJar from "./MessagesJar";
import { $dialogs } from "@/stores";
import { getNotifications } from "@/workers/pushNotifications";

// can only mimic text
// no additional info related to other upload types
export class UIMessageUploading {
	$progress = atom(0);
	$error = atom(false);
	$fileSize = atom(0);
	$uploaded = atom(0);
	isText = false;
	isReply = false;
	text!: TextWithEntities | string;
	reply!: UIMessage;
	private oncleanup?: () => void;
	private controller: AbortController;
	abortSignal: AbortSignal;

	constructor() {
		this.controller = new AbortController();
		this.abortSignal = this.controller.signal;
	}

	cancel() {
		this.controller.abort();
	}

	setReply(reply: UIMessage) {
		this.reply = reply;
		this.isReply = true;
	}

	setText(text: TextWithEntities | string) {
		this.isText = true;
		this.text = text;
	}

	onCleanup(cb: () => void) {
		this.oncleanup = cb;
	}

	detach() {
		this.oncleanup?.();
		this.oncleanup = undefined;
	}

	setFileSize(size: number) {
		this.$fileSize.set(size);
	}

	setUploaded(uploaded: number) {
		this.$uploaded.set(uploaded);
	}

	setProgress(progress: number) {
		this.$progress.set(progress);
	}

	/**
	 * just sets $error to true
	 */
	abort() {
		this.$error.set(true);
	}
}

const _instanceof_symbol = Symbol("UIDialog");

export default class UIDialog {
	[_instanceof_symbol] = true;

	private static _queue = new Queue({
		autostart: true,
		concurrency: 1,
	});

	private static async _readHistory(dialog: UIDialog) {
		let changed = false;

		if (dialog.$count.get() || dialog.$countMention.get()) {
			dialog.$count.set(0);
			dialog.$countMention.set(0);

			await tg.readHistory(dialog.peer, {
				maxId: 0,
				clearMentions: true,
			});

			changed = true;
		}

		if (dialog.$countReaction.get()) {
			dialog.$countReaction.set(0);

			await tg.readReactions(dialog.peer);
			changed = true;
		}

		await sleep(100);
		if (changed) await dialog.refreshByPeer();
	}

	static readHistory(dialog: UIDialog) {
		return new Promise<void>((res) => {
			UIDialog._queue.push(async () => {
				await UIDialog._readHistory(dialog);
				const notifs = await getNotifications();

				try {
					for (let i = 0; i < notifs.length; i++) {
						const notif = notifs[i];
						const markedPeerId = Number(notif.data?.custom?.markedPeerId);

						if (Number.isNaN(markedPeerId)) continue;

						if (markedPeerId === dialog.id) {
							notif.close();
							continue;
						}
						const peer = await tg.getPeer(markedPeerId);
						if (peer.id === dialog.id) {
							notif.close();
						}
					}
				} catch {}

				res();
			});
		});
	}

	static async refreshDialogsByPeer(peers: MaybeArray<InputPeerLike>) {
		const result = await tg.getPeerDialogs(peers);

		result.forEach((dialog) => {
			if (!dialog) return;
			if ("left" in dialog.peer.raw && dialog.peer.raw.left) {
				return;
			}

			// console.log(a);
			DialogsJar.jar.add(dialog);
		});

		$dialogs.set(DialogsJar.jar.sorted());
	}

	isVerified = false;

	isSelf = false;
	isGroup = false;
	isForum = false;
	isSupport = false;

	$uploading = atom<UIMessageUploading[]>([]);

	joinDate: Date | null = null;

	id: number;

	messages: MessagesJar;

	$lastMessage = atom<null | UIMessage>(null);

	$memberCount = atom<null | number>(null);
	$permissions = atom<null | ChatPermissions>(null);

	$pinned = atom(false);
	$muted = atom(false);

	$lastReadOutgoing = atom(0);
	$lastReadIngoing = atom(0);

	$count = atom(0);
	$countMention = atom(0);
	$countReaction = atom(0);

	constructor(public rawDialog: Dialog) {
		const peer = rawDialog.peer;

		this.id = peer.id;

		if ("joinDate" in peer && peer.joinDate) {
			this.joinDate = peer.joinDate;
		}
		// if joinDate is unavailable use creationDate as joinDate
		else if ("creationDate" in peer && peer.creationDate) {
			this.joinDate = peer.creationDate;
		}

		this.update(rawDialog);

		this.messages = new MessagesJar(this);
	}

	get peer() {
		return this.rawDialog.peer;
	}

	get displayName() {
		return this.rawDialog.peer.displayName;
	}

	get chatType() {
		const chat = this.peer;
		return "chatType" in chat ? chat.chatType : "private";
	}

	createUpload(text?: TextWithEntities | string, reply?: UIMessage) {
		const upload = new UIMessageUploading();
		if (text) {
			upload.setText(text);
		}
		if (reply) {
			upload.setReply(reply);
		}
		upload.onCleanup(() => {
			this.removeUpload(upload);
		});
		this.$uploading.set(this.$uploading.get().concat(upload));
		return upload;
	}

	removeUpload(upload: UIMessageUploading) {
		let found = false;
		this.$uploading.set(
			this.$uploading.get().filter((a) => {
				if (a === upload) {
					found = true;
					return false;
				}
				return true;
			})
		);
		return found;
	}

	update(dialog: Dialog) {
		// we need to update this value so that the UIDialogFilter works properly
		this.rawDialog = dialog;

		const peer = dialog.peer;

		this.isVerified = peer.isVerified;

		if (peer.type == "user") {
			// peer must be User
			this.isSelf = peer.isSelf;
			this.isSupport = peer.isSupport;
		} else {
			// peer must be Chat
			this.isGroup = peer.isGroup;
			this.isForum = peer.isForum;
		}

		this.$lastMessage.set(dialog.lastMessage ? new UIMessage(dialog.lastMessage) : null);

		this.$pinned.set(dialog.isPinned);
		this.$muted.set(typeof dialog.raw.notifySettings.muteUntil == "number");

		this.$lastReadOutgoing.set(dialog.lastReadOutgoing);
		this.$lastReadIngoing.set(dialog.lastReadIngoing);

		this.$count.set(dialog.unreadCount);
		this.$countMention.set(dialog.unreadMentionsCount);
		this.$countReaction.set(dialog.unreadReactionsCount);

		if ("membersCount" in peer) {
			this.$memberCount.set(peer.membersCount);
		}

		if ("permissions" in peer) {
			this.$permissions.set(peer.permissions);
		}

		if (DialogsJar.search.has(this.id)) DialogsJar.search.replace(DialogsJar.toSearchDocument(this));
	}

	async refreshByPeer() {
		return UIDialog.refreshDialogsByPeer([this.rawDialog.peer]);
	}

	async readHistory() {
		return UIDialog.readHistory(this);
	}

	deleteChannel() {
		return tg.deleteChannel(this.peer);
	}

	static is(dialog: unknown): dialog is UIDialog {
		return typeof dialog == "object" && Boolean(dialog && (dialog as UIDialog)[_instanceof_symbol]);
	}
}
