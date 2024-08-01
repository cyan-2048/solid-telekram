import "core-js/actual/symbol";
import "./abort-controller.js";

const apiId = import.meta.env.VITE_APP_ID;
const apiHash = import.meta.env.VITE_APP_HASH;

Object.defineProperty(self.navigator, "onLine", {
	get: () => true,
});

import {
	BaseStorageDriver,
	BaseTelegramClient,
	IMtStorageProvider,
	IPeersRepository,
	ITelegramStorageProvider,
	MemoryStorageDriver,
	TelegramWorker,
} from "@mtcute/web";
import { sleep } from "./utils.js";
import parseUserAgent from "./parseUserAgent.js";
import { MemoryKeyValueRepository } from "@mtcute/core/storage/memory/repository/kv.js";
import { MemoryAuthKeysRepository } from "@mtcute/core/storage/memory/repository/auth-keys.js";
import { MemoryPeersRepository } from "@mtcute/core/storage/memory/repository/peers.js";
import { MemoryRefMessagesRepository } from "@mtcute/core/storage/memory/repository/ref-messages.js";

let initialized = false;

const isKai3 = import.meta.env.VITE_KAIOS == 3;

const appVersion = new Promise<string>((res) => {
	if (import.meta.env.DEV) {
		const manifest = import.meta.env.MANIFEST;
		const version = isKai3 ? manifest.b2g_features.version : manifest.version;

		res(version);
	}

	if (import.meta.env.PROD) {
		const manifestURL = isKai3 ? "/manifest.webmanifest" : "/manifest.webapp";

		fetch(manifestURL).then(async (m) => {
			const manifest = await m.json();
			const version = isKai3 ? manifest.b2g_features.version : manifest.version;

			res(version);
		});
	}
});

class LocalStorageDriver extends BaseStorageDriver implements MemoryStorageDriver {
	readonly states: Map<string, object>;

	constructor(
		initialState: Map<any, any> | null,
		private onStateUpdate: (state: Map<any, any>) => void
	) {
		super();

		this.states = initialState ?? new Map();
	}

	getState<T extends object>(repo: string, def: () => T) {
		if (!this.states.has(repo)) {
			this.states.set(repo, def());
		}

		return this.states.get(repo) as T;
	}

	async _load() {}

	async _destroy() {
		for (const state of this.states.values()) {
			if (state instanceof Map) {
				state.clear();
			} else {
				for (const key in state) {
					// @ts-ignore
					const val = state[key];
					if (val instanceof Map) {
						val.clear();
					}
				}
			}
		}
	}
	async _save() {
		this.sync();
	}

	async sync() {
		this.onStateUpdate(this.states);
	}
}

class LocalStorageKeyValueRepo extends MemoryKeyValueRepository {
	declare _driver: LocalStorageDriver;

	set(key: string, value: Uint8Array): void {
		super.set(key, value);
		this._driver.sync();
	}

	delete(key: string): void {
		super.delete(key);
		this._driver.sync();
	}

	deleteAll(): void {
		super.deleteAll();
		this._driver.sync();
	}
}

class LocalStorageAuthKeysRepo extends MemoryAuthKeysRepository {
	declare _driver: LocalStorageDriver;

	set(dc: number, key: Uint8Array | null): void {
		super.set(dc, key);
		this._driver.sync();
	}

	setTemp(dc: number, idx: number, key: Uint8Array | null, expires: number): void {
		super.setTemp(dc, idx, key, expires);
		this._driver.sync();
	}

	deleteByDc(dc: number): void {
		super.deleteByDc(dc);
		this._driver.sync();
	}

	deleteAll(): void {
		super.deleteAll();
		this._driver.sync();
	}
}

class LocalStoragePeersRepo extends MemoryPeersRepository {
	declare _driver: LocalStorageDriver;

	store(peer: IPeersRepository.PeerInfo): void {
		super.store(peer);
		this._driver.sync();
	}

	deleteAll(): void {
		super.deleteAll();
		this._driver.sync();
	}
}

class LocalStorageRefMessagesRepo extends MemoryRefMessagesRepository {
	declare _driver: LocalStorageDriver;

	store(peerId: number, chatId: number, msgId: number): void {
		super.store(peerId, chatId, msgId);
		this._driver.sync();
	}

	delete(chatId: number, msgIds: number[]): void {
		super.delete(chatId, msgIds);
		this._driver.sync();
	}

	deleteByPeer(peerId: number): void {
		super.deleteByPeer(peerId);
		this._driver.sync();
	}

	deleteAll(): void {
		super.deleteAll();
		this._driver.sync();
	}
}

class LocalStorageProvider implements IMtStorageProvider, ITelegramStorageProvider {
	driver: LocalStorageDriver;
	kv: MemoryKeyValueRepository;
	authKeys: MemoryAuthKeysRepository;
	peers: MemoryPeersRepository;
	refMessages: MemoryRefMessagesRepository;

	constructor(initialState: Map<any, any> | null, onStateUpdate: (state: Map<any, any>) => void) {
		this.driver = new LocalStorageDriver(initialState, onStateUpdate);
		this.kv = new LocalStorageKeyValueRepo(this.driver);
		this.authKeys = new LocalStorageAuthKeysRepo(this.driver);
		this.peers = new LocalStoragePeersRepo(this.driver);
		this.refMessages = new LocalStorageRefMessagesRepo(this.driver);
	}
}

addEventListener("message", function init({ data }) {
	if (data && "__INIT__" in data) {
		if (initialized) {
			this.postMessage({ __READY__: true });
			return;
		}
		initialized = true;
		sleep(0).then(async () => {
			const fromUA = parseUserAgent(navigator.userAgent);
			const version = await appVersion;

			console.log("WAAA");

			const tg = new BaseTelegramClient({
				apiId,
				apiHash,
				storage: new LocalStorageProvider(data.__INIT__, (state) => {
					this.postMessage({ __STATE__: state });
				}),

				initConnectionOptions: {
					deviceModel: navigator.userAgent,
					systemVersion: fromUA.systemVersion.replace("/", " "),
					appVersion: version,
				},

				testMode: false,

				logLevel: 3,
			});

			new TelegramWorker({
				client: tg,
			});

			this.postMessage({ __READY__: true });
		});
	}
});
