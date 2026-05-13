import type { Video } from "@mtcute/core";
import { batch, createEffect, createMemo, createSignal, createUniqueId, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { formatTime, sleep } from "@/helpers";
import SpatialNavigation from "@/lib/spatial_navigation";
import { setStatusbarColor } from "@/stores";
import { downloadToFile, mediaFilename, setSoftkeys } from "@/utils";
import scrollIntoView from "scroll-into-view-if-needed";
import Options from "../components/Options";
import OptionsItem from "../components/OptionsItem";
import OptionsMenuMaxHeight from "../components/OptionsMenuMaxHeight";
import { downloadAsync } from "./MessageMedia";
// @ts-ignore
import * as styles from "./VideoPlayer.module.scss";
import type { Download } from "@/lib/storage";

import { toaster } from "@/utils";
import { volumeDown, volumeUp } from "@/lib/volumeManager";

function willFocusScrollIfNeeded(e: { currentTarget: HTMLElement }) {
	scrollIntoView(e.currentTarget, {
		scrollMode: "if-needed",
		block: "nearest",
		inline: "nearest",
	});
}

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
	// rotateScreen(false);

	try {
		if ("exitFullscreen" in document) {
			await document.exitFullscreen();
		} else if ("mozCancelFullScreen" in document) {
			// @ts-ignore
			await document.mozCancelFullScreen();
		}
	} catch {}
}

async function toggleFullScreen(element?: Element) {
	if (
		// @ts-ignore
		!document.mozFullScreenElement
	) {
		try {
			// current working methods
			if ("requestFullscreen" in document.body) {
				await ((import.meta.env.DEV ? document.body : element) || document.body).requestFullscreen();
			} else if ("mozRequestFullScreen" in document.body) {
				// @ts-ignore
				await ((import.meta.env.DEV ? document.body : element) || document.body).mozRequestFullScreen();
			}
		} catch {}
		return true;
	} else {
		await exitFullscreen();
		return false;
	}
}

