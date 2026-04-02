import type { Audio } from "@mtcute/core";
import { batch, createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { formatTime } from "@/helpers";
import { setStatusbarColor } from "@/stores";
import { downloadToFile, setSoftkeys } from "@/utils";
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
	seek: (ms: number) => number;
	on: (event: string, callback: (...args: any[]) => void) => void;
	off?: (event: string, callback: (...args: any[]) => void) => void;
	destroy?: () => void;
};

export default function MusicPlayerShared(props: { music: Audio; onClose: () => void; useFlacDecoder?: boolean }) {
	let divRef!: HTMLDivElement;
	let optionDownloadRef!: HTMLDivElement;
	let audioRef!: HTMLAudioElement;
	let flacPlayer: FlacPlayer | null = null;

	const [src, setSrc] = createSignal("");
	const [downloadUrl, setDownloadUrl] = createSignal("");
	const [cover, setCover] = createSignal("");
	const [playing, setPlaying] = createSignal(false);
	const [loading, setLoading] = createSignal(true);
	const [showOptions, setShowOptions] = createSignal(false);
	const [downloadProgress, setDownloadProgress] = createSignal(0);
	const [currentTime, setCurrentTime] = createSignal(0);
	const [duration, setDuration] = createSignal(props.music.duration || 0);

	const title = createMemo(() => props.music.title || props.music.fileName || "Unknown Audio");
	const subtitle = createMemo(() => {
		const performer = props.music.performer || "Unknown Artist";
		return `${performer} • ${formatTime(duration())}`;
	});

	const progress = createMemo(() => {
		const total = duration();
		if (!total) return 0;
		return Math.min(100, (currentTime() / total) * 100);
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
		if (!duration()) return;

		if (props.useFlacDecoder) {
			if (!flacPlayer) return;

			const next = Math.max(0, Math.min(duration(), currentTime() + offsetSeconds));
			flacPlayer.seek(next * 1000);
			setCurrentTime(next);
			return;
		}

		if (!audioRef) return;

		const next = Math.max(0, Math.min(duration(), audioRef.currentTime + offsetSeconds));
		audioRef.currentTime = next;
		setCurrentTime(next);
	};

	const closePlayer = () => {
		if (props.useFlacDecoder) {
			flacPlayer?.pause();
		} else {
			audioRef?.pause();
		}
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
					const blob = new Blob([buffer], { type: props.music.mimeType || "audio/flac" });
					const blobUrl = URL.createObjectURL(blob);

					setSrc(blobUrl);
					setDownloadUrl(blobUrl);
					setLoading(false);

					const player = AV.Player.fromBuffer(buffer) as FlacPlayer;
					flacPlayer = player;

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
					};

					player.on("duration", onDuration);
					player.on("progress", onProgress);
					player.on("end", onEnd);
					player.on("error", onError);

					onCleanup(() => {
						if (player.off) {
							player.off("duration", onDuration);
							player.off("progress", onProgress);
							player.off("end", onEnd);
							player.off("error", onError);
						}

						player.pause();
						player.stop();
						player.destroy?.();
						flacPlayer = null;
						URL.revokeObjectURL(blobUrl);
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
						seekBy(-5);
						return;
					}

					if (key == "ArrowRight") {
						e.preventDefault();
						seekBy(5);
					}
				}}
				tabIndex={-1}
				class={styles.player}
				style={{ "background-image": cover() ? `url(${cover()})` : undefined }}
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
							<div class={styles.controls}>{playing() ? "Pause" : "Play"} • Left/Right seek</div>
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

									downloadToFile(downloadUrl(), musicFilename(props.music));
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
