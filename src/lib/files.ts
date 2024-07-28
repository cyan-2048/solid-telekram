import { FileLocation, Long } from "@mtcute/core";
import { client } from "@signals";
import Queue from "queue";
import { untrack } from "solid-js/web";
import { simpleHash, sleep } from "./utils";
import localforage from "localforage";
import Deferred from "./Deffered";
import { toUniqueFileId } from "@mtcute/file-id";
import { getPlatform } from "@mtcute/core/platform";

const queue = new Queue({
	concurrency: 5,
	autostart: true,
});

function hashFile(location: FileLocation["location"]) {
	if ("localId" in location) {
		return simpleHash(String(location.localId));
	}

	if ("photoId" in location) {
		const raw = location.photoId;
		const long = new Long(raw.low, raw.high, raw.unsigned);
		return simpleHash(long.toString(36));
	}

	if (location instanceof Uint8Array) {
		return simpleHash(Buffer.from(location).toString("base64"));
	}

	if (typeof location == "function") {
		return hashFile(location());
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

	/**
	 * @internal
	 * @private
	 */
	deffered: Deferred<T>;
	buffer: boolean;
}

interface Download<T = string> {
	retry: () => void;
	cancel: () => void;
	result: Promise<T>;
	options?: Partial<DownloadOptions>;
}

const neverEndingPromise = new Promise<never>(() => {});

export const Downloads = new Set<Download<any>>();

export function downloadFile<T = string>(
	file: FileLocation,
	options?: Partial<DownloadOptions<T>>
): Download<T> {
	const tg = untrack(client);
	if (!tg) throw new Error("CLIENT NOT READY");

	let retry = () => {};
	let cancel = () => {};
	const deffered = options?.deffered ?? new Deferred<T>();

	const current = {
		retry: () => {
			retry();
		},
		cancel: () => {
			cancel();
		},
		result: deffered.promise,
		options: options,
	};

	const timeout = typeof options?.timeout == "number";
	let retries = options?.retries ?? 0;

	const hash = hashFile(file.location);

	let cancelled = false;

	queue.push(async () => {
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
						// console.log("DOWNLOAD PROGRESS", Math.floor((e / a) * 100));
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

	return current as any;
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
