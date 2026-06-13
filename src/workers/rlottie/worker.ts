// the worker implementation seems to actually cause low fps?

import * as Comlink from "comlink";
import { LRUCache } from "lru-cache";

interface IRlottiWasm {
	load(data: string): void;
	frames(): number;
	render(frame: number, width: number, height: number): Uint8Array;
	delete(): void;
}

const rLottieCache = new LRUCache<string, IRlottiWasm>({
	max: 5,
	dispose(
		lottie,
		//, sticker, reason
	) {
		lottie.delete();
		// console.info("dispose", sticker, reason);
	},
});

let RlottieWasm: any;

async function _loadRlottie(): Promise<true> {
	if (import.meta.env.KAIOS == 3) {
		const { default: factory } = await import("./wasm/rlottie-wasm.js");
		const Module = await factory({
			locateFile() {
				return new URL("./wasm/rlottie-wasm.wasm", import.meta.url).href;
			},
		});

		RlottieWasm = Module.RlottieWasm;
	} else {
		const { default: factory } = await import("./asmjs/rlottie-wasm.asm.js");
		const Module = await factory({
			locateFile() {
				return new URL("./asmjs/rlottie-wasm.js.mem", import.meta.url).href;
			},
		});

		RlottieWasm = Module.RlottieWasm;
	}

	console.info("RlottieWasm loaded!");

	return true;
}

let loaded: Promise<true> | null = null;

function loadRlottie(): Promise<true> {
	if (loaded) return loaded;
	return (loaded = _loadRlottie());
}

/**
 * if it is cached, returns number of frames
 */
function isCached(id: string) {
	const has = rLottieCache.get(id);
	return has ? has.frames() : false;
}

/**
 * loads animation, return number of frames
 */
async function loadAnimation(id: string, data: string) {
	console.info("Loading Rlottie " + id);
	const instance = new RlottieWasm();

	instance.load(data);

	rLottieCache.set(id, instance);

	return instance.frames() as number;
}

/**
 * get last frame of an animation, does not cache the animation
 */
async function getLastFrame(data: string, width: number, height: number) {
	const instance = new RlottieWasm();

	instance.load(data);
	const frames = instance.frames() as number;

	const buffer = instance.render(frames - 1, width, height);
	const result = Uint8ClampedArray.from(buffer);

	instance.delete();

	return Comlink.transfer(result, [result.buffer]);
}

/**
 * requests an animation frame given the ID
 */
function requestFrame(id: string, frame: number, width: number, height: number) {
	const instance = rLottieCache.get(id);

	if (!instance) throw new Error("sticker does not exist!");

	const buffer = instance.render(frame, width, height);
	const result = Uint8ClampedArray.from(buffer);

	return Comlink.transfer(result, [result.buffer]);
}

export { loadRlottie, isCached, loadAnimation, requestFrame, getLastFrame };

// export type Exposed = typeof exposed;

// Comlink.expose(exposed);
