import type { ComponentProps, JSXElement } from "solid-js";

export interface ZoomRef {
	fireManualZoom(dir: number): void;
	zoomIn(): void;
	zoomOut(): void;
	moveImage(x: number, y: number): void;
	scaleValue: number;
	reset(): void;
}

type _Zoom = (
	props: Omit<ComponentProps<"img">, "ref"> & {
		maxScale?: number;
		scaleValue?: number;
		ref?: (e: ZoomRef) => void;
	},
) => JSXElement;

declare const Zoom: _Zoom;

export default Zoom;
