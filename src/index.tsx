if (import.meta.env.DEV) {
	// @ts-ignore
	await import("./system");
}

/* @refresh reload */
import { render } from "solid-js/web";

import "core-js/actual/array/flat";
import "core-js/actual/array/at";
import "core-js/actual/array/flat-map";

import "core-js/actual/symbol";
import "./lib/scrollBy";
import "./event-target.js";

import "./styles.scss";
import App from "./App";
import localforage from "localforage";

// if (import.meta.env.DEV) {
import("./dev");
// }

import { Buffer } from "buffer";

Object.assign(window, { localforage, Buffer });

render(() => <App />, document.body);
