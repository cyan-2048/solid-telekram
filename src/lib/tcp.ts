import EventEmitter from "events";

import {
	IntermediatePacketCodec,
	IPacketCodec,
	ITelegramTransport,
	MtcuteError,
	TransportState,
} from "@mtcute/core";
import { BasicDcOption, ICryptoProvider, Logger } from "@mtcute/core/utils.js";

// @ts-ignore
const TCPSocket = navigator.mozTCPSocket;

interface Socket {
	send(buff: ArrayBuffer): boolean;
	close(): void;
}

/**
 * Base for TCP transports.
 * Subclasses must provide packet codec in `_packetCodec` property
 */
export abstract class BaseTcpTransport extends EventEmitter implements ITelegramTransport {
	protected _currentDc: BasicDcOption | null = null;
	protected _state: TransportState = TransportState.Idle;
	protected _socket: Socket | null = null;

	abstract _packetCodec: IPacketCodec;
	protected _crypto!: ICryptoProvider;
	protected log!: Logger;

	packetCodecInitialized = false;

	private _updateLogPrefix() {
		if (this._currentDc) {
			this.log.prefix = `[TCP:${this._currentDc.ipAddress}:${this._currentDc.port}] `;
		} else {
			this.log.prefix = "[TCP:disconnected] ";
		}
	}

	setup(crypto: ICryptoProvider, log: Logger): void {
		this._crypto = crypto;
		this.log = log.create("tcp");
		this._updateLogPrefix();
	}

	state(): TransportState {
		return this._state;
	}

	currentDc(): BasicDcOption | null {
		return this._currentDc;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	connect(dc: BasicDcOption, testMode: boolean): void {
		if (this._state !== TransportState.Idle) {
			throw new MtcuteError("Transport is not IDLE");
		}

		if (!this.packetCodecInitialized) {
			this._packetCodec.setup?.(this._crypto, this.log);
			this._packetCodec.on("error", (err) => this.emit("error", err));
			this._packetCodec.on("packet", (buf) => this.emit("message", buf));
			this.packetCodecInitialized = true;
		}

		this._state = TransportState.Connecting;
		this._currentDc = dc;
		this._updateLogPrefix();

		this.log.debug("connecting to %j", dc);

		const socket = TCPSocket.open(dc.ipAddress, dc.port, {
			binaryType: "arraybuffer",
		});

		socket.onopen = () => {
			this.handleConnect(socket);
		};
		socket.onerror = (e: any) => {
			this.handleError(socket, new Error(e.data));
		};
		socket.ondata = (e: any) => {
			this._packetCodec.feed(new Uint8Array(e.data));
		};
		socket.onclose = () => {
			this.close();
		};
		socket.ondrain = () => {
			this.handleDrained();
		};
	}

	close(): void {
		if (this._state === TransportState.Idle) return;
		this.log.info("connection closed");

		this._state = TransportState.Idle;
		this._socket?.close();
		this._socket = null;
		this._currentDc = null;
		this._packetCodec.reset();
		this._sendOnceDrained = [];
		this.emit("close");
	}

	handleError(socket: unknown, error: Error): void {
		this.log.error("error: %s", error.stack);

		if (this.listenerCount("error") > 0) {
			this.emit("error", error);
		}
	}

	handleConnect(socket: Socket): void {
		const _socket = (this._socket = socket);
		this.log.info("connected");

		Promise.resolve(this._packetCodec.tag())
			.then((initialMessage) => {
				if (initialMessage.length) {
					_socket.send(initialMessage.buffer);
					this._state = TransportState.Ready;
					this.emit("ready");
				} else {
					this._state = TransportState.Ready;
					this.emit("ready");
				}
			})
			.catch((err) => {
				if (this.listenerCount("error") > 0) {
					this.emit("error", err);
				}
			});
	}

	needsToDrain = false;

	async send(bytes: Uint8Array): Promise<void> {
		const framed = await this._packetCodec.encode(bytes);

		if (this._state !== TransportState.Ready) {
			throw new MtcuteError("Transport is not READY");
		}

		if (this.needsToDrain) {
			this._sendOnceDrained.push(framed);
		}

		console.log("SENDING", framed.byteLength, "bytes to tcp");
		// returns false when draining is needed
		const written = this._socket!.send(framed.buffer);

		if (!written) {
			this.needsToDrain = true;
		}
	}

	private _sendOnceDrained: Uint8Array[] = [];
	private handleDrained(): void {
		while (this._sendOnceDrained.length) {
			const data = this._sendOnceDrained.shift()!;

			console.log("SENDING", data.byteLength, "bytes to tcp");
			const written = this._socket!.send(data.buffer);

			if (!written) {
				return;
			}
		}
		this.needsToDrain = false;
	}
}

export class TcpTransport extends BaseTcpTransport {
	_packetCodec = new IntermediatePacketCodec();
}
