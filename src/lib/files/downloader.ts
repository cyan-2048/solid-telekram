import localforage from "localforage";

async function clearCacheLocalforage() {
	await localforage.clear();
}

export async function clearCache() {
	await clearCacheLocalforage();
}

export interface Downloader {
	/**return Blob early when it's already in cache */
	append(a: BlobPart): Promise<undefined | Blob>;
	finalize(): Promise<Blob>;
	cancel(): Promise<undefined>;

	readonly finalized: boolean;
}

function createDownloaderLocalForage(hash: string | number): Downloader {
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
				await localforage.removeItem(temp_filename);
				init = true;

				const fileCached = await localforage.getItem<Blob>(filename);

				if (fileCached) {
					finalized = true;
					return (blobFinalizeEarly = fileCached);
				}
			}

			const blob = await localforage.getItem<Blob>(temp_filename);
			await localforage.removeItem(temp_filename);

			if (blob) {
				await localforage.setItem(temp_filename, new Blob([blob, a]));
				return;
			}

			await localforage.setItem(temp_filename, new Blob([a]));
		},

		async finalize() {
			if (blobFinalizeEarly) return blobFinalizeEarly;
			if (finalized) throw new Error("Can only finalize once.");

			const blob = await localforage.getItem<Blob>(temp_filename);
			await localforage.removeItem(temp_filename);
			await localforage.setItem(filename, blob);
			finalized = true;
			return blob!;
		},

		async cancel() {
			if (finalized) return;
			await localforage.removeItem(temp_filename);
		},
	};
}

function getFileFromCacheLocalforage(hash: string | number) {
	const filename = "file:" + hash;
	return localforage.getItem<Blob>(filename);
}

async function addToCacheLocalforage(hash: string | number, ...buffer: BlobPart[]) {
	const filename = "file:" + hash;
	await localforage.setItem(filename, new Blob(buffer));
	return localforage.getItem<Blob>(filename);
}

export async function addToCache(hash: string | number, ...buffer: BlobPart[]) {
	return addToCacheLocalforage(hash, ...buffer);
}

export async function getFileFromCache(hash: string | number) {
	return getFileFromCacheLocalforage(hash);
}

export async function createDownloader(hash: string | number): Promise<Downloader> {
	return createDownloaderLocalForage(hash);
}
