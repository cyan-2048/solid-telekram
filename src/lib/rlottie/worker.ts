// the worker implementation seems to actually cause low fps?

import WasmURL from "./wasm/rlottie-wasm.wasm?url";
import AsmMemURL from "./asmjs/rlottie-wasm.js.mem?url";
import AsmURL from "./asmjs/rlottie-wasm.asm.js?url";
import * as Comlink from "comlink";

const rLottieCache = new Map<string, any>();

const isKai3 = import.meta.env.VITE_KAIOS == 3;

let RlottieWasm: any;

async function _loadRlottie() {
	if (isKai3) {
		const factory = require("./wasm/rlottie-wasm.js");
		const Module = await factory({
			locateFile() {
				return WasmURL;
			},
		});
		RlottieWasm = Module.RlottieWasm;
	} else {
		if (import.meta.env.DEV) {
			const factory = require("./asmjs/rlottie-wasm.asm.js");
			const Module = await factory({
				locateFile() {
					return AsmMemURL;
				},
			});
			RlottieWasm = Module.RlottieWasm;
		} else {
			const m = await System.import(AsmURL);
			const factory = m.default;
			const Module = await factory({
				locateFile() {
					return AsmMemURL;
				},
			});
			RlottieWasm = Module.RlottieWasm;
		}
	}

	console.error("LOADING RLOTTIE SUCESSFUL!");

	return true;
}

const loaded = _loadRlottie();

function loadRlottie() {
	return loaded as Promise<true>;
}

/**
 * if it is cached, returns number of frames
 */
function isCached(id: string) {
	const has = rLottieCache.has(id);
	return has ? (rLottieCache.get(id).frames() as number) : false;
}

/**
 * loads animation, return number of frames
 */
async function loadAnimation(id: string, data: string) {
	console.error("LOAD ANIM");
	const instance = new RlottieWasm();

	instance.load(data);

	rLottieCache.set(id, instance);

	return instance.frames() as number;
}

/**
 * requests an animation frame given the ID
 */
function requestFrame(id: string, frame: number, width: number, height: number) {
	const instance = rLottieCache.get(id);

	const buffer = instance.render(frame, width, height);
	const result = Uint8ClampedArray.from(buffer);

	return Comlink.transfer(result, [result.buffer]);
}

const exposed = {
	loadRlottie,
	isCached,
	loadAnimation,
	requestFrame,
};

export type Exposed = typeof exposed;

Comlink.expose(exposed);
