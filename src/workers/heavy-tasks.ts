// worker for heavy tasks, use comlink
import * as Comlink from "comlink";
import decodeWebP from "@/lib/webp/whatsapp_webp";

// import _emojidata from "emoji-datasource/emoji.json";
//
// const emojidata = _emojidata;

// @ts-ignore
import SparkMD5 from "spark-md5";
import StickersMap from "@/lib/StickersMap";

// we now combine rlottie and heavy tasks because yeah
// i think we're using a bit too many workers now!!
import * as rlottie from "./rlottie/worker";
// import CategoryPlusEmojis from "./categoryPlusEmojis.json?url";

const CategoryPlusEmojis = new URL("./categoryPlusEmojis.json", import.meta.url).href;

// function emojiFromCodePoints(codePoints: string) {
// 	return codePoints
// 		.split("-")
// 		.reduce((prev, curr) => prev + String.fromCodePoint(parseInt(curr, 16)), "");
// }

// function unifiedString(str: string) {
// 	return emojiFromCodePoints(str);
// }

const enum EmojiCategory {
	// these two are combined in discord
	Smileys,
	People,

	Animals,
	Food,
	Travel,
	Activities,
	Objects,
	Symbols,
	Flags,

	// not actual emojis
	Component,
}

// @ts-ignore
const categories: {
	0: "Smileys & Emotion";
	1: "People & Body";
	2: "Animals & Nature";
	3: "Food & Drink";
	4: "Travel & Places";
	5: "Activities";
	6: "Objects";
	7: "Symbols";
	8: "Flags";
	Symbols: 7;
	Activities: 5;
	Flags: 8;
	"Travel & Places": 4;
	"Food & Drink": 3;
	"Animals & Nature": 2;
	"People & Body": 1;
	Objects: 6;
	"Smileys & Emotion": 0;
} = {
	Symbols: EmojiCategory.Symbols,
	Activities: EmojiCategory.Activities,
	Flags: EmojiCategory.Flags,
	"Travel & Places": EmojiCategory.Travel,
	"Food & Drink": EmojiCategory.Food,
	"Animals & Nature": EmojiCategory.Animals,
	"People & Body": EmojiCategory.People,
	Objects: EmojiCategory.Objects,
	"Smileys & Emotion": EmojiCategory.Smileys,
};

console.log("HEAVY TASKS WORKER");

function md5(buffer: Uint8Array) {
	const e = SparkMD5.ArrayBuffer.hash(buffer.buffer as ArrayBuffer);
	return e as string;
}

async function _initEmojis() {
	const categoryPlusEmojis: Record<any, string[][]> = await fetch(CategoryPlusEmojis).then((a) => a.json());

	for (const key in categoryPlusEmojis) {
		// @ts-ignore
		if (typeof categories[key] !== "undefined") {
			// @ts-ignore
			categoryPlusEmojis[categories[key]] = categoryPlusEmojis[key];
		}
	}
	return categoryPlusEmojis;
}

let _emojiInit: Promise<Record<any, string[][]>> | null = null;

function initEmojis() {
	return _emojiInit || (_emojiInit = _initEmojis());
}

// function last<T>(arr: T[]) {
// 	return arr[arr.length - 1];
// }

/*
emojidata
	.sort((a, b) => {
		return a.sort_order - b.sort_order;
	})
	.filter((a) => a.has_img_apple)
	.forEach((emoji) => {
		const category = (categoryPlusEmojis[emoji.category] ||= []);

		if (!category.length || last(category).length == 12) category.push([]);

		if (!emoji.unified) return;

		const emojis = last(category);

		emojis.push(unifiedString(emoji.unified));
	});
*/

async function _decodeWebP(buffer: Uint8Array, scaleCount: number) {
	const result = await decodeWebP(buffer, scaleCount).catch(() => null);

	return result;
}

const exposed = {
	decodeWebP: _decodeWebP,
	md5,
	getEmojiPage: async function getEmojiPage(category: keyof typeof categories, page: number) {
		const categoryPlusEmojis = await initEmojis();
		return categoryPlusEmojis[category][page];
	},
	getLastEmojiPage: async function getLastEmojiPage(category: keyof typeof categories) {
		const categoryPlusEmojis = await initEmojis();
		const arr = categoryPlusEmojis[category];
		return arr.length - 1;
	},

	getOptimizedSticker: function getOptimizedSticker(id: string) {
		const result = StickersMap[id as keyof typeof StickersMap];

		return result ? "https://cyan-2048.github.io/kaigram-assets/stickers/" + result : null;
	},

	...rlottie,
};

Comlink.expose(exposed);

export type Exposed = typeof exposed;
