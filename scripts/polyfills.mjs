import { ReadableStream } from "web-streams-polyfill";

/**
 * this file contains the polyfills that will be loaded before anything else
 * - WARNING: the code will also be executed in workers, be cautious in adding polyfills
 *
 * @type {Window & typeof globalThis}
 */
const s = self;
s.globalThis = s;
const workerSuffix = typeof importScripts != "undefined" ? " (worker)" : "";
console.time("polyfills" + workerSuffix);

try {
	s.window = s;
} catch {}

// all workers are iife!!!
const originalWorker = s.Worker;
s.Worker = function Worker_Shim(url) {
	return new originalWorker(url);
};
s.Worker.native = originalWorker;
s.Worker.prototype = originalWorker.prototype;
Object.assign(s.Worker, originalWorker);

// Lesson learned: take polyfills from the actual proposal instead of random code you find online
if (!Object.hasOwnProperty("getOwnPropertyDescriptors")) {
	Object.defineProperty(Object, "getOwnPropertyDescriptors", {
		configurable: true,
		writable: true,
		value: function getOwnPropertyDescriptors(object) {
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

if (import.meta.env.VITE_KAIOS != 3) {
	String.prototype.trimEnd ||= String.prototype.trimRight;

	if (typeof s.queueMicrotask !== "function") {
		s.queueMicrotask = function (callback) {
			Promise.resolve()
				.then(callback)
				.catch((e) =>
					setTimeout(() => {
						throw e;
					})
				);
		};
	}

	if (!self.ReadableStream) {
		self.ReadableStream = ReadableStream;
	}

	if (self.Blob) {
		const blob = Blob.prototype;

		if (!blob.arrayBuffer) {
			blob.arrayBuffer = function () {
				return new Response(this).arrayBuffer();
			};
		}

		if (!blob.stream) {
			blob.stream = function stream() {
				const blob = this;
				let position = 0;

				return new ReadableStream({
					pull: function (controller) {
						var chunk = blob.slice(position, position + 524288);

						return chunk.arrayBuffer().then(function (buffer) {
							position += buffer.byteLength;
							var uint8array = new Uint8Array(buffer);
							controller.enqueue(uint8array);

							if (position == blob.size) controller.close();
						});
					},
				});
			};
		}
	}

	const origPostMessage = self.postMessage;

	self.postMessage = function () {
		let tries = 0;

		try {
			origPostMessage.apply(this, arguments);
		} catch (e) {
			// console.error("Error while calling postMessage", e, ...arguments);

			(async () => {
				while (tries < 5) {
					await new Promise((res) => setTimeout(res, 0));
					tries++;

					// console.log("postMessage attempt", tries);

					if (tries > 2) {
						try {
							const args = [...arguments];

							// console.log("postMessage attempt", tries, "trying JSON.parse");
							args[0] = JSON.parse(JSON.stringify(arguments[0]));

							origPostMessage.apply(this, args);
							break;
						} catch (e) {
							continue;
						}
					}

					try {
						origPostMessage.apply(this, arguments);
						break;
					} catch {}
				}
			})();
		}
	};

	if (!Promise.prototype.finally) {
		Promise.prototype.finally = function (callback) {
			if (typeof callback !== "function") {
				return this.then(callback, callback);
			}
			const P = this.constructor || Promise;
			return this.then(
				(value) => P.resolve(callback()).then(() => value),
				(err) =>
					P.resolve(callback()).then(() => {
						throw err;
					})
			);
		};
	}

	// so we can catch errors like SyntaxError
	s.onerror = (...args) => {
		const error = args[4];
		console.error(...args);
		if (error && typeof window !== "undefined") {
			if ("__reportError__" in window && typeof window.__reportError__ === "function") {
				window.__reportError__(error);
			}
		}
	};

	if (s.Document) {
		(function (supported) {
			if (supported) return;
			function get() {
				return document.contains(this);
			}
			Object.defineProperty(Node.prototype, "isConnected", { get });
		})("isConnected" in Node.prototype);

		if (HTMLElement.prototype.nativeFocus === undefined) {
			HTMLElement.prototype.nativeFocus = HTMLElement.prototype.focus;

			var calcScrollableElements = function (element) {
				var parent = element.parentNode;
				var scrollableElements = [];
				var rootScrollingElement = document.scrollingElement || document.documentElement;

				while (parent && parent !== rootScrollingElement) {
					if (parent.offsetHeight < parent.scrollHeight || parent.offsetWidth < parent.scrollWidth) {
						scrollableElements.push([parent, parent.scrollTop, parent.scrollLeft]);
					}
					parent = parent.parentNode;
				}
				parent = rootScrollingElement;
				scrollableElements.push([parent, parent.scrollTop, parent.scrollLeft]);

				return scrollableElements;
			};

			var restoreScrollPosition = function (scrollableElements) {
				for (var i = 0; i < scrollableElements.length; i++) {
					scrollableElements[i][0].scrollTop = scrollableElements[i][1];
					scrollableElements[i][0].scrollLeft = scrollableElements[i][2];
				}
				scrollableElements = [];
			};

			function isElementInViewport(el) {
				var rect = el.getBoundingClientRect();

				return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
			}

			var patchedFocus = function (args) {
				if (args && args.preventScroll && !isElementInViewport(this)) {
					var evScrollableElements = calcScrollableElements(this);
					this.nativeFocus();
					Promise.resolve().then(() => {
						restoreScrollPosition(evScrollableElements);
					});
				} else {
					this.nativeFocus();
				}
			};

			HTMLElement.prototype.focus = patchedFocus;
		}

		// Source: https://gitlab.com/ollycross/element-polyfill
		(function (arr) {
			function docFragger(args) {
				const docFrag = document.createDocumentFragment();

				args.forEach((argItem) =>
					docFrag.appendChild(argItem instanceof Node ? argItem : document.createTextNode(String(argItem)))
				);

				return docFrag;
			}

			const { defineProperty } = Object;

			function define(item, name, value) {
				defineProperty(item, name, { configurable: true, enumerable: true, writable: true, value });
			}

			arr.forEach(function (item) {
				if (!item) return;
				if (!item.hasOwnProperty("append")) {
					define(item, "append", function append(...args) {
						this.appendChild(docFragger(args));
					});
				}
				if (!item.hasOwnProperty("prepend")) {
					define(item, "prepend", function prepend(...args) {
						this.insertBefore(docFragger(args), this.firstChild);
					});
				}
				if (!item.hasOwnProperty("after")) {
					define(item, "after", function after(...argArr) {
						var docFrag = document.createDocumentFragment();

						argArr.forEach(function (argItem) {
							docFrag.appendChild(argItem instanceof Node ? argItem : document.createTextNode(String(argItem)));
						});

						this.parentNode.insertBefore(docFrag, this.nextSibling);
					});
				}
			});
		})([Element.prototype, Document.prototype, DocumentFragment.prototype]);
	}

	if (s.NodeList) NodeList.prototype.forEach ||= Array.prototype.forEach;

	// code stolen here: https://github.com/ustccjw/unhandled-rejection-polyfill/blob/master/src/index.js
	if (typeof PromiseRejectionEvent === "undefined") {
		const Promise = s.Promise;

		/**
		 *
		 * @param {*} promise
		 * @param {Error} reason
		 */
		function dispatchUnhandledRejectionEvent(promise, reason) {
			const event = new Event("unhandledrejection", {
				bubbles: false,
				cancelable: true,
			});
			Object.defineProperties(event, {
				promise: {
					value: promise,
					writable: false,
				},
				reason: {
					value: reason,
					writable: false,
				},
			});
			s.dispatchEvent(event);
			console.error(promise, reason, typeof reason == "object" && "stack" in reason && reason.stack);
		}

		const MyPromise = function (resolver) {
			if (!(this instanceof MyPromise)) {
				throw new TypeError("Cannot call a class as a function");
			}
			const promise = new Promise((resolve, reject) => {
				const customReject = (reason) => {
					// macro-task(setTimeout) will execute after micro-task(promise)
					setTimeout(() => {
						if (promise.handled !== true) dispatchUnhandledRejectionEvent(promise, reason);
					}, 0);
					return reject(reason);
				};
				try {
					return resolver(resolve, customReject);
				} catch (err) {
					return customReject(err);
				}
			});
			promise.__proto__ = MyPromise.prototype;
			return promise;
		};

		MyPromise.__proto__ = Promise;
		MyPromise.prototype.__proto__ = Promise.prototype;

		MyPromise.prototype.then = function (resolve, reject) {
			return Promise.prototype.then.call(
				this,
				resolve,
				reject &&
					((reason) => {
						this.handled = true;
						return reject(reason);
					})
			);
		};

		MyPromise.prototype.catch = function (reject) {
			return Promise.prototype.catch.call(
				this,
				reject &&
					((reason) => {
						this.handled = true;
						return reject(reason);
					})
			);
		};

		s.Promise = MyPromise;
	}

	s.Object.fromEntries = function fromEntries(iterable) {
		return [...iterable].reduce((obj, [key, val]) => {
			obj[key] = val;
			return obj;
		}, {});
	};

	s.Promise.allSettled =
		s.Promise.allSettled ||
		((promises) =>
			Promise.all(
				promises.map((p) =>
					p
						.then((value) => ({
							status: "fulfilled",
							value,
						}))
						.catch((reason) => ({
							status: "rejected",
							reason,
						}))
				)
			));
}

import "systemjs/dist/s.js";
import "systemjs/dist/extras/amd.js";

console.timeEnd("polyfills" + workerSuffix);
