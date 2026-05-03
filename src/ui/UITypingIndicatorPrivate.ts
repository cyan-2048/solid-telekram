import type { TypingStatus } from "@mtcute/core";
import { atom } from "nanostores";

/**
 * This should be the TypingIndicator for Private chats only
 */
export default class UITypingIndicatorPrivate {
	$status = atom<TypingStatus | null>(null);

	private timeout: any;

	update(newStatus: TypingStatus) {
		clearTimeout(this.timeout);

		if (newStatus == "cancel") {
			this.$status.set(null);
			return this;
		}

		this.$status.set(newStatus);

		this.timeout = setTimeout(() => {
			this.$status.set(null);
		}, 6_000);

		return this;
	}

	constructor(public id: number) {}
}
