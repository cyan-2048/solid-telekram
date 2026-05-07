import type { Video } from "@mtcute/core";
import { batch, createEffect, createMemo, createSignal, createUniqueId, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { formatTime } from "@/helpers";
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

function willFocusScrollIfNeeded(e: { currentTarget: HTMLElement }) {
	scrollIntoView(e.currentTarget, {
		scrollMode: "if-needed",
		block: "nearest",
		inline: "nearest",
	});
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

	const title = createMemo(() => props.video.fileName || "Unknown Video");
	const backgroundImage = createMemo(() => {
		if (cover()) return `url(${cover()})`;
		return undefined;
	});

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

		// Try to get a video cover/thumbnail
		const coverThumb =
			(props.video as any).videoCover?.getThumbnail?.("m") || (props.video as any).videoCover?.getThumbnail?.("i");
		if (coverThumb) {
			downloadAsync(coverThumb, "url", setCover);
		}
	});

	onCleanup(() => {
		disposePlayerResources();
		downloadRef?.abort();
	});

	createEffect(() => {
		if (!showOptions()) return;
		SpatialNavigation.add(optionsSnId, {
			selector: ".option",
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
		setSoftkeys("Back", loading() ? "" : playing() ? "Pause" : "Play", loading() ? "" : "Options", false, true);
	});

	return (
		<>
			<div
				ref={divRef}
				onKeyDown={(e) => {
					if (showOptions()) return;
					const key = e.key;
					if (key == "Backspace" || key == "SoftLeft") {
						e.preventDefault();
						setTimeout(() => {
							closePlayer();
						}, 100);
						return;
					}
					if (key == "SoftRight") {
						e.preventDefault();
						if (loading()) return;
						setShowOptions(true);
						return;
					}
					if (key == "Enter") {
						e.preventDefault();
						togglePlay();
						return;
					}
					if (key == "ArrowLeft") {
						e.preventDefault();
						seekBy(-1);
						return;
					}
					if (key == "ArrowRight") {
						e.preventDefault();
						seekBy(1);
						return;
					}
				}}
				tabIndex={-1}
				class={styles.player}
				style={{ "background-image": backgroundImage() }}
			>
				<div class={styles.backdrop}></div>
				<div class={styles.content}>
					<div class={styles.title}>{title()}</div>
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
								<span>{formatTime(Math.max(duration() - currentTime(), 0))}</span>
							</div>
						</>
					</Show>
				</div>

				<Show when={src()}>
					<video
						ref={videoRef}
						src={src()}
						tabIndex={-1}
						style={{ width: "100%", "max-height": "60vh", background: "black" }}
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
						onError={(evt) => {
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
								classList={{ option: true, [styles.option_item]: true }}
								tabIndex={-1}
								on:sn-enter-down={handleDownload}
							>
								Download
							</OptionsItem>
						</OptionsMenuMaxHeight>
					</Options>
				</Portal>
			</Show>
		</>
	);
}
