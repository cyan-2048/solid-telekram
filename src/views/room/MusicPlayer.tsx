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
	const base = audio.title || "audio";
	return `${base}.${fileExtFromMime(audio.mimeType)}`;
}

type FlacPlayer = {
	playing: boolean;
	play: () => void;
	pause: () => void;
	stop: () => void;
	preload?: () => void;
	seek: (ms: number) => number;
	on: (event: string, callback: (...args: any[]) => void) => void;
	off?: (event: string, callback: (...args: any[]) => void) => void;
	destroy?: () => void;
};

type FlacPlayerListeners = {
	onDuration: (ms: number) => void;
	onProgress: (ms: number) => void;
	onEnd: () => void;
	onError: (err: unknown) => void;
	onReady: () => void;
};

function canSeekFlacPlayer(player: FlacPlayer | null): boolean {
	if (!player) return false;

	const p = player as any;
	const demuxer = p?.asset?.decoder?.demuxer;
	if (!demuxer) return false;

	const format = demuxer.format;
	if (format && format.framesPerPacket > 0 && format.bytesPerPacket > 0) {
		return true;
	}

	const seekPoints = demuxer.seekPoints;
	return Array.isArray(seekPoints) && seekPoints.length > 0;
}

function MusicPlayerShared(props: { music: Audio; onClose: () => void; useFlacDecoder?: boolean }) {
	let divRef!: HTMLDivElement;
	let flacListeners: FlacPlayerListeners | null = null;
	let optionDownloadRef!: HTMLDivElement;
	let audioRef!: HTMLAudioElement;
	let flacPlayer: FlacPlayer | null = null;
	let FlacModule: any = null;
	let flacCanSeekKnown = true;
	let downloadRef: Download;
	let nativeEndFallbackTimeout: ReturnType<typeof setTimeout> | null = null;
	const optionsSnId = createUniqueId();

	const [src, setSrc] = createSignal("");
	const [downloadUrl, setDownloadUrl] = createSignal("");
	const [downloadBuffer, setDownloadBuffer] = createSignal<ArrayBuffer | null>(null);
	const [cover, setCover] = createSignal("");
	const [playing, setPlaying] = createSignal(false);
	const [loading, setLoading] = createSignal(true);
	const [showOptions, setShowOptions] = createSignal(false);
	const [downloadProgress, setDownloadProgress] = createSignal(0);
	const [currentTime, setCurrentTime] = createSignal(0);
	const [duration, setDuration] = createSignal(props.music.duration || 0);
	const [flacReady, setFlacReady] = createSignal(false);
	const [canSeek, setCanSeek] = createSignal(!props.useFlacDecoder);

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
		if (props.useFlacDecoder) return;
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

	const destroyFlacPlayer = () => {
		if (!flacPlayer) return;

		if (flacListeners && flacPlayer.off) {
			flacPlayer.off("duration", flacListeners.onDuration);
			flacPlayer.off("progress", flacListeners.onProgress);
			flacPlayer.off("end", flacListeners.onEnd);
			flacPlayer.off("error", flacListeners.onError);
			flacPlayer.off("ready", flacListeners.onReady);
		}

		flacPlayer.pause();
		flacPlayer.stop();
		flacPlayer.destroy?.();
		flacPlayer = null;
		flacListeners = null;

		setPlaying(false);
		setFlacReady(false);
	};

	const createFlacPlayer = () => {
		if (!props.useFlacDecoder) return null;
		if (!FlacModule) return null;
		const buffer = downloadBuffer();
		if (!buffer) return null;

		destroyFlacPlayer();

		const player = FlacModule.Player.fromBuffer(buffer) as FlacPlayer;
		flacPlayer = player;
		setCurrentTime(0);
		setFlacReady(false);
		setCanSeek(flacCanSeekKnown);
		player.preload?.();

		const onDuration = (ms: number) => {
			if (flacPlayer !== player) return;
			if (!Number.isFinite(ms)) return;
			setDuration(Math.max(0, Math.floor(ms / 1000)));
		};

		const onProgress = (ms: number) => {
			if (flacPlayer !== player) return;
			if (!Number.isFinite(ms)) return;
			setCurrentTime(Math.max(0, ms / 1000));
		};

		const onEnd = () => {
			if (flacPlayer !== player) return;

			destroyFlacPlayer();
			batch(() => {
				setCurrentTime(0);
				setCanSeek(flacCanSeekKnown);
			});
		};

		const onError = (err: unknown) => {
			if (flacPlayer !== player) return;
			console.error("[MusicPlayer][FLAC] error", err);
			setPlaying(false);
			setCanSeek(false);
		};

		const onReady = () => {
			if (flacPlayer !== player) return;
			flacCanSeekKnown = canSeekFlacPlayer(player);
			setFlacReady(true);
			setCanSeek(flacCanSeekKnown);
		};

		flacListeners = {
			onDuration,
			onProgress,
			onEnd,
			onError,
			onReady,
		};

		player.on("duration", flacListeners.onDuration);
		player.on("progress", flacListeners.onProgress);
		player.on("end", flacListeners.onEnd);
		player.on("error", flacListeners.onError);
		player.on("ready", flacListeners.onReady);

		return player;
	};

	const togglePlay = async () => {
		if (!src()) return;

		if (props.useFlacDecoder) {
			if (!flacPlayer) {
				const recreated = createFlacPlayer();
				if (!recreated) return;
			}

			const player = flacPlayer;
			if (!player) return;

			if (playing()) {
				player.pause();
				setPlaying(false);
				return;
			}

			player.play();
			setPlaying(true);
			return;
		}

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
		if (!canSeek()) return;
		if (!duration()) return;

		if (props.useFlacDecoder) {
			if (!flacPlayer) return;
			if (!flacReady()) return;

			const next = Math.max(0, Math.min(duration(), currentTime() + offsetSeconds));

			try {
				flacPlayer.seek(next * 1000);
			} catch (err) {
				console.error("[MusicPlayer][FLAC] seek failed", err);
				return;
			}

			setCurrentTime(next);
			return;
		}

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

		if (flacPlayer) {
			destroyFlacPlayer();
		}

		batch(() => {
			setPlaying(false);
			setLoading(true);
			setCurrentTime(0);
			setDuration(0);
			setDownloadProgress(0);
			setFlacReady(false);
			setDownloadBuffer(null);
			setDownloadUrl("");
			setSrc("");
			setCover("");
			setShowOptions(false);
			setCanSeek(!props.useFlacDecoder);
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
		let ephemeralUrl: string | null = null;

		if (!url && props.useFlacDecoder && downloadBuffer()) {
			ephemeralUrl = URL.createObjectURL(new Blob([downloadBuffer()!], { type: props.music.mimeType || "audio/flac" }));
			url = ephemeralUrl;
		}

		if (url) {
			downloadToFile(url, musicFilename(props.music));
			if (ephemeralUrl) {
				setTimeout(() => URL.revokeObjectURL(ephemeralUrl!), 1000);
			}
		}

		closeOptions();
	};

	onMount(() => {
		divRef.focus();
		setStatusbarColor("#000");

		if (props.useFlacDecoder) {
			downloadAsync(
				props.music,
				"buffer",
				async (buffer) => {
					FlacModule = (await import("@/lib/flac")).default;

					setSrc("flac://loaded");
					setDownloadBuffer(buffer);
					setLoading(false);
					createFlacPlayer();
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
		downloadRef.abort();
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
						if (canSeek()) seekBy(-5);
						return;
					}

					if (key == "ArrowRight") {
						e.preventDefault();
						if (canSeek()) seekBy(5);
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
								<Show when={props.useFlacDecoder}>
									<span>FLAC</span>
								</Show>
								<span>{formatTime(Math.max(duration() - currentTime(), 0))}</span>
							</div>
							<Show when={!canSeek()}>
								<div class={styles.controls}>Seek unavailable</div>
							</Show>
						</>
					</Show>
				</div>

				<audio
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

export default function MusicPlayer(props: { music: Audio; onClose: () => void }) {
	const useFlacDecoder = props.music.mimeType.includes("flac") && import.meta.env.KAIOS == 2;

	return <MusicPlayerShared {...props} useFlacDecoder={useFlacDecoder} />;
}
