import { sleep } from "@utils";
import type { Downloader } from "./types";

const systemStorage = navigator.b2g?.getDeviceStorage("sdcard") || navigator.getDeviceStorage?.("sdcard");

const resolveRoot = Promise.resolve(systemStorage?.getRoot().catch(() => null) || null);

async function getKaigramFolder() {
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

		await clearCache();

		// let's wait for a bit
		await Promise.resolve();

		return root.createDirectory("kaigram").catch(() => null as any as Directory);
	} catch {}

	return null as any as Directory;
}

const kaigramFolder = getKaigramFolder();

let supported = false;

const asyncSupported = kaigramFolder.then((a) => {
	return (supported = !!a);
});

export function isDeviceStorageSupported() {
	return supported;
}

export function isDeviceStorageSupportedAsync() {
	return asyncSupported;
}

export async function clearCache() {
	const root = await resolveRoot;
	await root?.removeDeep("kaigram").catch(() => null);
}

export async function addToCache(hash: string | number, ...buffer: BlobPart[]) {
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

export async function getFileFromCache(hash: string | number) {
	await kaigramFolder;
	await sleep(50);
	const filename = hash + ".tgcache";
	return systemStorage
		.get("kaigram/" + filename)
		.then((a) => a)
		.catch(() => null);
}

export function createDownloader(hash: string | number): Downloader {
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
					.catch((error) => {
						console.error("DeviceStorage error", error);
						return null;
					});
			}

			await sleep(1);

			await systemStorage
				.appendNamed(new Blob([a]), "kaigram/" + temp_filename)
				.then((a) => a)
				.catch((error) => {
					console.error("DeviceStorage error", error);
					return null;
				});
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
				.catch((error) => {
					console.error("DeviceStorage error", error);
					// ehhh
					return new Blob([]);
				});
		},

		async cancel() {
			kaigramCache ||= await kaigramFolder;

			if (finalized) return;
			await sleep(1);
			await kaigramCache.removeDeep(temp_filename).catch(() => null);
		},
	};
}
