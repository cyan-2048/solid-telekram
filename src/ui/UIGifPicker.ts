// scraped from tweb k

import { sleep } from "@/helpers";
import { tg } from "@globals";
import { Thumbnail, Video } from "@mtcute/core";
import { toInputPeer, toInputUser } from "@mtcute/core/utils";
import type { tl } from "@mtcute/tl";
import memoize from "lodash-es/memoize";
import Queue from "queue";

// I absolutely have no idea how these emojis are picked
const queryEmojis = {
	love: "❤😍🥰😘☺🤗😚😙💋🍑👄🫦😻❤‍🔥💗💞💕💖🧡💛💚💙💜🖤🤍🤎💓💘💝💟👩‍❤‍👨👩‍❤‍👩💑👨‍❤‍👨👩‍❤‍💋‍👨👩‍❤‍💋‍👩💏👨‍❤‍💋‍👨",
	approval: "👍👏👌💪😌✌🤝✔🆗✅",
	disapproval: "👎😒🤮🤢🤦‍♂🤦‍♀🙅‍♀🙅‍♂",
	cheers: "🎉🥳🤩🎊🥂🍾🌟🍻🎂💃🎁",
	laughter: "😄😁😆😅😂🤣😀🤭😃😬😈",
	astonishment: "😨😦😱😯😧😮😲🤯😵😳🫣😰",
	sadness: "😔😪😭😢😣😞🥺💔☹😕🙁🥲😒😥😫😮‍💨🫤😟",
	anger: "😡🤬👿😠😤🖕💢",
	neutral: "😐😑😕😶🙃🙂🫠🤐🥶",
	doubt: "🤔🤨🧐🙄🥸😵‍💫❓🤷‍♀🤷‍♂",
	silly: "🤪😜😝😛🤡🥴",
} as const;

export type GifCategories = keyof typeof queryEmojis;

type GifResultRaw = tl.RawBotInlineMediaResult & {
	type: "gif";
	photo: tl.RawPhoto;
	document: tl.RawDocument;
};

export type GifResult = {
	raw: GifResultRaw;
	video: Video;
};

const queue = new Queue({
	autostart: true,
	concurrency: 1,
});

function wait(): Promise<void> {
	return new Promise((res) => {
		queue.push(async () => {
			res();
			await sleep(1000);
		});
	});
}

export default class UIGifPicker {
	peer!: tl.TypeInputPeer;
	bot!: tl.TypeInputUser;

	async init() {
		const [me, gif] = await Promise.all([tg.resolvePeer("me"), tg.resolvePeer("gif")]);
		this.peer ||= toInputPeer(me);
		this.bot ||= toInputUser(gif);
	}

	private _search = async (query: string, offset = "") => {
		await this.init();
		await wait();

		const { nextOffset, results } = await tg.call(
			{
				_: "messages.getInlineBotResults",
				bot: this.bot,
				peer: this.peer,
				query: query,
				offset: offset,
			},
			{
				floodSleepThreshold: 20_000,
			}
		);

		const _results: GifResult[] = [];

		results.forEach((a) => {
			const raw = a as GifResultRaw;
			const video = new Video(raw.document, raw.document.attributes.find((a) => a._ == "documentAttributeVideo")!);

			// performance issues
			// we skip gifs that do not have proper thumbnails!
			if (
				(video.getThumbnail(Thumbnail.THUMB_STRIP) || video.thumbnails.find((a) => Number.isNaN(a.width))) &&
				(video.getThumbnail("m") || video.thumbnails.find((a) => !Number.isNaN(a.width) && !a.isVideo))
			)
				_results.push({
					raw: raw,
					video,
				});
		});

		return {
			query,
			nextOffset,
			results: _results,
		};
	};

	search = memoize(this._search, (query, offset) => query + (offset || ""));

	async getCategory(category: GifCategories, offset = "") {
		return this.search(queryEmojis[category], offset);
	}
}
