import * as Comlink from "comlink";
import Deferred from "@/lib/Deffered.ts";
import Queue from "queue";

// export * as rlottie from "./rlottie";

import { $proxyMode } from "@stores";

import type { Exposed as TelegramExposed } from "./telegram.ts";
import { TelegramWorkerPort } from "@mtcute/web";
import { apiHash, apiId } from "@/config.ts";

function initTelegramPort() {
	let useWorker = $proxyMode.get() == "none";

	// if mozTCPSocket is not available
	if (!navigator.mozTCPSocket) useWorker = $proxyMode.get() != "sync";

	return useWorker ? new TelegramWorkerPort({ worker: telegramWorker }) : null;
}

const telegramWorker = new Worker(new URL("./telegram.ts", import.meta.url));
const telegramWrapped = Comlink.wrap<TelegramExposed>(telegramWorker);

telegramWrapped.init({
	proxyMode: $proxyMode.get(),
	apiId,
	apiHash,
});

export const telegramPort = initTelegramPort();

export const gunzip = telegramWrapped.gunzip;
export const gzip = telegramWrapped.gzip;
export const webp = telegramWrapped.webp;
export const getAvailableMemory = telegramWrapped.getAvailableMemory;

import type { Exposed as HeavyTasksExposed } from "./heavy-tasks";
import { addToCache, getFileFromCache } from "@/lib/storage";

const wrapped = Comlink.wrap<HeavyTasksExposed>(new Worker(new URL("./heavy-tasks.ts", import.meta.url)));
export const md5 = wrapped.md5;
export const getEmojiPage = wrapped.getEmojiPage;
export const getLastEmojiPage = wrapped.getLastEmojiPage;
export const getOptimizedSticker = wrapped.getOptimizedSticker;

export const rlottie = {
	loadRlottie: wrapped.loadRlottie,
	isCached: wrapped.isCached,
	loadAnimation: wrapped.loadAnimation,
	requestFrame: wrapped.requestFrame,
};

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
for (const key in categories) {
	// @ts-ignore
	categories[categories[key]] = key;
}

const taskQueue = new Queue({
	concurrency: 1,
	autostart: true,
});

export async function processWebpToCanvas(
	canvas: HTMLCanvasElement,
	bufferLike: Uint8Array,
	width: number,
	height: number,
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
		0.75,
	);

	return null;
}
