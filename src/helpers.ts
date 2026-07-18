import type { Peer } from "@mtcute/core";

export function capitalizeFirstLetter(string: string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

export const NOOP = () => {};

const neverResolvingPromise = new Promise<void>(NOOP);

/**
 *
 * @param ms if not passed with a number, use this as a cheap queueMicrotask, if passed with infinity returns a promise that never resolves
 * @returns
 */
export function sleep(ms: void | number) {
	if (ms === undefined) {
		return Promise.resolve();
	}

	if (!Number.isFinite(ms)) {
		return neverResolvingPromise;
	}

	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const cyrb53 = (str: string, seed = 0) => {
	let h1 = 0xdeadbeef ^ seed,
		h2 = 0x41c6ce57 ^ seed;
	for (let i = 0, ch; i < str.length; i++) {
		ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

export function last<T = any>(arr: T[]) {
	return arr[arr.length - 1];
}

// A simple, *insecure* 32-bit hash that's short, fast, and has no dependencies.
// Output is always 7 characters.
// Loosely based on the Java version; see
// https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
export const simpleHash = (str: string) => {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
	}
	// Convert to 32bit unsigned integer in base 36 and pad with "0" to ensure length is 7.
	return hash >>> 0;
};

export function clampImageDimension(imageHeight: number, imageWidth: number, maxHeight: number, maxWidth: number) {
	// Calculate which adjustment is the smallest, width or height
	// otherwise we'd overflow one of them.
	const widthPercent = maxWidth / imageWidth;
	const heightPercent = maxHeight / imageHeight;
	const smallestPercent = Math.min(widthPercent, heightPercent);

	// This works for both scaling up and scaling down
	return {
		w: imageWidth * smallestPercent,
		h: imageHeight * smallestPercent,
	};
}

export function calculateSampleSize(origWidth: number, origHeight: number, newWidth: number, newHeight: number) {
	const widthDivisor = origWidth / newWidth;
	const heightDivisor = origHeight / newHeight;
	return "#-moz-samplesize=" + Math.ceil(Math.max(widthDivisor, heightDivisor));
}

export function formatTime(seconds: number) {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.round(seconds % 60);
	const t = [h, m > 9 ? m : h ? "0" + m : m || "0", s > 9 ? s : "0" + s].filter(Boolean).join(":");
	return seconds < 0 && seconds ? `-${t}` : t;
}

export function isToday(date: Date, today = new Date()) {
	return (
		date.getDate() == today.getDate() &&
		date.getMonth() == today.getMonth() &&
		date.getFullYear() == today.getFullYear()
	);
}

export async function Array_from_DOMCursor<T>(cursor: DOMCursor<T>): Promise<T[]> {
	const arr: T[] = [];

	return new Promise((res, err) => {
		cursor.onsuccess = function () {
			if (cursor.result) {
				arr.push(cursor.result);
				cursor.continue();
			} else {
				res(arr);
			}
		};

		cursor.onerror = function () {
			err(cursor.error);
		};
	});
}

export function isPromise<T>(thing: any): thing is Promise<T> {
	return typeof thing == "object" && "then" in thing;
}

/**
 * resolve synchronously if possible!
 */
export function resolveSync<T, U>(thing: Promise<T> | T, callback: (a: T) => U) {
	return isPromise(thing) ? thing.then(callback) : callback(thing);
}

/**
 *
 * color utils taken from tweb
 */

type ColorRgba = [number, number, number, number];

export function hexaToRgba(hexa: string) {
	const arr: ColorRgba = [] as any;
	const offset = hexa[0] === "#" ? 1 : 0;
	if (hexa.length === 5 + offset) {
		hexa = (offset ? "#" : "") + "0" + hexa.slice(offset);
	}

	if (hexa.length === 3 + offset) {
		for (let i = offset; i < hexa.length; ++i) {
			arr.push(parseInt(hexa[i] + hexa[i], 16));
		}
	} else if (hexa.length === 4 + offset) {
		for (let i = offset; i < hexa.length - 1; ++i) {
			arr.push(parseInt(hexa[i] + hexa[i], 16));
		}

		arr.push(parseInt(hexa[hexa.length - 1], 16));
	} else {
		for (let i = offset; i < hexa.length; i += 2) {
			arr.push(parseInt(hexa.slice(i, i + 2), 16));
		}
	}

	return arr;
}

type ColorHsla = {
	h: number;
	s: number;
	l: number;
	a: number;
};

/**
 * @returns h [0, 360], s [0, 100], l [0, 100], a [0, 1]
 */
export function rgbaToHsla(r: number, g: number, b: number, a: number = 1): ColorHsla {
	(r /= 255), (g /= 255), (b /= 255);
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h!: number, s!: number;
	const l = (max + min) / 2;

	if (max === min) {
		h = s = 0; // achromatic
	} else {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return {
		h: h * 360,
		s: s * 100,
		l: l * 100,
		a,
	};
}

export function hexaToHsla(hexa: string) {
	const rgba = hexaToRgba(hexa);
	return rgbaToHsla(rgba[0], rgba[1], rgba[2], rgba[3]);
}

export type RawPeer = Peer["raw"];

function getPeerColorIndexById(peerId: number) {
	return Math.abs(peerId) % 7;
}

const DialogColorsFg: Array<string[]> = [
		["#CC5049"],
		["#D67722"],
		["#955CDB"],
		["#40A920"],
		["#309EBA"],
		["#368AD1"],
		["#C7508B"],
	],
	DialogColors = ["red", "orange", "violet", "green", "cyan", "blue", "pink"] as const;

export function getColorFromPalette(idx: number) {
	return DialogColors[getPeerColorIndexById(idx)] || "blue";
}

export function getColorFromPeer(peer: RawPeer) {
	if (!peer) return "blue";

	const assertColor = (color?: number) => (color ? color != -1 && color : false);

	let idx =
		"color" in peer && peer.color && "color" in peer.color
			? assertColor(peer.color?.color) || getPeerColorIndexById(peer.id)
			: getPeerColorIndexById(peer.id);

	let color = DialogColors[idx];

	if (!color) {
		const fgColor = DialogColorsFg[idx];
		if (!fgColor) {
			return DialogColors[getPeerColorIndexById(peer.id)];
		}

		const hsla = hexaToHsla(fgColor[0]);
		const hue = hsla.h;

		if (hue >= 345 || hue < 29)
			idx = 0; // red
		else if (hue < 67)
			idx = 1; // orange
		else if (hue < 140)
			idx = 3; // green
		else if (hue < 199)
			idx = 4; // cyan
		else if (hue < 234)
			idx = 5; // blue
		else if (hue < 301)
			idx = 2; // violet
		else idx = 6; // pink

		color = DialogColors[idx];
	}

	return color;
}

export function inColumns<T>(arr: T[], count: number): T[][] {
	return Array.from(Array(count).keys(), (c) => arr.filter((_, i) => i % count === c));
}

const units = ["bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

export function niceBytes(x: number) {
	let l = 0,
		n = x || 0;

	while (n >= 1024 && ++l) {
		n = n / 1024;
	}

	return n.toFixed(n < 10 && l > 0 ? 1 : 0) + " " + units[l];
}
