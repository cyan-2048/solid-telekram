// DEV env tools

import * as globals from "./globals";
import * as nanostores from "nanostores";
import * as utils from "@utils";
import * as stores from "@stores";
import * as storage from "@/lib/storage";
import * as modals from "@/views/modals";
import * as config from "./config";
// @ts-ignore
import * as leemon from "leemon";
import localforage from "localforage";
import { BigInteger } from "@modern-dev/jsbn";
import Long from "long";
import appVersion from "./lib/appVersion";

import UIDialog from "./ui/UIDialog";

if (import.meta.env.DEV || import.meta.env.CANARY)
	Object.assign(window, {
		Long,
		BigInteger,
		leemon,

		tg: globals.tg,

		...stores,

		$: {
			UIDialog,
			...globals,
			nanostores,
			utils,
			...stores,
			stores,
			localforage,
			storage,
			modals,
			...modals,
			config,
			appVersion,
		},
	});

if (!navigator.mozApps) {
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

			if (this.shiftKey && evt_key.startsWith("Arrow") && (evt_key.endsWith("Left") || evt_key.endsWith("Right"))) {
				return evt_key.endsWith("Left") ? "*" : "#";
			}
			return evt_key;
		},
	});
}
