import localforage from "localforage";
import { sleep } from "../helpers";

const systemStorage: DeviceStorage =
	navigator.b2g?.getDeviceStorage("sdcard") || navigator.getDeviceStorage?.("sdcard");

const resolveRoot = new Promise<Directory | null>((res) => {
	res(systemStorage?.getRoot().catch(() => null) || null);
});

const kaigramFolder = (async function getKaigramFolder() {
	try {
		const root = await resolveRoot;
		if (!root) return null as any as Directory;

		const files = await root.getFilesAndDirectories().catch(() => null);

		const result = files?.find((a) => a.name == "kaigram");

		if (!result) {
			return root.createDirectory("kaigram");
		}

		if ("path" in result) {
			return result;
		}

		await deleteKaigramFolder();

		return root.createDirectory("kaigram").catch(() => null as any as Directory);
	} catch {
		return null as any as Directory;
	}
})();

const useLocalforage = Boolean(!systemStorage);

async function deleteKaigramFolder() {
	const root = await resolveRoot;
	await root?.removeDeep("kaigram").catch(() => null);
}

async function clearCacheStorage() {
	await deleteKaigramFolder();
}

async function clearCacheLocalforage() {
	await localforage.clear();
}

export async function clearCache() {
	await (useLocalforage ? clearCacheLocalforage() : clearCacheStorage());
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

function createDownloaderStorage(hash: string | number): Downloader {
	const filename = hash + ".tgcache";
	const temp_filename = "_" + filename;

	let init = false;
	let finalized = false;

	let blobFinalizeEarly: Blob;

	let kaigramCache: Directory;

	return {
		get finalized() {
			return finalized;
		},

		async append(a) {
			if (finalized) return;

			kaigramCache ||= await kaigramFolder;

			if (!init) {
				await kaigramCache.removeDeep(temp_filename);
				init = true;

				const fileCached = await systemStorage
					.get("kaigram/" + filename)
					.then((a) => a)
					.catch(() => null);

				if (fileCached) {
					finalized = true;

					return (blobFinalizeEarly = fileCached);
				}

				await systemStorage
					.addNamed(new Blob([]), "kaigram/" + temp_filename)
					.then((a) => a)
					.catch(() => null);
			}

			await sleep(1);

			await systemStorage
				.appendNamed(new Blob([a]), "kaigram/" + temp_filename)
				.then((a) => a)
				.catch(() => null);
		},

		async finalize() {
			if (blobFinalizeEarly) return blobFinalizeEarly;
			if (finalized) throw new Error("Can only finalize once!!");

			kaigramCache ||= await kaigramFolder;

			await kaigramCache.renameTo(temp_filename, filename).catch(() => null);
			finalized = true;

			await sleep(1);

			return systemStorage
				.get("kaigram/" + filename)
				.then((a) => a)
				.catch(() => null as never);
		},

		async cancel() {
			kaigramCache ||= await kaigramFolder;

			if (finalized) return;
			await sleep(1);
			await kaigramCache.removeDeep(temp_filename).catch(() => null as never);
		},
	};
}

async function getFileFromCacheStorage(hash: string | number) {
	await kaigramFolder;
	await sleep(50);
	const filename = hash + ".tgcache";
	return systemStorage
		.get("kaigram/" + filename)
		.then((a) => a)
		.catch(() => null);
}

function getFileFromCacheLocalforage(hash: string | number) {
	const filename = "file:" + hash;
	return localforage.getItem<Blob>(filename);
}

async function addToCacheStorage(hash: string | number, ...buffer: BlobPart[]) {
	await kaigramFolder;
	const filename = hash + ".tgcache";
	await systemStorage
		.addNamed(new Blob(buffer), "kaigram/" + filename)
		.then((a) => a)
		.catch(() => null);
	await sleep(50);
	return systemStorage
		.get("kaigram/" + filename)
		.then((a) => a)
		.catch(() => null);
}

async function addToCacheLocalforage(hash: string | number, ...buffer: BlobPart[]) {
	const filename = "file:" + hash;
	await localforage.setItem(filename, new Blob(buffer));
	return localforage.getItem<Blob>(filename);
}

export function addToCache(hash: string | number, ...buffer: BlobPart[]) {
	return useLocalforage ? addToCacheLocalforage(hash, ...buffer) : addToCacheStorage(hash, ...buffer);
}

export function getFileFromCache(hash: string | number) {
	return useLocalforage ? getFileFromCacheLocalforage(hash) : getFileFromCacheStorage(hash);
}

export function createDownloader(hash: string | number): Downloader {
	return useLocalforage ? createDownloaderLocalForage(hash) : createDownloaderStorage(hash);
}
