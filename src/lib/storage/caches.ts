// use window.caches

import type { Downloader } from "./types";

const CACHE_NAME = "files-cache-v1";
const PATH_PREFIX = "/offline-files/";

let _cache = caches.open(CACHE_NAME);

export async function clearCache() {
	await caches.delete(CACHE_NAME);
	_cache = caches.open(CACHE_NAME);
	await _cache;
}

export function createDownloader(hash: string | number): Downloader {
	const url = PATH_PREFIX + hash;
	const temp_url = PATH_PREFIX + "_" + url;

	let init = false;
	let finalized = false;

	let blobFinalizeEarly: Blob;

	async function getTempFile() {
		const cache = await _cache;
		return cache
			.match(temp_url)
			.then((a) => a?.blob() || null)
			.catch(() => null);
	}

	return {
		get finalized() {
			return finalized;
		},

		async append(a) {
			if (finalized) return;
			const cache = await _cache;

			if (!init) {
				await cache.delete(temp_url);
				init = true;

				const fileCached = await getFileFromCache(hash);

				if (fileCached) {
					finalized = true;
					return (blobFinalizeEarly = fileCached);
				}
			}

			const blob = await getTempFile();
			await cache.delete(temp_url);

			if (blob) {
				await cache.put(temp_url, new Response(new Blob([blob, a])));
				return;
			}

			await cache.put(temp_url, new Response(new Blob([a])));
			return;
		},

		async finalize() {
			if (blobFinalizeEarly) return blobFinalizeEarly;
			if (finalized) throw new Error("Can only finalize once.");
			const cache = await _cache;

			const blob = await getTempFile();
			// await store.removeItem(temp_url);
			await cache.delete(temp_url);
			// await store.setItem(url, blob);
			await cache.put(url, new Response(blob!));
			finalized = true;
			return blob!;
		},

		async cancel() {
			if (finalized) return;
			const cache = await _cache;
			await cache.delete(temp_url);
		},
	};
}

export async function getFileFromCache(hash: string | number) {
	const url = PATH_PREFIX + hash;
	const cache = await _cache;
	return cache
		.match(url)
		.then((a) => a?.blob() || null)
		.catch(() => null);
}

export async function addToCache(hash: string | number, ...buffer: BlobPart[]) {
	const url = PATH_PREFIX + hash;
	const cache = await _cache;

	await cache.put(url, new Response(new Blob(buffer)));
	return cache
		.match(url)
		.then((a) => a?.blob() || null)
		.catch(() => null);
}
