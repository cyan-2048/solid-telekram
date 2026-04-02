import type { Audio } from "@mtcute/core";
import { batch, createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { formatTime } from "@/helpers";
import { setStatusbarColor } from "@/stores";
import { downloadToFile, setSoftkeys } from "@/utils";
import defaultCoverImage from "@/assets/default_cover_image.png";
import Options from "../components/Options";
import OptionsItem from "../components/OptionsItem";
import OptionsMenuMaxHeight from "../components/OptionsMenuMaxHeight";
import { downloadAsync } from "./MessageMedia";
import * as styles from "./MusicPlayer.module.scss";

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
	let optionDownloadRef!: HTMLDivElement;
	let audioRef!: HTMLAudioElement;
	let flacPlayer: FlacPlayer | null = null;

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
		const codec = props.useFlacDecoder ? " • FLAC" : "";
		return `${performer} • ${formatTime(duration())}${codec}`;
	});

	const backgroundImage = createMemo(() => `url(${cover() || defaultCoverImage})`);

	const progress = createMemo(() => {
		const total = duration();
		if (!total) return 0;
		return Math.min(100, (currentTime() / total) * 100);
	});

	const controlsText = createMemo(() => {
		if (!canSeek()) {
			return `${playing() ? "Pause" : "Play"} • Seek unavailable`;
		}

		return `${playing() ? "Pause" : "Play"} • Left/Right seek`;
	});

	const togglePlay = async () => {
		if (!src()) return;

		if (props.useFlacDecoder) {
			if (!flacPlayer) return;

			if (playing()) {
				flacPlayer.pause();
				setPlaying(false);
				return;
			}

			flacPlayer.play();
			setPlaying(true);
			return;
		}

		if (!audioRef) return;

		if (playing()) {
			audioRef.pause();
			setPlaying(false);
			return;
		}

		try {
			await audioRef.play();
			setPlaying(true);
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
	};

	const disposePlayerResources = () => {
		audioRef?.pause();
		audioRef?.removeAttribute("src");
		audioRef?.load();

		if (flacPlayer) {
			flacPlayer.pause();
			flacPlayer.stop();
			flacPlayer.destroy?.();
			flacPlayer = null;
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

	onMount(() => {
		divRef.focus();
		setStatusbarColor("#000");

		if (props.useFlacDecoder) {
			downloadAsync(
				props.music,
				"buffer",
				async (buffer) => {
					const AV = (await import("@/lib/flac")).default;

					setSrc("flac://loaded");
					setDownloadBuffer(buffer);
					setLoading(false);

					const player = AV.Player.fromBuffer(buffer) as FlacPlayer;
					flacPlayer = player;
					player.preload?.();

					const onDuration = (ms: number) => {
						if (!Number.isFinite(ms)) return;
						setDuration(Math.max(0, Math.floor(ms / 1000)));
					};

					const onProgress = (ms: number) => {
						if (!Number.isFinite(ms)) return;
						setCurrentTime(Math.max(0, ms / 1000));
					};

					const onEnd = () => {
						batch(() => {
							setPlaying(false);
							setCurrentTime(0);
						});
					};

					const onError = (err: unknown) => {
						console.error("[MusicPlayer][FLAC] error", err);
						setPlaying(false);
						setCanSeek(false);
					};

					const onReady = () => {
						setFlacReady(true);
						setCanSeek(canSeekFlacPlayer(player));
					};

					player.on("duration", onDuration);
					player.on("progress", onProgress);
					player.on("end", onEnd);
					player.on("error", onError);
					player.on("ready", onReady);

					onCleanup(() => {
						if (player.off) {
							player.off("duration", onDuration);
							player.off("progress", onProgress);
							player.off("end", onEnd);
							player.off("error", onError);
							player.off("ready", onReady);
						}

						player.pause();
						player.stop();
						player.destroy?.();
						flacPlayer = null;
						setDownloadBuffer(null);
					});
				},
				setDownloadProgress,
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
			);
		}

		const coverThumb = props.music.getThumbnail("m") || props.music.getThumbnail("i");
		if (coverThumb) {
			downloadAsync(coverThumb, "url", setCover);
		}
	});

	onCleanup(() => {
		disposePlayerResources();
	});

	createEffect(() => {
		if (showOptions()) {
			setSoftkeys("Cancel", "Select", "", false, false);
			queueMicrotask(() => optionDownloadRef?.focus());
			return;
		}

		setSoftkeys("Back", loading() ? "" : playing() ? "Pause" : "Play", "Options", false, true);
	});

	return (
		<>
			<div
				ref={divRef}
				on:keydown={(e) => {
					if (showOptions()) return;

					const key = e.key;

					if (key == "Backspace" || key == "SoftLeft") {
						e.preventDefault();
						closePlayer();
						return;
					}

					if (key == "SoftRight") {
						e.preventDefault();
						setShowOptions(true);
						return;
					}

					if (key == "Enter" || key == "SoftCenter") {
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
						fallback={<div class={styles.subtitle}>Loading... {Math.floor(downloadProgress())}%</div>}
					>
						<>
							<div class={styles.timeline}>
								<div class={styles.timeline_fill} style={{ width: `${progress()}%` }}></div>
							</div>
							<div class={styles.times}>
								<span>{formatTime(currentTime())}</span>
								<span>{formatTime(Math.max(duration() - currentTime(), 0))}</span>
							</div>
							<div class={styles.controls}>{controlsText()}</div>
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
					onPlay={() => setPlaying(true)}
					onPause={() => setPlaying(false)}
					onTimeUpdate={(e) => {
						setCurrentTime(e.currentTarget.currentTime);
					}}
					onEnded={() => {
						batch(() => {
							setPlaying(false);
							setCurrentTime(0);
						});
					}}
				></audio>
			</div>

			<Show when={showOptions()}>
				<Portal>
					<Options
						title="Options"
						onClose={() => {
							setShowOptions(false);
							queueMicrotask(() => divRef?.focus());
						}}
					>
						<OptionsMenuMaxHeight>
							<OptionsItem
								ref={optionDownloadRef}
								tabIndex={0}
								on:keydown={(e) => {
									if (e.key !== "Enter") return;
									e.preventDefault();

									if (!src()) {
										setShowOptions(false);
										queueMicrotask(() => divRef?.focus());
										return;
									}

									let url = downloadUrl();
									let ephemeralUrl: string | null = null;

									if (!url && props.useFlacDecoder && downloadBuffer()) {
										ephemeralUrl = URL.createObjectURL(
											new Blob([downloadBuffer()!], { type: props.music.mimeType || "audio/flac" }),
										);
										url = ephemeralUrl;
									}

									if (url) {
										downloadToFile(url, musicFilename(props.music));
										if (ephemeralUrl) {
											setTimeout(() => URL.revokeObjectURL(ephemeralUrl!), 1000);
										}
									}

									setShowOptions(false);
									queueMicrotask(() => divRef?.focus());
								}}
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
