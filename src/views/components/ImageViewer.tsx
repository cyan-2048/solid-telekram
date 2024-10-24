import Zoom, { ZoomRef } from "@/lib/zoom";
import styles from "./ImageViewer.module.scss";
import { pauseKeypress, resumeKeypress, useKeypress } from "@/lib/utils";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import SpatialNavigation from "@/lib/spatial_navigation";
import { Photo, Thumbnail } from "@mtcute/core";
import { downloadFile } from "@/lib/files/download";
import ProgressSpinner from "./ProgressSpinner";

export default function ImageViewer(props: { photo: Photo; onClose?: () => void }) {
	let divRef!: HTMLDivElement;

	const [progress, setProgress] = createSignal(0);

	const [src, setSrc] = createSignal("");
	const [thumb, setThumb] = createSignal("");

	let mounted = true;

	onMount(() => {
		const media = props.photo as Photo;
		const thumb = media.getThumbnail(Thumbnail.THUMB_STRIP);

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	onCleanup(() => {
		mounted = false;
	});

	onMount(() => {
		const download = downloadFile(props.photo.getThumbnail(Thumbnail.THUMB_800x800_BOX) || props.photo);

		let url!: string;

		const stateChange = () => {
			if (download.state == "done") {
				setProgress(100);
				if (mounted) {
					setSrc((url = URL.createObjectURL(download.result)));
				}
			}
		};

		if (download.state == "done") {
			stateChange();

			onCleanup(() => {
				URL.revokeObjectURL(url);
			});

			return;
		}

		function progressChange() {
			// console.error("DOWNLOAD PRESS", download.progress);
			setProgress(download.progress);
		}

		download.on("state", stateChange);
		download.on("progress", progressChange);

		onCleanup(() => {
			download.off("progress", progressChange);
			download.off("state", stateChange);
			URL.revokeObjectURL(url);
		});
		return;
	});

	onMount(() => {
		pauseKeypress();
		SpatialNavigation.add("image-viewer", {
			restrict: "self-only",
			selector: `.${styles.viewer}`,
		});
		SpatialNavigation.focus("image-viewer");
	});

	onCleanup(() => {
		SpatialNavigation.remove("image-viewer");
		divRef?.blur();
		resumeKeypress();
	});

	let zoomRef: ZoomRef | undefined;

	const [pixelated, setPixelated] = createSignal(false);

	useKeypress(
		"SoftRight",
		() => {
			if (zoomRef) {
				if (zoomRef.scaleValue >= 3) setPixelated(true);
				if (zoomRef.scaleValue <= 11) zoomRef.zoomIn();
			}
		},
		true
	);
	useKeypress(
		"SoftLeft",
		() => {
			if (zoomRef) {
				if (zoomRef.scaleValue <= 3) setPixelated(false);
				zoomRef.zoomOut();
			}
		},
		true
	);

	let backspacePaused = false;

	useKeypress(
		["Up", "Down", "Left", "Right"].map((a) => "Arrow" + a),
		({ key }) => {
			const offset = 50;

			const moveImage = zoomRef?.moveImage;
			if (!moveImage) return;

			switch (key.slice(5)) {
				case "Up":
					moveImage(0, offset);
					break;
				case "Down":
					moveImage(0, -offset);
					break;
				case "Left":
					moveImage(offset, 0);
					break;
				case "Right":
					moveImage(-offset, -0);
					break;
			}
		},
		true
	);

	useKeypress(
		"Backspace",
		(e) => {
			e.preventDefault();
			if (!backspacePaused) props.onClose?.();
		},
		true
	);

	return (
		<div ref={divRef} tabIndex={-1} classList={{ [styles.viewer]: true, [styles.pixelated]: pixelated() }}>
			<Show when={!src()}>
				<Show when={thumb()}>
					<img class={styles.thumb} src={thumb()}></img>
				</Show>
			</Show>
			<Show when={src()}>
				<Zoom
					ref={(e) => {
						zoomRef = e;
					}}
					src={src()}
				/>
			</Show>
			<Show when={!src()}>
				<ProgressSpinner size={50} progress={progress() || 1}></ProgressSpinner>
			</Show>
		</div>
	);
}
