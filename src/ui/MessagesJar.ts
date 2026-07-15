import { atom } from "nanostores";
import UIMessage from "./UIMessage";
import type UIDialog from "./UIDialog";
import type { GetHistoryOffset } from "@mtcute/core/methods.js";
import type { Message } from "@mtcute/core";
import { tg } from "@globals";
import { toaster } from "@utils";

import { LRUCache } from "lru-cache";

const lru = new LRUCache<number, MessagesJar>({
	max: 3,
	dispose(
		value,
		//	, key, reason
	) {
		// console.log("[MessagesJar] LRU reason: ", reason, value, lru);
		value.dispose();
	},
});

export default class MessagesJar extends Map<number, UIMessage> {
	constructor(public dialog: UIDialog) {
		super();
	}

	dispose() {
		this.clear();

		this.$isLoading.set(false);
		this.$showSpinner.set(false);

		this.hasLoadedBefore = false;
		this.isLoadingMore = false;
		this.lastOffset = undefined;
	}

	get cached() {
		return lru.has(this.dialog.id);
	}

	$sorted = atom<UIMessage[]>([]);
	$isLoading = atom(false);

	$showSpinner = atom(false);

	hasLoadedBefore = false;

	private lastOffset?: GetHistoryOffset;
	private isLoadingMore = false;

	/* add cached message, aka message that should not be shown in the UI */
	addCached($: UIMessage | Message) {
		return this.add($, false, true);
	}

	add($: UIMessage | Message, sort = true, cache = false) {
		let message!: UIMessage;

		if (this.has($.id)) {
			const has = this.get($.id)!;

			has.update(UIMessage.is($) ? $.raw : $);

			// if it was cached before then make it uncached
			if (has.cached && !cache) {
				has.cached = false;
			}
			message = has;
		} else {
			message = UIMessage.is($) ? $ : new UIMessage($, cache);
		}

		this.set($.id, message);
		sort && this.sort();
		return message;
	}

	addBulk(messages: (UIMessage | Message)[], sort = true) {
		const _ = messages.map((a) => this.add(a, false));
		sort && this.sort();

		return _;
	}

	list() {
		const arr: UIMessage[] = [];

		for (const m of this.values()) {
			// only show non cached messages
			if (!m.cached) arr.push(m);
		}

		return arr;
	}

	sort() {
		lru.set(this.dialog.id, this);

		const messages = this.list();
		messages.sort((a, b) => {
			return a.date.getTime() - b.date.getTime();
		});

		this.$sorted.set(messages);
	}

	delete(id: number, sort = true): boolean {
		const deleted = super.delete(id);
		sort && this.sort();
		return deleted;
	}

	deleteBulk(ids: number[], sort = true) {
		const deleted = ids.map((id) => super.delete(id));
		sort && this.sort();
		return deleted;
	}

	/**
	 * updates a message inside the jar,
	 * if it doesn't exist in the jar it adds it
	 */
	update(id: number, $: Message, sort = true, cache = false) {
		const has = this.get(id);

		if (has) {
			has.update($);
			return has;
		}

		return this.add(new UIMessage($, cache), sort);
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
				const e = await tg.getHistory(this.dialog.peer, {
					limit: 20,
					offset: this.lastOffset,
				});

				// if (hasLoadedBefore) await sleep(2000);

				// console.log(e);

				this.hasLoadedBefore = true;
				this.lastOffset = e.next;

				this.addBulk(e);
				break;
			} catch (e: any) {
				console.error("ERROR tg.getHistory", e);
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
