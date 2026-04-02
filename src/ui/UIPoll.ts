import type { Poll } from "@mtcute/core";
import type { tl } from "@mtcute/tl";
import { atom } from "nanostores";

export default class UIPoll {
	$closed = atom(false);

	$results = atom<null | tl.RawPollResults>(null);

	constructor(public rawPoll: Poll) {
		this.update(rawPoll);

		// pollJar.set(rawPoll.id.toInt(), this);
	}

	update(poll: Poll) {
		this.rawPoll = poll;

		poll.results && this.$results.set(poll.results);

		this.$closed.set(poll.isClosed);
	}

	resultsUpdate($: tl.RawPollResults) {
		this.$results.set($);
	}
}
