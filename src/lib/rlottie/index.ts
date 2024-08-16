import * as Comlink from "comlink";
import type { Exposed } from "./worker";
import RlottieWorker from "./worker?worker";
import Queue from "queue";
import { sleep } from "../helpers";

const wrapped = Comlink.wrap<Exposed>(new RlottieWorker());

const rLottieLoaded = wrapped.loadRlottie();

export function loadRlottie() {
	return rLottieLoaded;
}

// we do every function one at a time, to avoid conflicts (C++ is supposed to be sync so)
const queue = new Queue({
	concurrency: 1,
	autostart: true,
});

export function isCached(id: string) {
	return new Promise<false | number>((res) => {
		queue.push(async () => {
			const cached = await wrapped.isCached(id);
			await sleep(0);
			res(cached);
		});
	});
}

export function loadAnimation(id: string, data: string) {
	return new Promise<number>((res) => {
		queue.push(async () => {
			const frames = await wrapped.loadAnimation(id, data);
			console.error("FRAMES LOADED FROM LOAD ANIMATION!!", frames);
			await sleep(0);
			res(frames);
		});
	});
}

export function requestFrame(id: string, frame: number, width: number, height: number) {
	return new Promise<Uint8ClampedArray>((res) => {
		queue.push(async () => {
			const clamped = await wrapped.requestFrame(id, frame, width, height);
			await sleep(0);
			res(clamped);
		});
	});
}
