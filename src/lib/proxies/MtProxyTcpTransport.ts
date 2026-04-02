import { ITcpConnection, TcpEndpoint } from "@fuman/net";
import { BaseMtProxyTransport } from "@mtcute/core";
import { TcpConnection } from "./TcpConnection";

export default class MtProxyTcpTransport extends BaseMtProxyTransport {
	async _connectTcp(endpoint: TcpEndpoint): Promise<ITcpConnection> {
		const connection = new TcpConnection();
		await connection.connect(endpoint);
		return connection;
	}
}
