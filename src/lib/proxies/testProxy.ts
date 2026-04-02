import { apiHash, apiId } from "@/config";
import { BaseTelegramClient, MtProxySettings } from "@mtcute/web";
import MtProxyTcpTransport from "./MtProxyTcpTransport";

let loaded: BaseTelegramClient | null = null;

function load() {
	if (loaded) return loaded;
	return (loaded = new BaseTelegramClient({
		apiId,
		apiHash,
		storage: "telekram:proxy-test",
		logLevel: 0,
	}));
}

async function testMtProxy(settings: MtProxySettings) {
	const tg = load();
	await tg.mt.network.changeTransport(new MtProxyTcpTransport(settings));
}
