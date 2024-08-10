import { FileLocation } from "@mtcute/core";
import { simpleHash, sleep } from "../utils";
import EventEmitter from "eventemitter3";
import { createDownloader, Downloader, getFileFromCache } from "./downloader";
import { TelegramClient } from "@mtcute/web";
import { client } from "@signals";

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

const cacheMap = new Map<number | string, Download>();

// can be any size
const pending = new Map<number | string, Download>();

// should only be 5
const queue = new Map<number | string, Download>();

EE.on("tick", () => {
	for (const _ of queue.values()) {
		if (_.state == "aborted" || _.state == "done") {
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

class Download extends EventEmitter<{
	state: (e: DownloadState) => void;
	progress: (num: number) => void;
	done: (blob: Blob | null) => void;
}> {
	downloader?: Downloader;

	tg: TelegramClient;

	aborted = false;

	result!: Blob;

	state: DownloadState = "idle";

	private abortController = new AbortController();

	private emitStateChange() {
		this.emit("state", this.state);
	}

	/**
	 * Number 0 - 1
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

	constructor(public hash: number | string, public location: FileLocation) {
		super();

		this.tg = client()!;
		if (!this.tg) throw new Error("Telegram not initialized properly!");
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

		for await (const chunk of this.tg.downloadAsIterable(this.location, {
			abortSignal: this.abortController.signal,
			progressCallback: (downloaded, _total) => {
				const total = (Number.isFinite(_total) ? _total : this.location.fileSize) || 0;
				if (total) {
					this.emit("progress", (this.progress = Math.floor((downloaded / total) * 100)));
				}

				// console.error("progress", downloaded, total, Math.floor((downloaded / total) * 100));
			},
		})) {
			this._state = "downloading";
			const res = await download.append(chunk);
			if (res) {
				this.result = res;
				this._state = "done";
				return;
			}
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

	if (cacheMap.has(hash)) {
		return cacheMap.get(hash)!;
	}

	if (pending.has(hash)) {
		return pending.get(hash)!;
	}

	if (queue.has(hash)) {
		return queue.get(hash)!;
	}

	const download = new Download(hash, file);

	pending.set(hash, download);
	tick();

	return download;
}
