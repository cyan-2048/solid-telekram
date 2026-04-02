import * as Comlink from "comlink";
// @ts-ignore
import type { Exposed } from "./worker";

const wrapped = Comlink.wrap<Exposed>(new Worker(new URL("./worker.ts", import.meta.url)));

let rLottieLoaded: Promise<true> | null = null;

export function loadRlottie() {
	if (rLottieLoaded) return rLottieLoaded;
	return (rLottieLoaded = wrapped.loadRlottie());
}

export const isCached = wrapped.isCached;
export const loadAnimation = wrapped.loadAnimation;
export const requestFrame = wrapped.requestFrame;
