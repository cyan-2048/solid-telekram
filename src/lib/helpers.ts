export function capitalizeFirstLetter(string: string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 *
 * @param ms if not passed with a number, use this as a cheap queueMicrotask
 * @returns
 */
export function sleep(ms: void | number) {
	if (ms === undefined) {
		return Promise.resolve();
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
