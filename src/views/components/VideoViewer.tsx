import { formatTime, pauseKeypress, resumeKeypress, useKeypress } from "@/lib/utils";
import styles from "./VideoViewer.module.scss";
import SpatialNavigation from "@/lib/spatial_navigation";
import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { toaster } from "@signals";
import { Thumbnail, Video } from "@mtcute/core";
import { downloadFile } from "@/lib/files/download";
import ProgressSpinner from "./ProgressSpinner";

async function rotateScreen(horizontal: boolean) {
	if ("orientation" in window.screen) {
		try {
			if (horizontal) {
				// @ts-ignore
				await window.screen.orientation.lock("landscape-primary");
			} else {
				// @ts-ignore
				await window.screen.orientation.lock("portrait-primary");
			}
			return true;
		} catch {}
	}
	return false;
}

async function exitFullscreen() {
	rotateScreen(false);

	try {
		if ("exitFullscreen" in document) {
			await document.exitFullscreen();
		} else if ("mozCancelFullScreen" in document) {
			// @ts-ignore
			await document.mozCancelFullScreen();
		}
	} catch {}
}

function toggleFullScreen() {
	if (
		!document.fullscreenElement && // alternative standard method
		// @ts-ignore
		!document.mozFullScreenElement
	) {
		// current working methods
		if ("requestFullscreen" in document.body) {
			document.body.requestFullscreen();
		} else if ("mozRequestFullScreen" in document.body) {
			// @ts-ignore
			document.body.mozRequestFullScreen();
		}
		return true;
	} else {
		exitFullscreen();
		return false;
	}
}

