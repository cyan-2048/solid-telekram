//              _          ___ _ _ _
//             | |        / __|_) | |        _
//  ____   ___ | |_   _ _| |__ _| | |  ___ _| |_  ___
// |  _ \ / _ \| | | | (_   __) | | | /___|_   _)/___)
// | |_| | |_| | | |_| | | |  | | | ||___ | | |_|___ |
// |  __/ \___/ \_)__  | |_|  |_|\_)_|___(_) \__|___/
// |_|           (____/
//
// this file includes polyfills for KaiOS :)

// well known symbols
// core-js creates its own versions of these and doesn't expose it to Symbol :(
[
	// hasInstance is kinda useless?
	// you'd need to change all the instanceof calls to get it to work
	// "hasInstance",
	"toStringTag",
	"asyncIterator",
	// I don't think this is in use
	// "matchAll",
].forEach((name) => {
	// @ts-ignore
	if (!Symbol.hasOwnProperty(name)) Symbol[name] = Symbol.for("Symbol." + name);
});

require("core-js/modules/es.promise.js");
require("core-js/modules/es.promise.with-resolvers.js");
require("core-js/modules/es.promise.finally.js");
require("core-js/modules/web.queue-microtask.js");
require("core-js/modules/web.set-immediate.js");
require("core-js/modules/es.object.from-entries.js");
require("core-js/modules/es.array.unscopables.flat.js");
require("core-js/modules/es.array.flat.js");
require("core-js/modules/es.array.flat-map.js");
require("core-js/modules/es.array.to-sorted.js");
require("core-js/modules/es.global-this.js");
require("core-js/modules/es.set.is-subset-of.v2.js");
require("core-js/modules/es.set.is-disjoint-from.v2.js");
require("core-js/modules/es.set.difference.v2.js");
require("./event-target.js");
require("./abort-controller.js");

if (typeof self != "undefined") {
	self.onerror = (...args) => {
		globalThis.console.error(...args);
	};
}

globalThis.addEventListener("unhandledrejection", (ev: any) => {
	globalThis.console.error("Uncaught (in promise)", ev.reason);
});

Blob.prototype.arrayBuffer ||= function () {
	return Promise.resolve(new Response(this).arrayBuffer());
};

const _ReadableStream = require("web-streams-polyfill/dist/ponyfill.js").ReadableStream;

globalThis.ReadableStream = _ReadableStream;

Blob.prototype.stream = function stream() {
	const blob = this;
	let position = 0;
	const CHUNK_SIZE = 2 * 1024 * 1024; // 5MB

	return new _ReadableStream({
		//  @ts-ignore
		pull(controller) {
			if (position >= blob.size) {
				controller.close();
				return;
			}

			const chunk = blob.slice(position, position + CHUNK_SIZE);
			return chunk.arrayBuffer().then((buffer) => {
				position += buffer.byteLength;
				controller.enqueue(new Uint8Array(buffer));
			});
		},
	});
};

// Lesson learned: take polyfills from the actual proposal instead of random code you find online
// https://github.com/tc39/proposal-object-getownpropertydescriptors
if (!Object.hasOwnProperty("getOwnPropertyDescriptors")) {
	Object.defineProperty(Object, "getOwnPropertyDescriptors", {
		configurable: true,
		writable: true,
		value: function getOwnPropertyDescriptors(object: any) {
			return Reflect.ownKeys(object).reduce((descriptors, key) => {
				return Object.defineProperty(descriptors, key, {
					configurable: true,
					enumerable: true,
					writable: true,
					value: Object.getOwnPropertyDescriptor(object, key),
				});
			}, {});
		},
	});
}

// quick polyfills
String.prototype.trimEnd ||= String.prototype.trimRight;
String.prototype.trimStart ||= String.prototype.trimLeft;
ImageBitmapRenderingContext.prototype.transferFromImageBitmap ||=
	// @ts-ignore
	ImageBitmapRenderingContext.prototype.transferImageBitmap;

const IS_WORKER = typeof importScripts != "undefined";

if (!IS_WORKER) {
	// quick polyfills
	// @ts-ignore
	NodeList.prototype.forEach ||= Array.prototype.forEach;

	// 	if (typeof ResizeObserver == "undefined") {
	// 		globalThis.ResizeObserver = require("resize-observer-polyfill").default;
	// 	}

	// required by scroll-into-view-if-needed
	// some solid-js libraries also use this for some reason (solid-transition-group)
	if (!("isConnected" in Node.prototype)) {
		Object.defineProperty(Node.prototype, "isConnected", {
			get() {
				return document.contains(this);
			},
		});
	}
}