export default function VideoPlayer(props: { video: Video; onClose: () => void }) {
	let divRef!: HTMLDivElement;
	let optionDownloadRef!: HTMLDivElement;
	let videoRef!: HTMLVideoElement;
	let downloadRef: Download;
	const optionsSnId = createUniqueId();

	const [src, setSrc] = createSignal("");
	const [downloadUrl, setDownloadUrl] = createSignal("");
	const [cover, setCover] = createSignal("");
	const [playing, setPlaying] = createSignal(false);
	const [loading, setLoading] = createSignal(true);
	const [showOptions, setShowOptions] = createSignal(false);
	const [downloadProgress, setDownloadProgress] = createSignal(0);
	const [currentTime, setCurrentTime] = createSignal(0);
	const [duration, setDuration] = createSignal(props.video.duration || 0);

	const [isFullscreen, setIsFullscreen] = createSignal(false);

	const progress = createMemo(() => {
		const total = duration();
		if (!total) return 0;
		return Math.min(100, (currentTime() / total) * 100);
	});

	const togglePlay = async () => {
		if (!src() || !videoRef) return;
		if (playing()) {
			videoRef.pause();
			setPlaying(false);
			return;
		}
		try {
			await videoRef.play();
			setPlaying(true);
		} catch (err) {
			console.error("[VideoPlayer] play failed", err);
		}
	};

	const seekBy = (direction: 1 | -1) => {
		if (!duration() || !videoRef) return;
		// Reference: step is max(duration/20, 2)
		const step = Math.max(videoRef.duration / 20, 2);
		const next = Math.max(0, Math.min(duration(), videoRef.currentTime + direction * step));
		if (typeof videoRef.fastSeek === "function") {
			videoRef.fastSeek(next);
		} else {
			videoRef.currentTime = next;
		}
		setCurrentTime(next);
	};

	const disposePlayerResources = () => {
		rotateScreen(false);
		exitFullscreen();
		videoRef?.pause();
		videoRef?.removeAttribute("src");
		videoRef?.load();
		batch(() => {
			setPlaying(false);
			setLoading(true);
			setCurrentTime(0);
			setDuration(0);
			setDownloadProgress(0);
			setDownloadUrl("");
			setSrc("");
			setCover("");
			setShowOptions(false);
		});
	};

	const closePlayer = () => {
		disposePlayerResources();
		props.onClose();
	};

	const closeOptions = () => {
		setShowOptions(false);
		queueMicrotask(() => divRef?.focus());
	};

	const handleDownload = () => {
		if (!src()) {
			closeOptions();
			return;
		}
		let url = downloadUrl();
		if (url) {
			downloadToFile(url, mediaFilename(props.video));
		}
		closeOptions();
	};

	onMount(() => {
		divRef.focus();
		setStatusbarColor("#000");

		if (props.video.mimeType) {
			downloadAsync(
				props.video,
				"blob",
				(blob) => {
					const forcedBlob = blob.slice(0, blob.size, props.video.mimeType);
					const url = URL.createObjectURL(forcedBlob);
					setSrc(url);
					setDownloadUrl(url);
					setLoading(false);
					return url;
				},
				setDownloadProgress,
				(ref) => {
					downloadRef = ref;
				},
			);
		} else {
			downloadAsync(
				props.video,
				"url",
				(url) => {
					setSrc(url);
					setDownloadUrl(url);
					setLoading(false);
				},
				setDownloadProgress,
				(ref) => {
					downloadRef = ref;
				},
			);
		}

		const coverThumb = props.video.getThumbnail("m");

		if (coverThumb) {
			downloadAsync(coverThumb, "url", setCover);
		}
	});

	onCleanup(() => {
		disposePlayerResources();

		if (downloadRef) {
			downloadRef.abort();

			if (
				downloadRef.listenerCount("state") > 1 ||
				downloadRef.listenerCount("progress") > 1 ||
				downloadRef.listenerCount("done") > 1
			) {
				// if there are other places downloading this file
			} else {
				downloadRef.abort();
			}
		}
	});

	createEffect(() => {
		if (!showOptions()) return;
		SpatialNavigation.add(optionsSnId, {
			selector: "." + styles.option_item,
			restrict: "self-only",
		});
		SpatialNavigation.focus(optionsSnId);
		onCleanup(() => {
			SpatialNavigation.remove(optionsSnId);
		});
	});

	createEffect(() => {
		if (showOptions()) {
			setSoftkeys("", "Select", "", false, false);
			queueMicrotask(() => optionDownloadRef?.focus());
			return;
		}
		setSoftkeys(
			"Full Screen",
			loading() ? "" : playing() ? "tg:pause" : "tg:play",
			loading() ? "" : "Options",
			false,
			false,
		);
	});

	createEffect(() => {
		console.log("fullscreen", isFullscreen());
	});

	return (
		<>
			<div
				ref={divRef}
				onKeyDown={(e) => {
					if (showOptions()) return;
					const key = e.key;
					switch (key) {
						case "Backspace":
							e.preventDefault();

							if (isFullscreen()) {
								toggleFullScreen(divRef).then((fullscreen) => {
									setIsFullscreen(fullscreen);
								});

								return;
							}

							setTimeout(() => {
								closePlayer();
							}, 100);
							break;
						case "SoftLeft":
							toggleFullScreen(divRef).then((fullscreen) => {
								setIsFullscreen(fullscreen);
							});

							break;
						case "SoftRight":
							e.preventDefault();
							if (loading()) break;
							exitFullscreen();
							setIsFullscreen(false);
							setShowOptions(true);
							break;
						case "Enter":
							e.preventDefault();
							togglePlay();
							break;
						case "ArrowLeft":
							e.preventDefault();
							seekBy(-1);
							break;
						case "ArrowRight":
							e.preventDefault();
							seekBy(1);
							break;

						case "ArrowUp":
							volumeUp();
							break;
						case "ArrowDown":
							volumeDown();
							break;

						default:
							break;
					}
				}}
				tabIndex={-1}
				classList={{ [styles.player]: true, [styles.fullscreen]: isFullscreen() }}
			>
				<div classList={{ [styles.content]: true, [styles.hide]: isFullscreen() }}>
					<Show
						when={!loading()}
						fallback={
							<div class={styles.downloading}>
								<span>Downloading... {Math.floor(downloadProgress())}%</span>
							</div>
						}
					>
						<>
							<div class={styles.timeline}>
								<div class={styles.timeline_fill} style={{ width: `${progress()}%` }}></div>
							</div>
							<div class={styles.times}>
								<span>{formatTime(currentTime())}</span>
								<span>-{formatTime(Math.max(duration() - currentTime(), 0))}</span>
							</div>
						</>
					</Show>
				</div>

				<Show when={src()}>
					<video
						poster={cover() || undefined}
						ref={videoRef}
						src={src()}
						tabIndex={-1}
						controls={false}
						onLoadedMetadata={(e) => {
							const value = Number.isFinite(e.currentTarget.duration)
								? Math.floor(e.currentTarget.duration)
								: props.video.duration || 0;
							setDuration(value);
						}}
						onPlay={() => {
							setPlaying(true);
						}}
						onPause={() => {
							setPlaying(false);
						}}
						onTimeUpdate={(e) => {
							setCurrentTime(e.currentTarget.currentTime);
						}}
						onEnded={() => {
							setPlaying(false);
							setCurrentTime(0);
						}}
						// @ts-ignore
						prop:mozAudioChannelType="content"
						on:error={(evt) => {
							const error = evt.currentTarget.error;
							if (!error) return;
							switch (error.code) {
								case error.MEDIA_ERR_ABORTED:
									// User-initiated abort, ignore
									break;
								case error.MEDIA_ERR_NETWORK:
									toaster("Network error occurred when loading the video");
									break;
								case error.MEDIA_ERR_DECODE:
								case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
									toaster("Video file type is unsupported");
									break;
								default:
									toaster("Unknown error occurred when loading the video");
									break;
							}
						}}
					/>
				</Show>
			</div>

			<Show when={showOptions()}>
				<Portal>
					<Options title="Options" onClose={closeOptions}>
						<OptionsMenuMaxHeight>
							<OptionsItem
								ref={optionDownloadRef}
								on:sn-willfocus={willFocusScrollIfNeeded}
								classList={{ [styles.option_item]: true }}
								tabIndex={-1}
								on:sn-enter-down={handleDownload}
							>
								Download
							</OptionsItem>
							<OptionsItem
								on:sn-willfocus={willFocusScrollIfNeeded}
								classList={{ [styles.option_item]: true }}
								tabIndex={-1}
								on:sn-enter-down={() => {
									closeOptions();
									rotateScreen(screen.orientation.type.startsWith("portrait"));
								}}
							>
								Rotate
							</OptionsItem>
						</OptionsMenuMaxHeight>
					</Options>
				</Portal>
			</Show>
		</>
	);
}
