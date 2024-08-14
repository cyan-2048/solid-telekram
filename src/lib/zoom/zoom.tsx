import { sleep } from "../utils";
import styles from "./Zoom.module.scss";
// @ts-ignore
import Matrix from "./matrix";
// @ts-ignore
import { calculateAspectRatioFit } from "./other";
import { createSignal, ComponentProps, splitProps, createEffect, onCleanup, untrack, onMount } from "solid-js";

const alt = "svelte-zoom";

interface ZoomRef {
	fireManualZoom(dir: number): void;
	zoomIn(): void;
	zoomOut(): void;
	moveImage(x: number, y: number): void;
	scaleValue: number;
}

export default function Zoom(
	props: Omit<ComponentProps<"img">, "ref"> & {
		maxScale?: number;
		scaleValue?: number;
		ref?: (e: ZoomRef) => void;
	}
) {
	const [_props, $$props] = splitProps(props, ["maxScale", "scaleValue", "src"]);

	let imgEl!: HTMLImageElement;

	const maxScale = _props.maxScale ?? 11;
	const [transform, setTransform] = createSignal(undefined as string | undefined);
	const [scaleValue, setScaleValue] = createSignal(_props.scaleValue ?? 1);
	const [src, setSrc] = createSignal("");

	createEffect(() => {
		setSrc(_props.src || "");

		let timeout: Timer;

		const img = imgEl;
		if (!img) return;

		const loaded = () => img.complete && img.naturalHeight !== 0;

		if (!loaded()) {
			timeout = setTimeout(async () => {
				if (!loaded()) {
					setSrc("");
					await sleep(100);
					setSrc(_props.src || "");
				}
			}, 1000);
		}

		onCleanup(() => {
			clearTimeout(timeout);
		});
	});

	const xY = {
		initX: 0,
		initY: 0,
		newX: 0,
		newY: 0,
	};

	const matrix = new Matrix();
	let ratio: any;

	const [contain, setContain] = createSignal(null as null | boolean);
	const [smooth, setSmooth] = createSignal(true);
	const [scaling, setScaling] = createSignal(false);

	// exports
	const fireManualZoom = function (dir: number) {
		const _matrix = matrix,
			_ratio = ratio;

		const { innerHeight, innerWidth } = window;

		const xFactor = 1 + 0.2 * dir;
		const yFactor = (xFactor * innerHeight) / innerWidth;

		let in_x = (innerWidth - _ratio.width * _matrix.vtm.a) / 2;
		let in_y = (innerHeight - _ratio.height * _matrix.vtm.a) / 2;

		const origin = {
			x: innerWidth / 2,
			y: innerHeight / 2,
		};

		// console.log(xFactor, yFactor, origin, in_x, in_y, _ratio, maxScale, untrack(scaleValue) * xFactor, dir);

		const mat = _matrix.scale(
			xFactor,
			yFactor,
			origin,
			in_x,
			in_y,
			_ratio,
			maxScale,
			untrack(scaleValue) * xFactor,
			dir
		);
		setTransform(`translate(${mat.e}px,${mat.f}px) scale(${mat.d})`);
		setScaleValue(mat.d);
	};

	// exports
	const moveImage = function (x: number, y: number) {
		const { innerWidth, innerHeight } = window;

		const [a, b] = [innerWidth / 2, innerHeight / 2];

		fireDown(a, b);
		setSmooth(false);
		fireMove(a + x, b + y);
		fireUp();
	};

	// exports
	const zoomIn = () => fireManualZoom(1);

	// exports
	const zoomOut = () => fireManualZoom(-1);

	const fireUp = function () {
		const _xY = xY,
			_matrix = matrix;

		_matrix.x -= _xY.newX;
		_matrix.y -= _xY.newY;

		setScaling(false);
		setSmooth(true);
	};

	const fireMove = function (x: number, y: number) {
		const _xY = xY,
			_matrix = matrix,
			_ratio = ratio;
		if (untrack(scaling)) return;
		let in_x = (window.innerWidth - _ratio.width * _matrix.vtm.a) / 2;
		let in_y = (window.innerHeight - _ratio.height * _matrix.vtm.a) / 2;

		_xY.newX = _xY.initX - x;
		_xY.newY = _xY.initY - y;
		const mat = _matrix.move(in_x >= 0 ? 0 : _xY.newX, in_y >= 0 ? 0 : _xY.newY, in_x, in_y, _ratio);

		setTransform(`matrix(${mat.a},${mat.b},${mat.c},${mat.d},${mat.e}, ${mat.f})`);
	};

	const fireDown = function (x: number, y: number) {
		const _matrix = matrix,
			_xY = xY;
		_xY.initX = x;
		_xY.initY = y;

		_matrix.x = _matrix.vtm.e;
		_matrix.y = _matrix.vtm.f;
	};

	const zoomRef = { zoomIn, zoomOut, moveImage, fireManualZoom, scaleValue: scaleValue() };

	createEffect(() => {
		zoomRef.scaleValue = scaleValue();
		typeof props.ref == "function" && props.ref(zoomRef);
	});

	onMount(() => {
		const onLoad = (e: Event & { currentTarget: any }) => {
			const { naturalWidth, naturalHeight } = e.currentTarget;
			const { innerHeight, innerWidth } = window;

			setContain(naturalWidth > innerWidth || naturalHeight > innerHeight);

			ratio = calculateAspectRatioFit(naturalWidth, naturalHeight, innerWidth, innerHeight);
		};

		imgEl.addEventListener("load", onLoad);

		onCleanup(() => {
			imgEl.removeEventListener("load", onLoad);
		});
	});

	return (
		<img
			alt={alt}
			classList={{
				[styles.zoom]: true,
				[styles.contain]: !!contain(),
				[styles.no_contain]: !contain(),
				[styles.transition]: smooth(),
				[styles.visible]: !!contain(),
				[styles.hidden]: contain() === null,
			}}
			style={{ transform: transform() }}
			draggable={false}
			src={src()}
			{...$$props}
			ref={imgEl}
		/>
	);
}
