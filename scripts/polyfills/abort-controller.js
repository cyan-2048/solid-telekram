class AbortSignal extends EventTarget {
	onabort = null;
	aborted = false;
	reason = undefined;

	toString() {
		return "[object AbortSignal]";
	}
	get [Symbol.toStringTag]() {
		return "AbortSignal";
	}

	throwIfAborted() {
		if (this.aborted) {
			throw this.reason;
		}
	}

	static abort(reason) {
		const controller = new AbortController();
		controller.abort(reason);
		return controller.signal;
	}

	static timeout(time) {
		const controller = new AbortController();
		setTimeout(() => {
			const err = new DOMException("The operation timed out.", "TimeoutError");
			controller.abort(err);
		}, time);
		return controller.signal;
	}
}

class AbortController {
	constructor() {
		this.signal = new AbortSignal();
	}
	abort(reason) {
		if (this.signal.aborted) return;

		this.signal.aborted = true;
		this.signal.reason = reason || new DOMException("The operation was aborted.", "AbortError");

		const evt = new Event("abort");
		// this should set the target and currentTarget instances
		this.signal.dispatchEvent(evt);
		// although I don't think anyone is actually using onabort
		if (typeof this.signal.onabort == "function") this.signal.onabort(evt);
	}
	toString() {
		return "[object AbortController]";
	}
	get [Symbol.toStringTag]() {
		return "AbortController";
	}
}

// both Kai 3.0 and 2.5 seems to need this polyfilled
// I don't use fetch so this is fine
self.AbortController = AbortController;
self.AbortSignal = AbortSignal;
