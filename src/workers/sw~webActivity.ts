/** Protocol marker so the SW only accepts its own window messages. */
const RESULT_MSG = "telekram.webactivity-result";

/** The active webActivityRequestHandler, null between activities. */
let handler: any = null;
/** Resolves the SW idle-extension promise to keep the worker alive. */
let resolveIdle: (() => void) | null = null;

const sw = self as unknown as ServiceWorkerGlobalScope;

async function openApp(source: any) {
	const clientList = await sw.clients.matchAll({ type: "window" });

	for (var i = 0; i < clientList.length; i++) {
		let client = clientList[i];
		if ("focus" in client) {
			client.postMessage({ type: "window-open" });
			client.postMessage({ type: "telekram.webactivity", source });
			return client.focus();
		}
	}

	if (typeof sw.clients.openWindow == "function") {
		return sw.clients
			.openWindow(new URL("/", self.location.origin) + "index.html")
			.then((client) => client?.focus())
			.then((client) => client?.postMessage({ type: "telekram.webactivity", source }));
	}
}

sw.addEventListener("systemmessage", (event: any) => {
	if (event.name !== "activity") return;

	const webActivity = event.data;
	handler = webActivity.webActivityRequestHandler();

	// Hold the SW open until the window posts its result back.
	const idleTimeExtension = new Promise<void>((resolve) => {
		resolveIdle = resolve;
	});
	event.waitUntil(idleTimeExtension);
	event.waitUntil(
		openApp(handler.source).catch((err: Error) => {
			console.error("service worker openWindow failed: ", err?.name, err?.message);
		}),
	);
});

sw.addEventListener("message", (event: any) => {
	const data = event.data;
	// Only accept our own result/keep-alive messages.
	if (!data || data.type !== RESULT_MSG) return;

	// Keep-alive ping while an activity is being serviced.
	if (data.isDummy) return;

	const { isError, activityResult } = data;

	if (handler) {
		if (isError) {
			handler.postError(activityResult);
		} else {
			handler.postResult(activityResult);
		}
		handler = null;
	}

	if (resolveIdle) {
		resolveIdle();
		resolveIdle = null;
	}
});
