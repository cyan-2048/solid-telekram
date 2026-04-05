import type { FileLocation } from "@mtcute/core";
import { simpleHash, sleep } from "@utils";
import { EventEmitter } from "tseep";
import * as fromLocalForage from "./localforage";
import * as fromDevice from "./device";
import * as fromCaches from "./caches";
import { deleteAuthkeyByDC, tg } from "@globals";
import Deferred from "../Deffered";
import type { tl } from "@mtcute/core";
import type { Downloader } from "./types";
import { $storage } from "@stores";

function switchStorage() {
	const storage = $storage.get();
	switch (storage) {
		case "caches":
			return fromCaches;
		case "device":
			return fromDevice;
		case "localforage":
			return fromLocalForage;
	}
}

export function getFileFromCache(hash: string | number) {
	return switchStorage().getFileFromCache(hash);
}
export function createDownloader(hash: string | number): Downloader {
	return switchStorage().createDownloader(hash);
}
export function addToCache(hash: string | number, ...buffer: BlobPart[]) {
	return switchStorage().addToCache(hash, ...buffer);
}

export function clearCache() {
	const storages = [fromLocalForage, fromDevice, fromCaches] as const;

	return Promise.all(storages.map((a) => a.clearCache())).then(() => {});
}

type RpcError = tl.RpcError;

function hashFile(fileLocation: FileLocation) {
	const location = fileLocation.location;
	// let's hope this works haha
	if ("uniqueFileId" in fileLocation) {
		return simpleHash(String(fileLocation.uniqueFileId));
	}

	if ("geoPoint" in location) {
		let str = "";

		str += location.w;
		str += location.h;
		str += location.scale;
		str += location.zoom;
		if ("lat" in location.geoPoint) {
			str += location.geoPoint.lat;
			str += location.geoPoint.long;
		}

		return simpleHash(str);
	}

	if ("photoId" in location) {
		// doesn't seem to be accurate?
		// if ("localId" in location) {
		// 	return simpleHash(String(location.localId));
		// }

		const long = location.photoId;
		return simpleHash(long.toString(36));
	}

	// RAM USAGE????
	// if (fileLocation instanceof Uint8Array) {
	// 	return simpleHash(getPlatform().base64Encode(fileLocation));
	// }

	// no
	// if (typeof location == "function") {
	// 	return hashFile({
	// 		location: location(),
	// 	});
	// }

	if ("id" in location) {
		const long = location.id;
		return simpleHash(location._ + long.toString(36));
	}

	return null;
}

const EE = new EventEmitter<{
	tick(): void;
}>();

function tick() {
	setTimeout(() => {
		EE.emit("tick");
		// console.info("DOWNLOAD QUEUE", cacheMap.size, pending.size, queue.size);
	}, 0);
}

// cached downloads
const cacheMap = new Map<number | string, Download>();

// should only be 5, downloads currently downloading
const queue = new Map<number | string, Download>();

// can be any size, this includes downloads that have not started
const pending = new Map<number | string, Download>();

EE.on("tick", () => {
	for (const _ of queue.values()) {
		if (_.state == "aborted" || _.state == "aborting" || _.state == "done") {
			queue.delete(_.hash);
		}
	}

	if (queue.size < 5) {
		for (const [hash, _] of pending.entries()) {
			pending.delete(hash);
			queue.set(hash, _);

			if (queue.size == 5) {
				break;
			}
		}
	}

	for (const _ of queue.values()) {
		if (_.state == "idle") {
			_.start();
		}
	}
});

type DownloadState = "idle" | "started" | "downloading" | "aborting" | "aborted" | "done";

export class Download extends EventEmitter<{
	state: (e: DownloadState) => void;
	progress: (num: number) => void;
	done: (blob: Blob | null) => void;
}> {
	downloader?: Downloader;

	aborted = false;

	result!: Blob;

	state: DownloadState = "idle";

	private abortController = new AbortController();

	deffered = new Deferred();

	private emitStateChange() {
		this.emit("state", this.state);
	}

	/**
	 * Number 0 - 100
	 */
	progress = 0;

	private set _state(val: DownloadState) {
		this.state = val;
		if (val == "aborting") {
			this.abortController.abort();
		}

		if (val == "aborted") {
			this.emit("done", null);
		}

		if (val == "done") {
			cacheMap.set(this.hash, this);
			this.emit("done", this.result);
			tick();
		}

		this.emitStateChange();
	}

	constructor(
		public hash: number | string,
		public location: FileLocation,
	) {
		super();
	}

	catch(cb: Parameters<Promise<any>["catch"]>[0]): ReturnType<Promise<any>["catch"]> {
		return this.deffered.promise.catch(cb);
	}

	async start() {
		if (this.aborted) return;
		if (this.state == "done") return;

		this._state = "started";

		await sleep(50);

		const cached = await getFileFromCache(this.hash);

		if (cached) {
			this.result = cached;
			this._state = "done";
			return;
		}

		const download = (this.downloader = createDownloader(this.hash));

		try {
			const iterable = tg.downloadAsIterable(this.location, {
				abortSignal: this.abortController.signal,
				progressCallback: (downloaded, _total) => {
					const total = (Number.isFinite(_total) ? _total : this.location.fileSize) || 0;
					if (total) {
						this.emit("progress", (this.progress = Math.floor((downloaded / total) * 100)));
					}

					console.error("progress", downloaded, total, Math.floor((downloaded / total) * 100));
				},
			});

			for await (const chunk of iterable) {
				this._state = "downloading";
				const res = await download.append(chunk as Uint8Array<ArrayBuffer>);
				if (res) {
					this.result = res;
					this._state = "done";
					return;
				}
			}
		} catch (e) {
			if (this.state == "aborting" || this.state == "aborted") return;
			const error = e as RpcError;

			console.error("ERROR OCCURED WHEN DOWNLOADING FILE", this.location, e);
			if (e && typeof e == "object" && "is" in e) {
				const revokedKey =
					error.is("SESSION_REVOKED") ||
					// it seems like CHANNEL_INVALID also occurs when the auth key used is revoked?
					error.is("CHANNEL_INVALID");

				if (revokedKey) {
					const revokedDcID = this.location.dcId;

					console.error("DC " + revokedDcID + " auth key revoked while downloading.");

					if (revokedDcID) {
						await deleteAuthkeyByDC(revokedDcID);
					}
				}
			}
			this.abort();
			this.deffered.reject(e);
			return;
		}

		this.result = await download.finalize();
		this.emit("progress", (this.progress = 100));

		await sleep(50);

		this._state = "done";
	}

	async abort() {
		if (this.state == "done") return;
		this.aborted = true;
		this._state = "aborting";
		await this.downloader?.cancel();
		this._state = "aborted";
		tick();
	}
}

// function createDummyDownload(hash: number | string, file: FileLocation ,blob: Blob) {
//   const download = new Download(hash, file)
//   download.result = blob;
//   download.state = "done";
//   return download;
// }

export function downloadFile(file: FileLocation) {
	const hash = hashFile(file);

	if (hash === null) {
		console.error("HASH FAILED FOR FILE", file);
		throw new Error("HASH FAILED");
	}

	const hasStarted = cacheMap.get(hash) || pending.get(hash) || queue.get(hash);

	if (hasStarted && hasStarted.state != "aborting" && hasStarted.state != "aborted") return hasStarted;

	const download = new Download(hash, file);

	pending.set(hash, download);
	tick();

	return download;
}
