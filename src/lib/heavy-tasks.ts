import HeavyTasksWorker from "./heavy-tasks.worker?worker";
import * as Comlink from "comlink";
import type { Exposed } from "./heavy-tasks.worker";
// import webp2png from "./webp/ezgif-webp2png";
import Queue from "queue";
import { sleep } from "./helpers";
import { addToCache, getFileFromCache } from "./files/downloader";
import Deferred from "./Deffered";
import { webp } from "./telegram";

const wrapped = Comlink.wrap<Exposed>(new HeavyTasksWorker());

export const enum EmojiCategory {
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

Object.entries(categories).forEach((e) => {
	// @ts-ignore
	categories[e[1]] = e[0];
});

function convertToJpegBlob(_canvas: HTMLCanvasElement, width: number, height: number) {
	return new Promise<Blob>((resolve) => {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = 2 * height;

		const canvasCtx = canvas.getContext("2d", { willReadFrequently: !0 })!;
		// resize code?
		canvasCtx.drawImage(_canvas, 0, 0, width, height);
		const imgData = canvasCtx.getImageData(0, 0, width, 2 * height);
		const s = width * height * 4;

		for (let o = 0; o < s; o += 4) {
			imgData.data[s + o] = imgData.data[o + 3];
			imgData.data[s + o + 1] = imgData.data[o + 3];
			imgData.data[s + o + 2] = imgData.data[o + 3];
			imgData.data[s + o + 3] = imgData.data[o + 3];
		}

		canvasCtx.putImageData(imgData, 0, 0);
		canvas.toBlob(
			(blob) => {
				resolve(blob!);
			},
			"image/jpeg",
			0.8
		);
	});
}

export const md5 = wrapped.md5;
export const getEmojiPage = wrapped.getEmojiPage;
export const getLastEmojiPage = wrapped.getLastEmojiPage;
export const getOptimizedSticker = wrapped.getOptimizedSticker;
export { gzip, gunzip } from "./telegram";

const taskQueue = new Queue({
	concurrency: 1,
	autostart: true,
});

export default async function processWebpToCanvas(
	canvas: HTMLCanvasElement,
	bufferLike: Uint8Array,
	width: number,
	height: number
) {
	console.warn(`WebP: processing webp as device doesn't support Webp natively`);

	const hash = await md5(bufferLike);
	const filename = "sticker-" + hash;

	const deferred = new Deferred<void>();

	const fromCache = await new Promise<Blob | null>((res) => {
		taskQueue.push(async () => {
			res(getFileFromCache(filename));
			// we wait until this current task is finished;
			await deferred.promise;
		});
	});

	if (fromCache) {
		deferred.resolve();
		return fromCache;
	}

	let result = await wrapped.decodeWebP(bufferLike, 1);
	//
	// console.error("LIBWEBPJS RESULT", result ? result.rgba.byteLength : null);

	// if (result instanceof Uint8Array) {
	// 	console.error("libwebpjs doesn't work using ezgif to convert to png");
	//
	// 	const webpFromEzgif = await webp2png(result).catch(() => null);
	// 	if (webpFromEzgif) {
	// 		const file = await addToCache(filename, webpFromEzgif);
	// 		deferred.resolve();
	// 		return file;
	// 	}
	// 	return null;
	// }

	if (!result) {
		// we only use this if it is really necessary!
		// we don't want to have OOMs in the backbone of this app lmao
		console.error("libwebpjs didn't work, using libwebp asm.js");

		result = await webp(bufferLike, width, height);

		if (!result) {
			console.error("asm.js libwebp didn't work as well!!!");
			deferred.resolve();
			return null;
		}
	}

	performance.now();
	canvas.width = result.width;
	canvas.height = result.height;
	const imageData = new ImageData(new Uint8ClampedArray(result.rgba), result.width, result.height);

	canvas.getContext("2d")!.putImageData(imageData, 0, 0);

	canvas.toBlob(
		async (blob) => {
			if (blob) {
				await addToCache(filename, blob);
				deferred.resolve();
			}
		},
		"image/png",
		1
	);

	return null;
}
