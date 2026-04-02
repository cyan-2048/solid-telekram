import localforage from "localforage";
import { Downloader } from "./types";

const store = localforage.createInstance({ name: "cache" });

export async function clearCache() {
	await store.clear();
}

export function createDownloader(hash: string | number): Downloader {
	const filename = "file:" + hash;
	const temp_filename = "_" + filename;

	let init = false;
	let finalized = false;

	let blobFinalizeEarly: Blob;

	return {
		get finalized() {
			return finalized;
		},

		async append(a) {
			if (finalized) return;

			if (!init) {
				await store.removeItem(temp_filename);
				init = true;

				const fileCached = await store.getItem<Blob>(filename);

				if (fileCached) {
					finalized = true;
					return (blobFinalizeEarly = fileCached);
				}
			}

			const blob = await store.getItem<Blob>(temp_filename);
			await store.removeItem(temp_filename);

			if (blob) {
				await store.setItem(temp_filename, new Blob([blob, a]));
				return;
			}

			await store.setItem(temp_filename, new Blob([a]));
		},

		async finalize() {
			if (blobFinalizeEarly) return blobFinalizeEarly;
			if (finalized) throw new Error("Can only finalize once.");

			const blob = await store.getItem<Blob>(temp_filename);
			await store.removeItem(temp_filename);
			await store.setItem(filename, blob);
			finalized = true;
			return blob!;
		},

		async cancel() {
			if (finalized) return;
			await store.removeItem(temp_filename);
		},
	};
}

export function getFileFromCache(hash: string | number) {
	const filename = "file:" + hash;
	return store.getItem<Blob>(filename);
}

export async function addToCache(hash: string | number, ...buffer: BlobPart[]) {
	const filename = "file:" + hash;
	await store.setItem(filename, new Blob(buffer));
	return store.getItem<Blob>(filename);
}
