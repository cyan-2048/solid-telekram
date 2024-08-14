import { ComponentProps, JSXElement } from "solid-js";

export interface ZoomRef {
	fireManualZoom(dir: number): void;
	zoomIn(): void;
	zoomOut(): void;
	moveImage(x: number, y: number): void;
	scaleValue: number;
}

type _Zoom = (
	props: Omit<ComponentProps<"img">, "ref"> & {
		maxScale?: number;
		scaleValue?: number;
		ref?: (e: ZoomRef) => void;
	}
) => JSXElement;

const Zoom: _Zoom;

export default Zoom;
