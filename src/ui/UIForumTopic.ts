import { tg } from "@globals";
import MessagesJar from "./MessagesJar";
import type UIDialog from "./UIDialog";

import { LRUCache } from "lru-cache";
import type { ChatType, ForumTopic, Peer, TextWithEntities, tl } from "@mtcute/core";
import { toaster } from "@utils";
import { atom } from "nanostores";
import { UIDialogMuteDuration, UIMessageUploading } from "./UIDialog";
import UIMessage from "./UIMessage";

const lru = new LRUCache<string, MessagesJar>({
	max: 3,
	dispose(
		value,
		//	, key, reason
	) {
		// console.log("[MessagesJar] LRU reason: ", reason, value, lru);
		value.dispose();
	},
});

class ForumMessagesJar extends MessagesJar {
	constructor(
		dialog: UIDialog,
		private topicId: number,
	) {
		super(dialog);
	}

	get cached() {
		return lru.has(this.dialog.id + "-" + this.topicId);
	}

	sort() {
		lru.set(this.dialog.id + "-" + this.topicId, this);
		super.sort(false);
	}

	async loadMore() {
		if (this.isLoadingMore) {
			return;
		}

		if (this.hasLoadedBefore && !this.lastOffset) {
			console.log("last offset is undefined, end has reached maybe?");
			this.$showSpinner.set(false);
			// toaster("You have reached the end of chat.");
			return;
		}

		this.sort();

		const hasLoadedBefore = this.hasLoadedBefore;

		if (hasLoadedBefore) {
			this.isLoadingMore = true;
		} else {
			this.$isLoading.set(true);
		}

		if (hasLoadedBefore) {
			this.$showSpinner.set(true);
			// toaster("Loading more messages...");
		}

		let tries = 0;

		while (true) {
			try {
				tries++;
				const e = await tg.searchMessages({
					chatId: this.dialog.peer,
					threadId: this.topicId,
					limit: 20,
					offset: this.lastOffset as any,
				});

				// if (hasLoadedBefore) await sleep(2000);

				// console.log(e);

				this.hasLoadedBefore = true;
				this.lastOffset = e.next as any;

				this.addBulk(e);
				break;
			} catch (e: any) {
				console.error("ERROR tg.searchMessages", e);
				if (tries > 2) {
					toaster((e?.name || "Unknown Error") + ": " + (e?.message || "???"));
					break;
				}
			}
		}

		if (hasLoadedBefore) {
			this.isLoadingMore = false;
		} else {
			this.$isLoading.set(false);
		}

		this.$showSpinner.set(false);
	}
}

const MAX_INT_32 = 2 ** 31 - 1;

const _instanceof_symbol = Symbol("UIForumTopic");

// I wanted to inherit UIDialog for this but it feels like both are too different to be inherited

export default class UIForumTopic {
	private [_instanceof_symbol] = true;
	messages: MessagesJar;

	id: number;

	constructor(
		private dialog: UIDialog,
		private forumTopic: ForumTopic,
	) {
		this.id = forumTopic.id;
		this.messages = new ForumMessagesJar(dialog, forumTopic.id);

		this.update(forumTopic);
	}

	$uploading = atom<UIMessageUploading[]>([]);

	$lastMessage = atom<null | UIMessage>(null);

	$pinned = atom(false);
	$muted = atom(false);

	$lastReadOutgoing = atom(0);
	$lastReadIngoing = atom(0);

	$count = atom(0);
	$countMention = atom(0);
	$countReaction = atom(0);

	private muteUntil: null | number = null;

	get peer(): Peer {
		return this.dialog.peer;
	}
	get displayName(): string {
		return this.forumTopic.title;
	}
	get chatType(): ChatType | "private" {
		return "supergroup";
	}

	update(forumTopic: ForumTopic): void {
		this.$lastMessage.set(forumTopic.lastMessage ? new UIMessage(forumTopic.lastMessage) : null);

		this.$pinned.set(forumTopic.isPinned);

		this.$lastReadOutgoing.set(forumTopic.lastReadOutgoing);
		this.$lastReadIngoing.set(forumTopic.lastReadIngoing);

		this.$count.set(forumTopic.unreadCount);
		this.$countMention.set(forumTopic.unreadMentionsCount);
		this.$countReaction.set(forumTopic.unreadReactionsCount);

		this.updateNotifySettings(forumTopic.raw.notifySettings);
	}

	private async updateChatNotifySettings(settings: Omit<tl.RawInputPeerNotifySettings, "_">) {
		const peer = await tg.resolvePeer(this.dialog.peer);

		tg.call({
			_: "account.updateNotifySettings",
			peer: { _: "inputNotifyForumTopic", peer: peer, topMsgId: this.forumTopic.id },
			settings: {
				_: "inputPeerNotifySettings",
				...settings,
			},
		});
	}

	/**
	 * refresh $muted store (run this when really necessary)
	 */
	syncMuted() {
		this.$muted.set(typeof this.muteUntil == "number" && Math.floor(Date.now() / 1000) < this.muteUntil);
	}

	updateNotifySettings(notifySettings: tl.RawPeerNotifySettings) {
		this.muteUntil = typeof notifySettings.muteUntil == "number" ? notifySettings.muteUntil : null;
		this.syncMuted();
	}

	async unmute() {
		// if not muted
		if (!this.$muted.get()) return;
		this.$muted.set(false);
		this.muteUntil = null;
		await this.updateChatNotifySettings({});
	}

	async mute(duration: UIDialogMuteDuration) {
		if (this.$muted.get()) return;

		this.$muted.set(true);

		const muteUntil =
			duration === UIDialogMuteDuration.Forever ? MAX_INT_32 : Math.floor(Date.now() / 1000) + Number(duration);

		this.muteUntil = muteUntil;

		await this.updateChatNotifySettings({
			muteUntil,
		});
	}

	refreshByPeer(): Promise<void> {
		throw new Error("Method not implemented.");
	}

	async readHistory() {}

	deleteChannel(): Promise<void> {
		throw new Error("Method not implemented.");
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
			}),
		);
		return found;
	}

	static is(dialog: unknown): dialog is UIForumTopic {
		return typeof dialog == "object" && Boolean(dialog && (dialog as UIForumTopic)[_instanceof_symbol]);
	}
}
