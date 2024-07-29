// worker for heavy tasks, use comlink
import * as Comlink from "comlink";
import decodeWebP from "./webp/whatsapp_webp";
import _emojidata from "emoji-datasource/emoji.json";

const emojidata = _emojidata;

// @ts-ignore
import SparkMD5 from "spark-md5";

function emojiFromCodePoints(codePoints: string) {
	return codePoints
		.split("-")
		.reduce((prev, curr) => prev + String.fromCodePoint(parseInt(curr, 16)), "");
}

export function unifiedString(str: string) {
	return emojiFromCodePoints(str);
}

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
	const e = SparkMD5.ArrayBuffer.hash(buffer);
	return e as string;
}

const categoryPlusEmojis: Record<any, string[][]> = {};

function last<T>(arr: T[]) {
	return arr[arr.length - 1];
}

emojidata.forEach((emoji) => {
	const category = (categoryPlusEmojis[emoji.category] ||= []);

	if (!category.length || last(category).length == 12) category.push([]);

	if (!emoji.unified) return;

	const emojis = last(category);

	// prefer non variation emojis
	emojis.push(unifiedString(emoji.unified));
});

Object.entries(categoryPlusEmojis).forEach((e) => {
	// @ts-ignore
	if (typeof categories[e[0]] != "undefined") categoryPlusEmojis[categories[e[0]]] = e[1];
});

console.log(categoryPlusEmojis);

async function _decodeWebP(buffer: Uint8Array, scaleCount: number) {
	const result = await decodeWebP(buffer, scaleCount).catch(() => null);

	if (result === null) {
		return Comlink.transfer(buffer, [buffer.buffer]);
	}

	return result;
}

const exposed = {
	decodeWebP: _decodeWebP,
	md5,
	getEmojiPage(category: keyof typeof categories, page: number) {
		return categoryPlusEmojis[category][page];
	},
	getLastEmojiPage(category: keyof typeof categories) {
		const arr = categoryPlusEmojis[category];
		return arr.length - 1;
	},
};

Comlink.expose(exposed);

export type Exposed = typeof exposed;