import type { ITcpConnection } from "@fuman/net";
import type { BasicDcOption } from "@mtcute/core/utils.js";
import { IntermediatePacketCodec, type TelegramTransport } from "@mtcute/core";
import { TcpConnection } from "./TcpConnection";

export class TcpTransport implements TelegramTransport {
	async connect(dc: BasicDcOption): Promise<ITcpConnection> {
		const connection = new TcpConnection();
		await connection.connect({ address: dc.ipAddress, port: dc.port });
		return connection;
	}

	packetCodec(): IntermediatePacketCodec {
		return new IntermediatePacketCodec();
	}
}
