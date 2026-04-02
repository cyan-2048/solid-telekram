import UITypingIndicatorPrivate from "./UITypingIndicatorPrivate";

export default class TypingIndicatorPrivateJar extends Map<number, UITypingIndicatorPrivate> {
	get(id: number) {
		const has = super.get(id);
		if (has) {
			return has;
		}

		const indicator = new UITypingIndicatorPrivate(id);
		this.set(id, indicator);
		return indicator;
	}
}
