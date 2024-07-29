function noop() {}

function safe_not_equal(a, b) {
	return a != a ? b == b : a !== b || (a && typeof a === "object") || typeof a === "function";
}

function subscribe(store, ...callbacks) {
	if (store == null) {
		return noop;
	}
	const unsub = store.subscribe(...callbacks);
	return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}

function get_store_value(store) {
	let value;
	subscribe(store, (_) => (value = _))();
	return value;
}

// backend/node_modules/svelte/store/index.mjs
var subscriber_queue = [];
function readable(value, start) {
	return {
		subscribe: writable(value, start).subscribe,
	};
}
function writable(value, start = noop) {
	let stop;
	const subscribers = /* @__PURE__ */ new Set();
	function set(new_value) {
		if (safe_not_equal(value, new_value)) {
			value = new_value;
			if (stop) {
				const run_queue = !subscriber_queue.length;
				for (const subscriber of subscribers) {
					subscriber[1]();
					subscriber_queue.push(subscriber, value);
				}
				if (run_queue) {
					for (let i = 0; i < subscriber_queue.length; i += 2) {
						subscriber_queue[i][0](subscriber_queue[i + 1]);
					}
					subscriber_queue.length = 0;
				}
			}
		}
	}
	function update(fn) {
		set(fn(value));
	}
	function subscribe2(run2, invalidate = noop) {
		const subscriber = [run2, invalidate];
		subscribers.add(subscriber);
		if (subscribers.size === 1) {
			stop = start(set) || noop;
		}
		run2(value);
		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0 && stop) {
				stop();
				stop = null;
			}
		};
	}
	return { set, update, subscribe: subscribe2 };
}
function derived(stores, fn, initial_value) {
	const single = !Array.isArray(stores);
	const stores_array = single ? [stores] : stores;
	const auto = fn.length < 2;
	return readable(initial_value, (set) => {
		let inited = false;
		const values = [];
		let pending = 0;
		let cleanup = noop;
		const sync = () => {
			if (pending) {
				return;
			}
			cleanup();
			const result = fn(single ? values[0] : values, set);
			if (auto) {
				set(result);
			} else {
				cleanup = typeof result === "function" ? result : noop;
			}
		};
		const unsubscribers = stores_array.map((store, i) =>
			subscribe(
				store,
				(value) => {
					values[i] = value;
					pending &= ~(1 << i);
					if (inited) {
						sync();
					}
				},
				() => {
					pending |= 1 << i;
				}
			)
		);
		inited = true;
		sync();
		return function stop() {
			unsubscribers.forEach((a) => a());
			cleanup();
		};
	});
}
function readonly(store) {
	return {
		subscribe: store.subscribe.bind(store),
	};
}

export { derived, get_store_value as get, readable, readonly, writable };