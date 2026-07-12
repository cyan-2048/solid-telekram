import type { Audio } from "@mtcute/core";
import { batch, createEffect, createMemo, createSignal, createUniqueId, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { formatTime } from "@/helpers";
import SpatialNavigation from "@/lib/spatial_navigation";
import { setStatusbarColor } from "@/stores";
import { downloadToFile, setSoftkeys } from "@/utils";
import defaultCoverImage from "@/assets/default_cover_image.png";
import scrollIntoView from "scroll-into-view-if-needed";
import Options from "../components/Options";
import OptionsItem from "../components/OptionsItem";
import OptionsMenuMaxHeight from "../components/OptionsMenuMaxHeight";
import { downloadAsync } from "./MessageMedia";
import * as styles from "./MusicPlayer.module.scss";
import { volumeDown, volumeUp } from "@/lib/volumeManager";
import type { Download } from "@/lib/storage";

function willFocusScrollIfNeeded(e: { currentTarget: HTMLElement }) {
	scrollIntoView(e.currentTarget, {
		scrollMode: "if-needed",
		block: "nearest",
		inline: "nearest",
	});
}

function fileExtFromMime(mimeType: string): string {
	const ext = mimeType.split("/")[1]?.split(";")[0];
	if (!ext) return "mp3";
	return ext;
}

function musicFilename(audio: Audio): string {
	if (audio.fileName) return audio.fileName;
	const base = audio.title || `audio_${audio.inputDocument.id.toString()}`;

	return `${base}.${fileExtFromMime(audio.mimeType)}`;
}

export default function MusicPlayer(props: { music: Audio; onClose: () => void }) {
	let divRef!: HTMLDivElement;
	let optionDownloadRef!: HTMLDivElement;
	let audioRef!: HTMLAudioElement;
	let downloadRef: Download;
	let nativeEndFallbackTimeout: ReturnType<typeof setTimeout> | null = null;
	const optionsSnId = createUniqueId();

	const [src, setSrc] = createSignal("");
	const [downloadUrl, setDownloadUrl] = createSignal("");
	const [cover, setCover] = createSignal("");
	const [playing, setPlaying] = createSignal(false);
	const [loading, setLoading] = createSignal(true);
	const [showOptions, setShowOptions] = createSignal(false);
	const [downloadProgress, setDownloadProgress] = createSignal(0);
	const [currentTime, setCurrentTime] = createSignal(0);
	const [duration, setDuration] = createSignal(props.music.duration || 0);
	const isFlac = createMemo(() => props.music.mimeType.includes("flac"));

	const title = createMemo(() => props.music.title || props.music.fileName || "Unknown Audio");
	const subtitle = createMemo(() => {
		const performer = props.music.performer || "Unknown Artist";
		return performer;
	});

	const backgroundImage = createMemo(() => `url(${cover() || defaultCoverImage})`);

	const progress = createMemo(() => {
		const total = duration();
		if (!total) return 0;
		return Math.min(100, (currentTime() / total) * 100);
	});

	const clearNativeEndFallback = () => {
		if (!nativeEndFallbackTimeout) return;
		clearTimeout(nativeEndFallbackTimeout);
		nativeEndFallbackTimeout = null;
	};

	const handleNativeEnded = () => {
		clearNativeEndFallback();

		if (audioRef) {
			try {
				audioRef.currentTime = 0;
			} catch {
				// Ignore browsers that may reject setting currentTime at this stage.
			}
		}

		batch(() => {
			setPlaying(false);
			setCurrentTime(0);
		});
	};

	const scheduleNativeEndFallback = () => {
		if (!audioRef) return;

		const total = duration();
		if (!Number.isFinite(total) || total <= 0) return;

		const remainingSeconds = total - audioRef.currentTime;
		if (!Number.isFinite(remainingSeconds)) return;
		if (remainingSeconds > 1.25 || remainingSeconds < 0) return;

		clearNativeEndFallback();
		nativeEndFallbackTimeout = setTimeout(
			() => {
				nativeEndFallbackTimeout = null;
				if (!audioRef) return;

				const nearEnd = audioRef.currentTime >= Math.max(0, total - 0.2);
				const stillPlaying = !audioRef.paused;

				if (nearEnd && stillPlaying) {
					audioRef.pause();
					handleNativeEnded();
				}
			},
			Math.max(300, remainingSeconds * 1000 + 150),
		);
	};

	const togglePlay = async () => {
		if (!src()) return;

		if (!audioRef) return;

		if (playing()) {
			clearNativeEndFallback();
			audioRef.pause();
			setPlaying(false);
			return;
		}

		try {
			await audioRef.play();
			setPlaying(true);
			scheduleNativeEndFallback();
		} catch (err) {
			console.error("[MusicPlayer] play failed", err);
		}
	};

	const seekBy = (offsetSeconds: number) => {
		if (!duration()) return;

		if (!audioRef) return;

		const next = Math.max(0, Math.min(duration(), audioRef.currentTime + offsetSeconds));
		audioRef.currentTime = next;
		setCurrentTime(next);
		scheduleNativeEndFallback();
	};

	const disposePlayerResources = () => {
		clearNativeEndFallback();
		audioRef?.pause();
		audioRef?.removeAttribute("src");
		audioRef?.load();

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
			downloadToFile(url, musicFilename(props.music));
		}

		closeOptions();
	};

	onMount(() => {
		divRef.focus();
		setStatusbarColor("#000");

		if (isFlac()) {
			downloadAsync(
				props.music,
				"blob",
				(blob) => {
					// force mimetype to be flac
					const flacBlob = blob.slice(0, blob.size, "audio/flac");

					const url = URL.createObjectURL(flacBlob);
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
				props.music,
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

		console.error(props.music);

		const coverThumb = props.music.getThumbnail("m") || props.music.getThumbnail("i");
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

		setSoftkeys("Back", loading() ? "" : playing() ? "tg:pause" : "tg:play", loading() ? "" : "Options", false, true);
	});

	return (
		<>
			<div
				ref={divRef}
				onKeyUp={(e) => {
					if (showOptions()) return;

					const key = e.key;

					if (key == "Backspace" || key == "SoftLeft") {
						setTimeout(() => {
							closePlayer();
						}, 100);
					}
				}}
				onKeyDown={(e) => {
					if (showOptions()) return;

					const key = e.key;

					if (key == "Backspace") {
						e.preventDefault();
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
						seekBy(-5);
						return;
					}

					if (key == "ArrowRight") {
						e.preventDefault();
						seekBy(5);
						return;
					}

					if (key == "ArrowUp") {
						e.preventDefault();
						volumeUp();
						return;
					}

					if (key == "ArrowDown") {
						e.preventDefault();
						volumeDown();
					}
				}}
				tabIndex={-1}
				class={styles.player}
				style={{ "background-image": backgroundImage() }}
			>
				<div class={styles.backdrop}></div>
				<div class={styles.content}>
					<div class={styles.title}>{title()}</div>
					<div class={styles.subtitle}>{subtitle()}</div>

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
								<Show when={isFlac()}>
									<span>FLAC</span>
								</Show>
								<span>{formatTime(Math.max(duration() - currentTime(), 0))}</span>
							</div>
						</>
					</Show>
				</div>

				<audio
					// @ts-ignore
					prop:mozAudioChannelType="content"
					ref={audioRef}
					src={src()}
					onLoadedMetadata={(e) => {
						const value = Number.isFinite(e.currentTarget.duration)
							? Math.floor(e.currentTarget.duration)
							: props.music.duration || 0;
						setDuration(value);
					}}
					onPlay={() => {
						setPlaying(true);
						scheduleNativeEndFallback();
					}}
					onPause={() => {
						clearNativeEndFallback();
						setPlaying(false);
					}}
					onTimeUpdate={(e) => {
						setCurrentTime(e.currentTarget.currentTime);
						scheduleNativeEndFallback();
					}}
					onEnded={handleNativeEnded}
				></audio>
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
