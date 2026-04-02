import type { ITcpConnection, ITlsConnection, TcpEndpoint } from "@fuman/net";
import type { UnsafeMutable } from "@fuman/utils";
import { Bytes } from "@fuman/io";
import { ConnectionClosedError } from "@fuman/net";
import { ConditionVariable, Deferred, Deque } from "@fuman/utils";

// @ts-ignore
const TCPSocket = navigator.mozTCPSocket;

interface Socket {
	send(buff: ArrayBuffer, byteOffset: number, byteLength: number): boolean;
	send(buff: ArrayBuffer): boolean;
	close(): void;

	localPort: number;
	localAddress: string;
	remoteAddress: string;
}

/**
 * Implementation of {@link ITcpConnection} and {@link ITlsConnection} interfaces
 * using FirefoxOS [navigator.mozTCPSocket](https://cyan-2048.github.io/b2g-docs/B2G_OS/API/TCPSocket)
 */
export class TcpConnection implements ITcpConnection, ITlsConnection {
	/** Underlying socket */
	readonly socket!: Socket;
	#error: Error | null = null;
	#recvBuffer = Bytes.alloc(1024 * 16);
	#sendBuffer: Deque<[Uint8Array, Deferred<void>]> = new Deque();
	#cv = new ConditionVariable();
	#endpoint?: TcpEndpoint;

	/** Connect to the given endpoint (must be called as the first thing before using the connection) */
	async connect(endpoint: TcpEndpoint, tls = false): Promise<void> {
		const socket = TCPSocket.open(endpoint.address, endpoint.port, {
			binaryType: "arraybuffer",
			useSecureTransport: tls,
		});

		socket.onerror = (e: any) => {
			// https://cyan-2048.github.io/b2g-docs/B2G_OS/API/TCPSocket/onerror.html
			// In case of error, the data property is a string containing the description of the error.
			this._handleError(new Error(e.data));
		};
		socket.ondata = (e: any) => {
			this._handleData(new Uint8Array(e.data));
		};
		socket.onclose = () => {
			this.close();
		};
		socket.ondrain = () => {
			this._handleDrain();
		};

		this.#endpoint = endpoint;

		(this as UnsafeMutable<TcpConnection>).socket = await new Promise((res) => {
			socket.onopen = () => {
				res(socket);
			};
		});

		// console.info("TcpConnection KaiOS 2.5", socket);
	}

	/** Create a new TcpConnection from an existing socket */
	static from(socket: Socket): TcpConnection {
		const conn = new TcpConnection();
		(conn as UnsafeMutable<TcpConnection>).socket = socket;
		return conn;
	}

	/** @internal */
	_handleData(data: Uint8Array): void {
		// console.log("TCP RECEIVED: ", data);
		this.#recvBuffer.writeSync(data.length).set(data);
		this.#cv.notify();
	}

	/** @internal */
	_handleError(error: Error): void {
		this.#error = error;
		this.#cv.notify();
	}

	/** @internal */
	_handleClose(): void {
		this.#error = new ConnectionClosedError();
		this.#cv.notify();
		for (const [, deferred] of this.#sendBuffer) {
			deferred.reject(this.#error);
		}
	}

	/** @internal */
	_handleDrain(): void {
		while (!this.#sendBuffer.isEmpty()) {
			// eslint-disable-next-line ts/no-non-null-assertion
			const [chunk, deferred] = this.#sendBuffer.popFront()!;

			// https://cyan-2048.github.io/b2g-docs/B2G_OS/API/TCPSocket/send.html
			// basically if this method returns false
			// the data wasn't actually sent, and waiting for the drain is necessary
			const written = this.socket.send(chunk.buffer, chunk.byteOffset, chunk.byteLength);

			if (!written) {
				this.#sendBuffer.pushFront([chunk, deferred]);
				break;
			}

			deferred.resolve();
		}
	}

	async read(into: Uint8Array): Promise<number> {
		if (this.#recvBuffer.available > 0) {
			// there's data in the buffer
			const size = Math.min(this.#recvBuffer.available, into.length);
			into.set(this.#recvBuffer.readSync(size));
			this.#recvBuffer.reclaim();
			return size;
		}

		if (this.#error != null) throw this.#error;
		await this.#cv.wait();
		if (this.#error != null) throw this.#error;

		const size = Math.min(this.#recvBuffer.available, into.length);
		into.set(this.#recvBuffer.readSync(size));
		this.#recvBuffer.reclaim();
		return size;
	}

	async write(bytes: Uint8Array): Promise<void> {
		// ideally we should only resolve once everything was written,
		// but for now we just resolve immediately

		if (this.#error) throw this.#error;

		// https://cyan-2048.github.io/b2g-docs/B2G_OS/API/TCPSocket/send.html
		// basically if this method returns false
		// the data wasn't actually sent, and waiting for the drain is necessary
		const written = this.socket.send(bytes.buffer, bytes.byteOffset, bytes.byteLength);

		if (!written) {
			const deferred = new Deferred<void>();
			this.#sendBuffer.pushBack([bytes, deferred]);
			return deferred.promise;
		}
	}

	close(): void {
		this.socket.close();
		this._handleClose();
	}

	get localAddress(): TcpEndpoint {
		return {
			get address(): never {
				throw new Error("Not available on KaiOS");
			},
			get port(): never {
				throw new Error("Not available on KaiOS");
			},
		};
	}

	get remoteAddress(): TcpEndpoint {
		if (this.#endpoint) return this.#endpoint;

		return {
			get address(): never {
				throw new Error("Not available on KaiOS");
			},
			get port(): never {
				throw new Error("Not available on KaiOS");
			},
		};
	}

	setKeepAlive(_val: boolean): void {
		throw new Error("Not available on KaiOS");
	}

	setNoDelay(_val: boolean): void {
		throw new Error("Not available on KaiOS");
	}

	getAlpnProtocol(): string | null {
		throw new Error("Not available on KaiOS");
	}
}
