import * as signals from "./signals";
import * as utils from "./lib/utils";
import * as files from "./lib/files";
import * as stores from "./lib/stores";
import * as solid from "solid-js";
import { md } from "@mtcute/markdown-parser";
import dayjs from "dayjs";
import * as mtcuteWeb from "@mtcute/web";
import * as mtcuteUtils from "@mtcute/core/utils";

const KeyboardEvent_key_property = Object.getOwnPropertyDescriptor(KeyboardEvent.prototype, "key")!;
Object.defineProperty(KeyboardEvent.prototype, "key", {
	enumerable: true,
	configurable: true,
	get(this: KeyboardEvent) {
		const evt_key = KeyboardEvent_key_property.get!.call(this) as string;
		if (
			(this.ctrlKey || this.altKey) &&
			evt_key.startsWith("Arrow") &&
			(evt_key.endsWith("Left") || evt_key.endsWith("Right"))
		) {
			return "Soft" + evt_key.slice(5);
		}

		if (
			this.shiftKey &&
			evt_key.startsWith("Arrow") &&
			(evt_key.endsWith("Left") || evt_key.endsWith("Right"))
		) {
			return evt_key.endsWith("Left") ? "*" : "#";
		}
		return evt_key;
	},
});

Object.assign(window, {
	signals,
	files,
	solid,
	utils,
	stores,
	md,
	dayjs,
	mtcute: { ...mtcuteWeb, ...mtcuteUtils },
});
