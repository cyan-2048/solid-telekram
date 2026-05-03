// original source: https://github.com/openGiraffes/kaiscr-tkinter-win/blob/master/kaiscr.py

import { execSync } from "child_process";
import net from "net";

const screenshot_cmd = '{"type":"screenshotToDataURL","to":"%s"}';
const listTabs_cmd = '{"to":"root","type":"listTabs"}';
const substring_cmd = '{"type":"substring","start":%d,"end":%d,"to":"%s"}';

let sock: net.Socket;
let deviceActor: string;
let _leftover: Buffer | null = null;

async function connect(host = "127.0.0.1", port = 6000): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		sock = net.createConnection({ host, port }, async () => {
			try {
				let size = await _readSize();
				await _read(size);
				await _send(listTabs_cmd);
				size = await _readSize();
				const tabs = await _read(size);
				deviceActor = JSON.parse(tabs.toString()).deviceActor;
				resolve();
			} catch (e) {
				reject(e);
			}
		});
		sock.on("error", reject);
	});
}

function _send(command: string): Promise<void> {
	return new Promise((resolve) => {
		const buf = Buffer.from(command, "utf8");
		const msg = Buffer.concat([Buffer.from(String(buf.length) + ":", "utf8"), buf]);
		sock.write(msg, () => resolve());
	});
}

function _readSize(): Promise<number> {
	return new Promise((resolve) => {
		let buf = Buffer.alloc(0);
		const onData = (chunk: Buffer) => {
			buf = Buffer.concat([buf, chunk]);
			const idx = buf.indexOf(58); // ':'
			if (idx !== -1) {
				sock.removeListener("data", onData);
				const size = parseInt(buf.slice(0, idx).toString(), 10);
				const rest = buf.slice(idx + 1);
				if (rest.length > 0) _leftover = rest;
				else _leftover = null;
				resolve(size);
			}
		};
		sock.on("data", onData);
	});
}

function _read(size: number): Promise<Buffer> {
	return new Promise((resolve) => {
		let buf = _leftover || Buffer.alloc(0);
		_leftover = null;
		const onData = (chunk: Buffer) => {
			buf = Buffer.concat([buf, chunk]);
			if (buf.length >= size) {
				sock.removeListener("data", onData);
				const result = buf.slice(0, size);
				_leftover = buf.slice(size);
				resolve(result);
			}
		};
		if (buf.length >= size) {
			const result = buf.slice(0, size);
			_leftover = buf.slice(size);
			resolve(result);
		} else {
			sock.on("data", onData);
		}
	});
}

async function screenshotBase64(): Promise<string> {
	const cmd = screenshot_cmd.replace("%s", deviceActor);
	await _send(cmd);
	let size = await _readSize();
	let buffer = await _read(size);
	let image = JSON.parse(buffer.toString()).value;
	if (typeof image === "string") {
		return image.split(",")[1];
	}
	const image_len = image.length;
	const actor = image.actor;
	const cmd2 = substring_cmd.replace("%d", "0").replace("%d", String(image_len)).replace("%s", actor);
	await _send(cmd2);
	size = await _readSize();
	buffer = await _read(size);
	let imgStr = JSON.parse(buffer.toString()).substring.split(",")[1];
	imgStr += "=".repeat(-imgStr.length % 4);
	return "data:image/png;base64," + imgStr;
}

function close() {
	if (sock) sock.end();
}

// Example usage (uncomment to test):
// (async () => {
//   await connect();
//
//   console.log(base64);
//   close();
// })();
(async () => {
	execSync("adb forward tcp:6000 localfilesystem:/data/local/debugger-socket");
	await connect();
	const base64 = await screenshotBase64();
	execSync(`firefox "${base64}"`);
	close();
})();
