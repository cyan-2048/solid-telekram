import { performSocksHandshake, type SocksProxySettings } from "@fuman/net";
import { IntermediatePacketCodec, type ITelegramConnection, type TelegramTransport } from "@mtcute/core";
import type { BasicDcOption } from "@mtcute/core/utils.js";
import { TcpConnection } from "./TcpConnection";

export default class SocksProxyTcpTransport implements TelegramTransport {
	constructor(readonly proxy: SocksProxySettings) {}

	async connect(dc: BasicDcOption): Promise<ITelegramConnection> {
		const conn = new TcpConnection();

		await conn.connect({
			address: this.proxy.host,
			port: this.proxy.port,
		});

		await performSocksHandshake(conn, conn, this.proxy, {
			address: dc.ipAddress,
			port: dc.port,
		});

		return conn;
	}

	packetCodec(): IntermediatePacketCodec {
		return new IntermediatePacketCodec();
	}
}
