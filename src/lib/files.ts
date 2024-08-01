import { FileLocation, Long } from "@mtcute/core";
import { client } from "@signals";
import Queue from "queue";
import { untrack } from "solid-js/web";
import { simpleHash, sleep } from "./utils";
import localforage from "localforage";
import Deferred from "./Deffered";
import { getPlatform } from "@mtcute/core/platform";
import { TelegramClient } from "@mtcute/web";

const queue = new Queue({
	concurrency: 5,
	autostart: true,
});

const cacheVersion = 1;

const localforageReady = new Deferred<void>();

if ((localStorage.getItem("cache_version") as any) != cacheVersion) {
	localforage.clear().then(() => {
		localforageReady.resolve();
	});
	localStorage.setItem("cache_version", cacheVersion as any);
} else {
	localforageReady.resolve();
}

function hashFile(fileLocation: FileLocation) {
	const location = fileLocation.location;

	if ("uniqueFileId" in fileLocation) {
		return simpleHash(String(fileLocation.uniqueFileId));
	}

	if ("localId" in location) {
		return simpleHash(String(location.localId));
	}

	if ("photoId" in location) {
		const raw = location.photoId;
		const long = new Long(raw.low, raw.high, raw.unsigned);
		return simpleHash(long.toString(36));
	}

	if (fileLocation instanceof Uint8Array) {
		return simpleHash(getPlatform().base64Encode(fileLocation));
	}

	if (typeof location == "function") {
		return hashFile({
			location: location(),
		});
	}

	if ("id" in location) {
		const raw = location.id;
		const long = new Long(raw.low, raw.high, raw.unsigned);
		return simpleHash(location._ + long.toString(36));
	}

	return null;
}

interface DownloadOptions<T = string> {
	timeout: number;
	/**
	 * how many times to retry before stopping
	 */
	retries: number;

	deffered: Deferred<T>;
	buffer: boolean;
	hash: null | number;
}

interface Download<T = string> {
	retry: () => void;
	cancel: () => void;
	result: Promise<T>;
	options?: Partial<DownloadOptions<T>>;
	hash: null | number;
}

const neverEndingPromise = new Promise<never>(() => {});

export const Downloads = new Set<Download<any>>();

function downloadInChunks(tg: TelegramClient, file: FileLocation) {
	tg.downloadAsStream; //
}

export function downloadFile<T = string>(
	file: FileLocation,
	options?: Partial<DownloadOptions<T>>
): Download<T> {
	const tg = untrack(client);
	if (!tg) throw new Error("CLIENT NOT READY");

	let retry = () => {};
	let cancel = () => {};
	const deffered = options?.deffered ?? new Deferred<T>();

	const hash = options?.hash || hashFile(file);

	const current: Download<T> = {
		retry: () => {
			retry();
		},
		cancel: () => {
			cancel();
		},
		result: deffered.promise,
		options: options,
		hash: hash,
	};

	const timeout = typeof options?.timeout == "number";
	let retries = options?.retries ?? 0;

	let cancelled = false;

	queue.push(async () => {
		await localforageReady.promise;

		Downloads.add(current as any);

		const controller = new AbortController();

		cancel = () => {
			cancelled = true;
			controller.abort();
		};

		retry = () => {
			controller.abort();
			const download = downloadFile(file, {
				timeout: options?.timeout,
				retries: Math.max(0, retries - 1),
				deffered: deffered,
				buffer: options?.buffer,
				hash: hash,
			});

			cancel = download.cancel;
			retry = download.retry;
		};

		if (hash) {
			const fromCache = await localforage.getItem<Blob>("file:" + hash);
			if (fromCache) {
				if (options?.buffer) {
					deffered.resolve(new Uint8Array(await fromCache.arrayBuffer()) as any);
				} else {
					deffered.resolve(URL.createObjectURL(fromCache) as any);
				}

				Downloads.delete(current as any);
				return;
			}
		}

		console.log("DOWNLOAD STARTED");

		await sleep(1000);

		const chunks = await Promise.race([
			tg
				.downloadAsBuffer(file, {
					progressCallback: (e, a) => {
						console.log("DOWNLOAD PROGRESS", Math.floor((e / a) * 100));
					},
					abortSignal: controller.signal,
				})
				.catch(() => null),
			timeout ? sleep(options.timeout).then(() => null) : neverEndingPromise,
		]);

		Downloads.delete(current as any);

		if (chunks && !cancelled) {
			const blob = new Blob([chunks]);

			if (hash) {
				await localforage.setItem("file:" + hash, blob);
			}

			if (options?.buffer) {
				deffered.resolve(new Uint8Array(await blob.arrayBuffer()) as any);
			} else {
				deffered.resolve(URL.createObjectURL(blob) as any);
			}

			console.log("FILE DOWNLOAD DONE", file);
		}

		if (chunks === null && retries != 0 && !cancelled) {
			retry();
		}
	});

	return current;
}

let runningCalculate: Promise<number> | null = null;

/**
 * returns all cached files bytes
 */
export function calculateStorageUsage() {
	if (runningCalculate) return runningCalculate;

	let bytes = 0;

	return (runningCalculate = new Promise<number>((res) => {
		localforage.iterate(
			(val, key) => {
				if (val && val instanceof Blob) {
					bytes = bytes + val.size;
				}
			},
			() => {
				res(bytes);
				runningCalculate = null;
			}
		);
	}));
}
