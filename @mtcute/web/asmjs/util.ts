// this is so it works on DEV mode
export async function resolveSystemJS() {
	if (import.meta.env.DEV) {
		// @ts-ignore
		await import("systemjs/dist/s.js");
		// @ts-ignore
		await import("systemjs/dist/extras/amd.js");
		return System;
	} else {
		return System;
	}
}
