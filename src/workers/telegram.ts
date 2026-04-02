import * as Comlink from "comlink";
import { BaseTelegramClient, TelegramWorker, WebCryptoProvider, WebPlatform } from "@mtcute/web";
import type { AsmCryptoProvider } from "@mtcute/web/kaios/asmjs/crypto.js";
import { EventEmitter } from "tseep";
import type { ProxyModes } from "@/stores";
import { config } from "./middlewares";

interface WorkerInitParams {
	proxyMode: ProxyModes;
	apiId: number;
	apiHash: string;
}

interface WorkerInitInput {
	proxyMode?: ProxyModes;
	apiId?: string | number;
	apiHash?: string;
}

const EE = new EventEmitter<{ online(isOnline: boolean): void }>();

let onLine = true;

class KaiPlatform extends WebPlatform {
	onNetworkChanged(fn: (connected: boolean) => void): () => void {
		const onlineHandler = () => fn(onLine);

		EE.on("online", onlineHandler);

		return () => EE.off("online", onlineHandler);
	}

	isOnline(): boolean {
		return onLine;
	}
}

function createClient({ proxyMode, apiId, apiHash }: WorkerInitParams): BaseTelegramClient {
	if (proxyMode != "none") {
		// if the app is used with a proxy,
		// then we won't be using the Telegram as a worker
		// we will make use of this as a heavy tasks worker anyways

		const crypto = new WebCryptoProvider();
		crypto.initialize();

		return { crypto } as any as BaseTelegramClient;
	}

	const tgClient = new BaseTelegramClient({
		apiId,
		apiHash,

		platform: new KaiPlatform(),

		...config,
	});

	new TelegramWorker({
		client: tgClient,

		customMethods: {
			async setOnline(online: boolean) {
				EE.emit("online", (onLine = online));
			},
			async deleteAuthkeyByDC(revokedDcID: number) {
				// don't delete if authkey is primary,
				// because that would be stupid
				if (revokedDcID == tgClient.mt.network.getPrimaryDcId()) return;

				await tgClient.mt.storage.provider.authKeys.deleteByDc(revokedDcID);
			},
			async getAuthKey() {
				try {
					const primaryDcs = (await tgClient.mt.storage.dcs.fetch()) ?? tgClient.mt._defaultDcs;
					const _authKey = await tgClient.mt.storage.provider.authKeys.get(primaryDcs.main.id);
					if (!_authKey) throw new Error("Auth key is not ready yet");
					return _authKey;
				} catch {}
				return null;
			},
		},
	}).mount();

	return tgClient;
}

const defaultInitParams: WorkerInitParams = {
	proxyMode: "none",
	apiId: Number(import.meta.env.VITE_APP_ID),
	apiHash: import.meta.env.VITE_APP_HASH,
};

let initParams: WorkerInitParams = defaultInitParams;
let tgPromise: Promise<BaseTelegramClient> | null = null;

function getClient() {
	if (!tgPromise) {
		tgPromise = Promise.resolve(createClient(initParams));
	}

	return tgPromise;
}

const exposed = {
	async init(params: WorkerInitInput) {
		if (tgPromise) return;

		initParams = {
			...defaultInitParams,
			...params,
			proxyMode: (params.proxyMode ?? defaultInitParams.proxyMode) as ProxyModes,
			apiId: Number(params.apiId ?? defaultInitParams.apiId),
			apiHash: String(params.apiHash ?? defaultInitParams.apiHash),
		};

		tgPromise = Promise.resolve(createClient(initParams));
		await tgPromise;
	},

	async gzip(data: Uint8Array, maxSize?: number) {
		const tg = await getClient();
		return tg.crypto.gzip(data, maxSize ?? Math.floor(data.length * 0.9));
	},

	async gunzip(data: Uint8Array) {
		const tg = await getClient();
		return tg.crypto.gunzip(data);
	},

	async getAvailableMemory() {
		const tg = await getClient();

		if (import.meta.env.KAIOS != 3) {
			if ("instance" in tg.crypto) {
				return (tg.crypto.instance as any).getAvailableMemory() as number;
			}
		}

		return null;
	},

	async webp(buff: Uint8Array, width: number, height: number) {
		const tg = await getClient();

		if (import.meta.env.KAIOS != 3) {
			if ("instance" in tg.crypto) {
				return (tg.crypto.instance as AsmCryptoProvider).webp(buff, width, height);
			}
		}

		return null;
	},
};

export type Exposed = typeof exposed;

Comlink.expose(exposed);
