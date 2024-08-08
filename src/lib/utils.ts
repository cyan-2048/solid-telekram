import { tl } from "@mtcute/tl";
import scrollIntoViewNPM from "scroll-into-view";
import { Accessor, createEffect, createRenderEffect, createSignal, onCleanup } from "solid-js";
import { Readable, get } from "./stores";
import { UIDialog, UIMessage } from "@signals";

export * from "./helpers";

const keyList = Object.keys;

function shallowEqual(a: any, b: any) {
	if (a === b) return true;
	if (!(a instanceof Object) || !(b instanceof Object)) return false;

	var keys = keyList(a);
	var length = keys.length;

	for (var i = 0; i < length; i++) if (!(keys[i] in b)) return false;

	for (var i = 0; i < length; i++) if (a[keys[i]] !== b[keys[i]]) return false;

	return length === keyList(b).length;
}

export function useStore<T>(
	_readable: Readable<T> | undefined | null | (() => Readable<T> | undefined | null)
): Accessor<T>;
export function useStore<T, R extends keyof T>(
	_readable: Readable<T> | undefined | null | (() => Readable<T> | undefined | null),
	key: R
): Accessor<T[R]>;
export function useStore<T, R extends keyof T>(
	_readable: Readable<T> | undefined | null | (() => Readable<T> | undefined | null),
	key?: R
) {
	const readable = () => (typeof _readable === "function" ? _readable() : _readable);

	const initReadable = readable();

	const [state, setState] = createSignal(
		key != undefined ? initReadable && get(initReadable)[key] : initReadable && get(initReadable),
		{
			equals: (a, b) => {
				// we only do shallow compare if key is undefined
				if (key != undefined) {
					return shallowEqual(a, b);
				} else {
					// svelte stores don't do shallow equality checks
					return false;
				}
			},
			name: "useStore",
		}
	);

	createRenderEffect(() => {
		const unsub = readable()?.subscribe((val) => {
			setState(() => (key != undefined ? val[key] : val));
		});

		unsub && onCleanup(unsub);
	});

	return state;
}

export function centerScroll(el: HTMLElement | Element, sync = false, time = 200) {
	return new Promise<boolean>((res) => {
		scrollIntoViewNPM(
			el as HTMLElement,
			{ time: sync ? 0 : time, align: { left: 0 }, ease: (e: number) => e },
			(type: string) => {
				res(type === "complete");
			}
		);
	});
}

const [isKeypressPaused, setKeypressPaused] = /*#__PURE__*/ createSignal(false);

export function pauseKeypress() {
	setKeypressPaused(true);
}

export function resumeKeypress() {
	setKeypressPaused(false);
}

export { isKeypressPaused };

export function useMessageChecks(message: () => UIMessage, dialog: () => UIDialog) {
	const lastReadOutgoing = useStore(() => dialog().lastReadOutgoing);

	// returns false if double check
	const check = () => lastReadOutgoing() < message().id;
	return check;
}

export const useKeypress = (keys: string | string[], handler: (e: KeyboardEvent) => void, force = false) => {
	const eventListener = (event: KeyboardEvent) => {
		if (isKeypressPaused() && !force) return;

		const _keys = [keys].flat();

		if (_keys.includes(event.key)) {
			handler(event);
		}
	};

	window.addEventListener("keydown", eventListener, true);

	onCleanup(() => {
		window.removeEventListener("keydown", eventListener, true);
	});
};

function getScrollParent(node: any): any {
	if (node == null) {
		return null;
	}

	if (node.scrollHeight > node.clientHeight) {
		return node;
	} else {
		return getScrollParent(node.parentNode);
	}
}

export function scrollIntoView(element: HTMLElement) {
	const scrollerElement = getScrollParent(element);
	if (!scrollerElement) return;

	const rect = element.getBoundingClientRect();

	if (rect.top - scrollerElement.offsetTop < 0) {
		element.scrollIntoView(true); // top
		return;
	}

	const diff = rect.bottom - (scrollerElement.offsetHeight + scrollerElement.offsetTop);

	if (diff >= -0.5) {
		element.scrollIntoView(false); // bottom
	}
}

/**
 *
 * color utils taken from tweb
 */

type ColorRgba = [number, number, number, number];