export default function VideoViewer(props: { video: Video; onClose?: () => void }) {
	let divRef!: HTMLDivElement;

	let backspacePaused = false;

	let player!: HTMLVideoElement;

	const [duration, setDuration] = createSignal(0);
	const [time, setTime] = createSignal(0);

	const [paused, setPaused] = createSignal(true);

	const [poster, setPoster] = createSignal("");

	const [progress, setProgress] = createSignal(0);

	const [src, setSrc] = createSignal("");

	let mounted = true;

	onMount(() => {
		const media = props.video;
		const thumb = media.getThumbnail(Thumbnail.THUMB_320x320_BOX) || media.getThumbnail(Thumbnail.THUMB_VIDEO_PREVIEW);

		const download = downloadFile(thumb!);

		let url!: string;

		const stateChange = () => {
			if (download.state == "done" && mounted) {
				setPoster((url = URL.createObjectURL(download.result)));
			}
		};

		if (download.state == "done") {
			stateChange();

			onCleanup(() => {
				URL.revokeObjectURL(url);
				download.abort();
			});

			return;
		}

		download.on("state", stateChange);

		onCleanup(() => {
			download.off("state", stateChange);
			download.abort();
			URL.revokeObjectURL(url);
		});
	});

	onCleanup(() => {
		mounted = false;
	});

	onMount(() => {
		const download = downloadFile(props.video);

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
				download.abort();
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
			download.abort();
			URL.revokeObjectURL(url);
		});
	});

	onMount(() => {
		pauseKeypress();
		SpatialNavigation.add("video-viewer", {
			restrict: "self-only",
			selector: `.${styles.viewer}`,
		});
		SpatialNavigation.focus("video-viewer");
	});

	onCleanup(() => {
		SpatialNavigation.remove("video-viewer");
		divRef?.blur();
		clearTimeout(timeout);
		clearTimeout(controlsTimeout);
		resumeKeypress();
	});

	let timeout: any;

	function handleKeydown(event: KeyboardEvent) {
		if (!player) return;
		const { key } = event;

		var step = Math.max(player.duration / 20, 2);
		if (key === "ArrowLeft") {
			player.fastSeek(player.currentTime - step);
		} else if (key === "ArrowRight") {
			player.fastSeek(player.currentTime + step);
		} else if (key == "ArrowUp") {
			// @ts-ignore
			navigator.volumeManager?.requestUp();
		} else if (key == "ArrowDown") {
			// @ts-ignore
			navigator.volumeManager?.requestDown();
		}
	}

	const progressTime = () => {
		if (time() && duration()) {
			return (time() / duration()) * 100;
		}
		return 0;
	};

	const [show, setShow] = createSignal(true);

	let controlsTimeout: any;

	const controls = () => {
		controlsTimeout = setTimeout(() => {
			setShow(paused());
		}, 10_000);
	};

	return (
		<div
			onKeyDown={(e) => {
				console.log("KEYDOWWNNN");
				setShow(true);
				clearTimeout(controlsTimeout);

				handleKeydown(e);

				if (e.key == "Backspace") {
					e.preventDefault();
					if (!backspacePaused) {
						if (
							!document.fullscreenElement && // alternative standard method
							// @ts-ignore
							!document.mozFullScreenElement
						)
							props.onClose?.();
						exitFullscreen();
					}
					return;
				}

				if (e.key == "Enter" || e.key == "SoftLeft") {
					player.paused ? player.play() : player.pause();
					setPaused(player.paused);
				}
				if (e.key == "SoftRight") {
					const isFullscreen = toggleFullScreen();
					if (isFullscreen && player.videoHeight < player.videoWidth) {
						rotateScreen(true);
					}
				}
			}}
			onKeyUp={() => {
				clearTimeout(controlsTimeout);
				controls();
			}}
			ref={divRef}
			class={styles.viewer}
			tabIndex={-1}
		>
			<Show when={src()}>
				<video
					poster={poster()}
					onError={function (evt) {
						switch (evt.currentTarget.error!.code) {
							case MediaError.MEDIA_ERR_ABORTED:
								// This aborted error should be triggered by the user
								// so we don't have to show any error messages
								return;
							case MediaError.MEDIA_ERR_NETWORK:
								toaster("Network error occured when loading the video");
								break;
							case MediaError.MEDIA_ERR_DECODE:
							case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
								// If users tap some video link in an offline page
								// the error code will be MEDIA_ERR_SRC_NOT_SUPPORTED
								// we also prompt the unsupported error message for it
								toaster("Video file type is unsupported");
								break;
							// Is it possible to be unknown errors?
							default:
								toaster("Unknown error occured when loading the video");
								break;
						}
					}}
					ref={player}
					onTimeUpdate={() => {
						clearTimeout(timeout);
						setTime(player.currentTime);
						setPaused(player.paused);
						timeout = setTimeout(() => {
							if (player.paused) {
								setPaused(player.paused);
							}
						}, 1000);
					}}
					onLoadedMetadata={() => {
						setDuration(player.duration != Infinity && !Number.isNaN(player.duration) ? player.duration : 0);
					}}
					src={src()}
				></video>
			</Show>
			<Show when={!src()}>
				<Show when={poster()}>
					<img class={styles.thumb} src={poster()}></img>
				</Show>
				<ProgressSpinner class={styles.progress_spin} size={50} progress={progress() || 1}></ProgressSpinner>
			</Show>
			<div
				style={{
					opacity: show() ? 1 : 0,
				}}
				class={styles.controls}
			>
				<div class={styles.icon}>
					<Show
						when={paused()}
						fallback={
							<svg role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
								<path
									fill="currentColor"
									d="M6 4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H6ZM15 4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3Z"
									class=""
								></path>
							</svg>
						}
					>
						<svg role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M9.25 3.35C7.87 2.45 6 3.38 6 4.96v14.08c0 1.58 1.87 2.5 3.25 1.61l10.85-7.04a1.9 1.9 0 0 0 0-3.22L9.25 3.35Z"
								class=""
							></path>
						</svg>
					</Show>
				</div>
				<div class={styles.time}>
					{formatTime(time())}
					{" / "}
					{formatTime(duration())}
				</div>
				<div class={styles.progress_wrap}>
					<div class={styles.progress} style={{ width: progressTime() + "%" }}></div>
				</div>
				<div class={styles.icon}>
					<svg role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M4 6c0-1.1.9-2 2-2h3a1 1 0 0 0 0-2H6a4 4 0 0 0-4 4v3a1 1 0 0 0 2 0V6ZM4 18c0 1.1.9 2 2 2h3a1 1 0 1 1 0 2H6a4 4 0 0 1-4-4v-3a1 1 0 1 1 2 0v3ZM18 4a2 2 0 0 1 2 2v3a1 1 0 1 0 2 0V6a4 4 0 0 0-4-4h-3a1 1 0 1 0 0 2h3ZM20 18a2 2 0 0 1-2 2h-3a1 1 0 1 0 0 2h3a4 4 0 0 0 4-4v-3a1 1 0 1 0-2 0v3Z"
							class=""
						></path>
					</svg>
				</div>
			</div>
		</div>
	);
}