export function hexaToRgba(hexa: string) {
	const arr: ColorRgba = [] as any;
	const offset = hexa[0] === "#" ? 1 : 0;
	if (hexa.length === 5 + offset) {
		hexa = (offset ? "#" : "") + "0" + hexa.slice(offset);
	}

	if (hexa.length === 3 + offset) {
		for (let i = offset; i < hexa.length; ++i) {
			arr.push(parseInt(hexa[i] + hexa[i], 16));
		}
	} else if (hexa.length === 4 + offset) {
		for (let i = offset; i < hexa.length - 1; ++i) {
			arr.push(parseInt(hexa[i] + hexa[i], 16));
		}

		arr.push(parseInt(hexa[hexa.length - 1], 16));
	} else {
		for (let i = offset; i < hexa.length; i += 2) {
			arr.push(parseInt(hexa.slice(i, i + 2), 16));
		}
	}

	return arr;
}

type ColorHsla = {
	h: number;
	s: number;
	l: number;
	a: number;
};

/**
 * @returns h [0, 360], s [0, 100], l [0, 100], a [0, 1]
 */
export function rgbaToHsla(r: number, g: number, b: number, a: number = 1): ColorHsla {
	(r /= 255), (g /= 255), (b /= 255);
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h!: number, s!: number;
	const l = (max + min) / 2;

	if (max === min) {
		h = s = 0; // achromatic
	} else {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return {
		h: h * 360,
		s: s * 100,
		l: l * 100,
		a,
	};
}

export function hexaToHsla(hexa: string) {
	const rgba = hexaToRgba(hexa);
	return rgbaToHsla(rgba[0], rgba[1], rgba[2], rgba[3]);
}

export type RawPeer = tl.RawUser | tl.RawChat | tl.RawChannel | tl.RawChatForbidden | tl.RawChannelForbidden;

function getPeerColorIndexById(peerId: number) {
	return Math.abs(peerId) % 7;
}

const DialogColorsFg: Array<string[]> = [
		["#CC5049"],
		["#D67722"],
		["#955CDB"],
		["#40A920"],
		["#309EBA"],
		["#368AD1"],
		["#C7508B"],
	],
	DialogColors = ["red", "orange", "violet", "green", "cyan", "blue", "pink"] as const;

export function getColorFromPeer(peer: RawPeer) {
	if (!peer) return "blue";

	const assertColor = (color?: number) => (color ? color != -1 && color : false);

	let idx =
		"color" in peer ? assertColor(peer.color?.color) || getPeerColorIndexById(peer.id) : getPeerColorIndexById(peer.id);

	let color = DialogColors[idx];

	if (!color) {
		const fgColor = DialogColorsFg[idx];
		if (!fgColor) {
			return DialogColors[getPeerColorIndexById(peer.id)];
		}

		const hsla = hexaToHsla(fgColor[0]);
		const hue = hsla.h;

		if (hue >= 345 || hue < 29) idx = 0; // red
		else if (hue < 67) idx = 1; // orange
		else if (hue < 140) idx = 3; // green
		else if (hue < 199) idx = 4; // cyan
		else if (hue < 234) idx = 5; // blue
		else if (hue < 301) idx = 2; // violet
		else idx = 6; // pink

		color = DialogColors[idx];
	}

	return color;
}

export function typeInTextbox(
	newText: string,
	el = document.activeElement as HTMLTextAreaElement | HTMLInputElement | HTMLElement
) {
	if ("value" in el) {
		const start = el.selectionStart!;
		const end = el.selectionEnd!;
		const text = el.value;
		const before = text.substring(0, start);
		const after = text.substring(end, text.length);
		el.value = before + newText + after;
		el.selectionStart = el.selectionEnd = start + newText.length;
		el.focus();
	} else {
		el.focus();
		try {
			document.execCommand("insertText", false, newText);
		} catch {}
	}

	el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function getTextFromContentEditable(e: HTMLElement) {
	let text = "";

	e.childNodes.forEach((node, i, parent) => {
		if (node.nodeType === Node.TEXT_NODE) {
			text = text + node.nodeValue;
			// get rid of trailing \n ?
		} else if (node.nodeName === "BR" && i != parent.length - 1) {
			text = text + "\n";
		}
	});

	return text;
}

export function isSelectionAtStart() {
	const selection = document.getSelection();

	if (!selection) return false;

	if (!selection.anchorNode) return false;

	if (selection.anchorOffset != 0) return false;

	if ((selection.anchorNode as HTMLElement).isContentEditable) return true;

	const parent = selection.anchorNode.parentElement;

	if (parent) {
		return parent.isContentEditable && parent.firstChild == selection.anchorNode;
	}

	return false;
}
