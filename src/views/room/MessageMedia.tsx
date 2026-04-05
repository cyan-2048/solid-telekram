import {
	batch,
	createEffect,
	createMemo,
	createRenderEffect,
	createSignal,
	Index,
	onCleanup,
	onMount,
	Show,
	untrack,
} from "solid-js";
import { formatTime, niceBytes, setSoftkeys, sleep, useMessageChecks, useStore } from "@utils";
import {
	type MessageMediaType,
	type Photo,
	type Sticker,
	Thumbnail,
	type Video,
	type Location,
	type Voice,
	type Document,
	type FileLocation,
	type Audio,
	type MessageMedia,
	type MaybePromise,
} from "@mtcute/core";

import { type Download, downloadFile } from "@/lib/storage";
import PeerPhotoIcon from "@components/PeerPhotoIcon";
import TelegramIcon from "@components/TelegramIcon";
import SpatialNavigation from "@/lib/spatial_navigation";
import ProgressSpinner from "@components/ProgressSpinner";
import { rlottie, getOptimizedSticker, gunzip, processWebpToCanvas } from "@workers";
import { EE } from "@globals";
import { useMessageContext } from "./MessageItem";

import * as styles from "./MessageItem.module.scss";
import { LRUCache } from "lru-cache";
import MarqueeOrNot from "@components/MarqueeOrNot";
import { cloudphone } from "@/config";
import { Transition } from "solid-transition-group";

function StickerThumbnail() {
	const { media } = useMessageContext();

	const thumbnail = createMemo(() => (media() as Sticker).getThumbnail(Thumbnail.THUMB_OUTLINE));
	const photoSize = createMemo(() => (media() as Sticker).attr2);

	return (
		<Show when={thumbnail()}>
			<div class={styles.svg}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					xmlns:xlink="http://www.w3.org/1999/xlink"
					viewBox={`0 0 ${photoSize()?.w || 512} ${photoSize()?.h || 512}`}
				>
					<path fill="rgba(0, 0, 0, 0.08)" d={thumbnail()!.path} />
				</svg>
			</div>
		</Show>
	);
}

// #region downloadAsync
/**
 * please use this inside onMount
 */
export function downloadAsync(
	file: FileLocation,
	type: "url",
	callback: (data: string) => MaybePromise<string | void>,
	onProgress?: null | ((progress: number) => void),
	downloadRef?: (download: Download) => void,
): void;
export function downloadAsync(
	file: FileLocation,
	type: "buffer",
	callback: (data: ArrayBuffer) => MaybePromise<string | void>,
	onProgress?: null | ((progress: number) => void),
	downloadRef?: (download: Download) => void,
): void;
export function downloadAsync(
	file: FileLocation,
	type: "blob",
	callback: (data: Blob) => MaybePromise<string | void>,
	onProgress?: null | ((progress: number) => void),
	downloadRef?: (download: Download) => void,
): void;
export function downloadAsync(
	file: FileLocation,
	type: "url" | "buffer" | "blob",
	callback: (data: any) => MaybePromise<string | void>,
	onProgress?: null | ((progress: number) => void),
	downloadRef?: (download: Download) => void,
): void {
	let mounted = true;

	const download = downloadFile(file);

	downloadRef?.(download);

	let url!: string;

	const stateChange = async () => {
		if (download.state == "done") {
			if (mounted) {
				switch (type) {
					case "blob": {
						const result = await callback(download.result);
						if (result) url = result;
						break;
					}
					case "buffer":
						download.result.arrayBuffer().then(async (buffer) => {
							const result = await callback(buffer);
							if (result) url = result;
						});
						break;
					case "url": {
						const result = await callback((url = URL.createObjectURL(download.result)));
						if (result) url = result;

						break;
					}
				}
			}
		}
	};

	if (download.state == "done") {
		stateChange();
		onProgress?.(100);

		onCleanup(() => {
			mounted = false;
			URL.revokeObjectURL(url);
		});

		return;
	}

	download.on("state", stateChange);

	function progressChange() {
		// console.error("DOWNLOAD PRESS", download.progress);
		onProgress?.(download.progress);
	}

	if (onProgress) {
		download.on("progress", progressChange);
	}

	onCleanup(() => {
		mounted = false;
		download.off("state", stateChange);
		if (onProgress) download.off("progress", progressChange);
		URL.revokeObjectURL(url);
	});
}
// #endregion

function StickerRlottieFirstFrame(props: { data: ImageData }) {
	let canvasRef!: HTMLCanvasElement;

	createEffect(() => {
		const context = canvasRef.getContext("2d")!;
		// console.error("FIRST FRAMERLOTTIE");
		context.putImageData(props.data, 0, 0);
	});

	return <canvas ref={canvasRef} width={128} height={128}></canvas>;
}

function StickerRlottieFirstFrameWebp() {
	let canvasRef!: HTMLCanvasElement;

	const { message } = useMessageContext();

	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);

	createEffect(() => {
		const media = message().media as Sticker;
		if (!media) return;
		if (media.mimeType != "application/x-tgsticker") return;

		// console.error("STICKEERRRR", media, media.thumbnails);

		// use media preview instead of actual file if available
		const file = media.getThumbnail("m");

		if (!file) return;

		// if kai3 use img tag
		if (import.meta.env.KAIOS != 2) {
			downloadAsync(file, "url", setSrc);
			return;
		}

		downloadAsync(file, "buffer", (buffer) => {
			return new Promise((res) => {
				processWebpToCanvas(canvasRef, new Uint8Array(buffer), media.width, media.height).then((blob) => {
					if (blob != null) {
						const url = URL.createObjectURL(blob);
						setSrc(url);
						res(url);
					} else {
						setLoading(false);
						res();
					}
				});
			});
		});
	});

	return (
		<>
			<canvas ref={canvasRef} width={128} height={128}></canvas>
			<Show when={src()}>
				<img src={src()} alt=" " />
			</Show>
			<Show when={loading()}>
				<StickerThumbnail />
			</Show>
		</>
	);
}

const decoder = new TextDecoder();

const fps = 60; // target frames per second
const frameDuration = 1000 / fps;

type CachedSticker = Array<ImageData> &
	Partial<{
		frames: number;
	}>;

const lruSticker = new LRUCache<string, CachedSticker>({
	max: 3,
	dispose(value) {
		value.length = 0;
	},
});

// console.log("lruSticker", lruSticker);

async function requestFrame(id: string, frame: number) {
	const clampedBuffer = await rlottie.requestFrame(id, frame, 128, 128);
	return new ImageData(clampedBuffer, 128, 128);
}

export function StickerMedia(props: FocusableMediaProps) {
	// TODO: only play video sticker when focused to lessen memory usage
	const { message, focused, media } = useMessageContext();

	let canvasRef!: HTMLCanvasElement;

	// if this is set, use img tag
	const [src, setSrc] = createSignal("");
	const [video, setVideo] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [isLottie, setIsLottie] = createSignal(false);

	const [rlottieCanvasRef, setRlottieCanvasRef] = createSignal<null | HTMLCanvasElement>(null);

	const [videoRef, setVideoRef] = createSignal<null | HTMLVideoElement>(null);

	const [rLottieData, setRlottieData] = createSignal("");
	const [rLottieReady, setRlottieReady] = createSignal(false);
	const [rLottieFirstFrame, setRlottieFirstFrame] = createSignal<null | ImageData>(null);

	createEffect(() => {
		const videoEl = videoRef();
		const _focused = focused();

		if (!videoEl) return;

		if (_focused) {
			videoEl.play();
		} else {
			videoEl.pause();
			videoEl.currentTime = 0;
		}
	});

	let frames = 0;
	let currentFrame = 0;

	createEffect(() => {
		const ready = rLottieReady();
		const isFocused = focused();
		const canvas = rlottieCanvasRef();
		const id = (media() as Sticker).uniqueFileId;

		if (!ready) return;
		if (!isFocused) return;
		if (!canvas) return;

		const context = canvas.getContext("2d")!;

		let destroyed = false;
		let animFrame: number;

		let startTime: number;

		const cachedFrames: CachedSticker = lruSticker.get(id) || [];
		cachedFrames.frames = frames;
		lruSticker.set(id, cachedFrames);

		async function tick_cb(timestamp: number) {
			if (destroyed) return;
			if (!startTime) startTime = timestamp;

			const elapsed = timestamp - startTime;
			const frameIndex = Math.floor(elapsed / frameDuration);

			if (frameIndex !== currentFrame) {
				currentFrame = frameIndex % frames; // Loop back to the beginning if needed

				if (currentFrame >= frames) currentFrame = 0;

				const imageData = cachedFrames[currentFrame] || (await requestFrame(id, currentFrame));
				cachedFrames[currentFrame] = imageData;

				context.putImageData(imageData, 0, 0);
			}

			animFrame = requestAnimationFrame((e) => {
				tick_cb(e);
			});
		}

		animFrame = requestAnimationFrame((e) => {
			tick_cb(e);
		});

		onCleanup(() => {
			destroyed = true;
			// console.log("destroyer");
			cancelAnimationFrame(animFrame);
			currentFrame = 0;
		});
	});

	createEffect(async () => {
		const isRlottie = isLottie();
		const canvas = rlottieCanvasRef();
		const data = rLottieData();
		const sticker = media() as Sticker;

		if (!isRlottie) return;
		if (!canvas) return;
		if (!data) return;

		await rlottie.loadRlottie();

		const cached = await rlottie.isCached(sticker.uniqueFileId);

		if (cached === false) {
			frames = await rlottie.loadAnimation(sticker.uniqueFileId, data);
		} else {
			frames = cached;
		}

		const clampedBuffer = await rlottie.requestFrame(sticker.uniqueFileId, 0, 128, 128);
		// console.timeEnd("TEST");
		const imageData = new ImageData(clampedBuffer, 128, 128);

		setRlottieFirstFrame(imageData);
		// console.error(imageData);

		setRlottieReady(true);
	});

	createEffect(() => {
		const isRlottie = isLottie();

		if (!isRlottie) return;

		const media = message().media as Sticker;

		if (media.mimeType != "application/x-tgsticker") return;

		downloadAsync(media, "buffer", async (buffer) => {
			const data = await gunzip(new Uint8Array(buffer));
			setRlottieData(decoder.decode(data));
		});
	});

	onCleanup(() => {
		setVideoRef(null);
	});

	createEffect(() => {
		const media = message().media;

		if (!media) return;

		if (media.type !== "sticker") return;

		console.error("STICKEERRRR", media, media.mimeType);

		if (media.mimeType.includes("webm")) {
			downloadAsync(media, "url", setVideo);

			return;
		}

		if (media.mimeType.includes("webp")) return;

		let mounted = true;

		if (media.mimeType.includes("x-tgsticker")) {
			console.error("non-webp sticker set", media.mimeType, media.emoji, media.uniqueFileId);

			getOptimizedSticker(media.uniqueFileId).then((hasPrecompiled) => {
				if (!mounted) return;
				if (hasPrecompiled) {
					setSrc(hasPrecompiled);
				} else {
					setIsLottie(true);
				}
			});
		}

		onCleanup(() => {
			mounted = false;
		});
	});

	createEffect(() => {
		const media = message().media;
		if (!media) return;
		if (media.type !== "sticker") return;
		if (!media.mimeType.includes("webp")) return;

		// console.error("STICKEERRRR", media, media.thumbnails);

		// use media preview instead of actual file if available
		const file = media.getThumbnail("x") || media;

		// if kai3 use img tag
		if (import.meta.env.KAIOS != 2) {
			downloadAsync(file, "url", setSrc);
			return;
		}

		downloadAsync(file, "buffer", (buffer) => {
			return new Promise((res) => {
				processWebpToCanvas(canvasRef, new Uint8Array(buffer), media.width, media.height).then((blob) => {
					if (blob != null) {
						const url = URL.createObjectURL(blob);
						setSrc(url);
						res(url);
					} else {
						setLoading(false);
						res();
					}
				});
			});
		});
	});

	return (
		<div class={styles.sticker}>
			<Show
				when={isLottie()}
				fallback={
					<Show
						when={video()}
						fallback={
							<>
								<Show when={loading()}>
									<StickerThumbnail />
								</Show>
								<Show when={src()} fallback={<canvas ref={canvasRef} width={128} height={128}></canvas>}>
									{(src) => (
										<img
											onLoad={() => {
												setLoading(false);
											}}
											onError={(e) => {
												console.error("ERROR OCCURED STICKER", e.currentTarget);
											}}
											width={128}
											src={src() + "#-moz-samplesize=2"}
										/>
									)}
								</Show>
							</>
						}
					>
						<video
							x-puffin-playsinline={cloudphone || undefined}
							ref={setVideoRef}
							muted
							onError={(e) => {
								const err = [
									"Unknown",
									"MEDIA_ERR_ABORTED",
									"MEDIA_ERR_NETWORK",
									"MEDIA_ERR_DECODE",
									"MEDIA_ERR_SRC_NOT_SUPPORTED",
								][e.currentTarget.error?.code || 0];
								console.error("STICKER VIDEO ERROR", err, e.target);
							}}
							loop
							src={video()}
						></video>
					</Show>
				}
			>
				<Show when={!focused()}>
					<Show when={rLottieFirstFrame()} fallback={<StickerRlottieFirstFrameWebp />}>
						{(d) => <StickerRlottieFirstFrame data={d()} />}
					</Show>
				</Show>
				<Show when={focused()}>
					<canvas ref={setRlottieCanvasRef} width={128} height={128}></canvas>
				</Show>
			</Show>
		</div>
	);
}

interface FocusableMediaProps {
	focusable?: boolean;
	onSelect?: (m: NonNullable<MessageMedia>) => void;
}

function PhotoMedia(props: FocusableMediaProps) {
	const { showChecks, media: _media } = useMessageContext();

	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [showUnsupported, setShowUnsupported] = createSignal(false);
	const [thumb, setThumb] = createSignal("");

	const [progress, setProgress] = createSignal(0);

	createEffect(() => {
		const media = _media() as Photo;
		const thumb = media.getThumbnail(Thumbnail.THUMB_STRIP);

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location as Uint8Array<ArrayBuffer>]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	createEffect(() => {
		const media = _media() as Photo;

		// this is good enough?
		const thumb = media.getThumbnail(Thumbnail.THUMB_320x320_BOX);

		if (!thumb) {
			console.error("THUMB M IS NOT PRESENT, SKIPPING");
			return;
		}

		downloadAsync(
			thumb,
			"url",
			(url) => {
				setLoading(false);
				setSrc(url);
			},
			setProgress,
		);
	});

	return (
		<div
			on:sn-enter-down={() => {
				props.onSelect?.(_media()!);
			}}
			tabIndex={props.focusable ? -1 : undefined}
			classList={{ [styles.photo]: true, focusable: !!props.focusable }}
		>
			<Show when={thumb() && (loading() || !src() || showUnsupported())}>
				<img class={styles.thumb} src={thumb()}></img>
				<ProgressSpinner class={styles.spinner} size={40} progress={progress()} showClose></ProgressSpinner>
			</Show>
			<Show when={src()}>
				<img src={src() + "#-moz-samplesize=2"}></img>
			</Show>
			<Show when={showChecks()}>
				<MediaChecks />
			</Show>
		</div>
	);
}

function MediaChecks() {
	const { message, dialog } = useMessageContext();

	const check = useMessageChecks(message, dialog);

	return (
		<div class={styles.media_checks}>
			<div class={styles.info_check}>
				<TelegramIcon name={check() ? "check" : "checks"} />
			</div>
		</div>
	);
}

function VideoMedia(props: FocusableMediaProps) {
	const { message, focused, showChecks, media } = useMessageContext();

	const round = () => (message().media as Video).isRound;

	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [showUnsupported, setShowUnsupported] = createSignal(false);
	const [thumb, setThumb] = createSignal("");
	const [preview, setPreview] = createSignal("");

	// if legacy use 1
	const [isGif, setIsGif] = createSignal<boolean | 1>(false);

	createEffect(() => {
		const media = message().media as Video;

		setIsGif(media.isLegacyGif ? 1 : media.isAnimation);

		const thumb = media.getThumbnail(Thumbnail.THUMB_STRIP);

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location as Uint8Array<ArrayBuffer>]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	createEffect(() => {
		const media = message().media as Video;

		const thumb = media.getThumbnail("m");

		if (thumb) {
			downloadAsync(thumb, "url", setPreview);
		}
	});

	createEffect(() => {
		const video = message().media as Video;
		const media = video.thumbnails.find((a) => a.isVideo) || video;

		const fileSize = media.fileSize;

		if (!media.fileSize) {
			// found memory issue with this lmao
			return;
		}

		if (media.fileSize > 5242880) {
			console.error("SKIPPING DOWNLOAD BECAUSE FILE SIZE TOO BIG", niceBytes(fileSize || 0));
			// todo do to something about this
			return;
		}

		const isGif = video.isLegacyGif ? 1 : video.isAnimation;

		if (!isGif) {
			console.error("SKIPPING DOWNLOAD BECAUSE IT IS NOT A GIF???");
			return;
		}

		downloadAsync(media, "url", (url) => {
			setLoading(false);
			setSrc(url);
		});
	});

	const [width, setWidth] = createSignal(0);

	return (
		<div
			on:sn-enter-down={() => {
				const media = message().media;
				if (!isGif()) props.onSelect?.(media!);
			}}
			tabIndex={props.focusable ? -1 : undefined}
			classList={{
				[styles.video]: true,
				focusable: !isGif() && !!props.focusable,
			}}
			style={
				preview() && isGif()
					? {
							"background-image": `url(${preview()})`,
						}
					: undefined
			}
		>
			<Show
				when={isGif()}
				fallback={
					<>
						<Show
							when={preview()}
							fallback={
								<img
									onLoad={(e) => {
										setWidth(e.currentTarget.clientWidth);
									}}
									class={styles.thumb}
									src={thumb() + "#-moz-samplesize=2"}
								></img>
							}
						>
							<img
								style={
									round()
										? {
												"border-radius": "50%",
											}
										: undefined
								}
								onLoad={(e) => {
									setWidth(e.currentTarget.clientWidth);
								}}
								src={preview() + "#-moz-samplesize=2"}
							></img>
						</Show>
						<div class={styles.play}>
							<svg viewBox="0 0 20 20" class="MX">
								<path d="M4 3.1v13.8c0 .9 1 1.5 1.8 1 3.1-1.7 9.4-5.2 12.5-6.9.8-.5.8-1.6 0-2.1L5.8 2C5 1.6 4 2.2 4 3.1z"></path>
							</svg>
						</div>
						<div class={styles.time}>
							<svg viewBox="0 0 18 18" class="PL">
								<path
									d="M13.518 7.626v-2.82a.72.72 0 00-.247-.583.905.905 0 00-.65-.222H1.9a.905.905 0 00-.651.222.72.72 0 00-.247.584v8.386a.72.72 0 00.247.584.905.905 0 00.651.222h10.72a.905.905 0 00.65-.222.72.72 0 00.247-.584v-2.82l.1.09 2.613 2.44a.49.49 0 00.49.088.408.408 0 00.28-.372V5.382a.407.407 0 00-.279-.374.49.49 0 00-.492.089l-2.591 2.421-.122.109h.002z"
									fill-rule="evenodd"
								></path>
							</svg>
							{formatTime((media() as Video).duration)}
						</div>
					</>
				}
			>
				<Show
					when={focused() && src()}
					fallback={
						<Show
							when={preview()}
							fallback={
								<img
									onLoad={(e) => {
										setWidth(e.currentTarget.clientWidth);
									}}
									class={styles.thumb}
									src={thumb() + "#-moz-samplesize=2"}
								></img>
							}
						>
							<img
								onLoad={(e) => {
									setWidth(e.currentTarget.clientWidth);
								}}
								src={preview() + "#-moz-samplesize=2"}
							></img>
						</Show>
					}
				>
					<Show
						when={isGif() === 1}
						fallback={
							<video
								muted
								x-puffin-playsinline={cloudphone || undefined}
								style={
									width()
										? {
												width: width() + "px",
											}
										: undefined
								}
								onLoadedMetadata={(e) => {
									setWidth(e.currentTarget.clientWidth);
								}}
								autoplay
								loop
								src={src()}
							></video>
						}
					>
						<img
							style={
								width()
									? {
											width: width() + "px",
										}
									: undefined
							}
							onLoad={(e) => {
								setWidth(e.currentTarget.clientWidth);
							}}
							src={src()}
						></img>
					</Show>
				</Show>
				<Show when={!focused()}>
					<div class={styles.gif}>GIF</div>
				</Show>
			</Show>
			<Show when={showChecks()}>
				<MediaChecks />
			</Show>
		</div>
	);
}

function downsampleWaveform(waveform: number[], targetLength: number = 32): number[] {
	const originalLength = waveform.length;
	const result: number[] = [];
	const factor = originalLength / targetLength;

	for (let i = 0; i < targetLength; i++) {
		const start = Math.floor(i * factor);
		const end = Math.floor((i + 1) * factor);
		const segment = waveform.slice(start, end);

		// Average the segment
		const average = segment.reduce((sum, value) => sum + value, 0) / segment.length;
		result.push(average);
	}

	return result;
}

function VoiceMedia(props: FocusableMediaProps) {
	const { showChecks, message, media, isOutgoing, audioPlaying, audioSpeed, setAudioPlaying } = useMessageContext();

	const [src, setSrc] = createSignal("");

	const [waveform, setWaveform] = createSignal<number[] | null>(null);

	const [playing, setPlaying] = createSignal(false);

	let audioRef!: HTMLAudioElement;

	const [duration, setDuration] = createSignal(0);

	const [downloadState, setDownloadState] = createSignal(0);

	const [currentTime, setCurrentTime] = createSignal(0);

	const [waveformIndex, setWaveformIndex] = createSignal(0);

	let download: ReturnType<typeof downloadFile> | undefined;

	function downloadProgress(num: number) {
		setDownloadState(num);
	}

	onCleanup(() => {
		if (src()) {
			URL.revokeObjectURL(src());
		}

		if (download?.state == "downloading") {
			download.abort();
		}
	});

	async function startDownload() {
		const voice = media() as Voice;

		download = downloadFile(voice);

		if (download.state == "done") {
			setSrc(URL.createObjectURL(download.result));
			setDownloadState(100);
			await sleep(2);
			if (audioPlaying()) {
				audioRef.play();
			}
			return;
		}

		download.on("progress", downloadProgress);
		download.once("done", async (result) => {
			setDownloadState(100);
			download?.off("progress", downloadProgress);
			if (!result && download) {
				download = undefined;
			}

			if (result) {
				setSrc(URL.createObjectURL(result));
				await sleep(2);
				if (audioPlaying()) {
					audioRef.play();
				}
			}
		});
	}

	function onRewind() {
		audioRef && (audioRef.currentTime = 0);
	}

	createRenderEffect(() => {
		const voice = media() as Voice;

		batch(() => {
			setWaveform(downsampleWaveform(voice.waveform));
			setDuration(voice.duration);
		});
	});

	createEffect(() => {
		const audioIsPlaying = audioPlaying();

		if (audioIsPlaying) {
			setSoftkeys("Rewind", "PAUSE", (untrack(audioSpeed) == 2 ? 1 : untrack(audioSpeed) + 0.5) + "x");

			if (!download) {
				untrack(startDownload);
			}

			if (untrack(src)) {
				sleep(2).then(() => {
					audioRef.play();
				});
			}

			EE.on("audio_rewind", onRewind);

			onCleanup(() => {
				SpatialNavigation.resume();
				setPlaying(false);
				setSoftkeys("tg:arrow_down", "PLAY", "tg:more");
				audioRef?.pause();
				EE.off("audio_rewind", onRewind);
			});
		}
	});

	// console.error("SENDER", props.$.sender);

	const pausePath =
		"M6.7 2.1H4.4c-.7 0-1.2.5-1.2 1.2v13.5c0 .7.5 1.2 1.2 1.2h2.3c.7 0 1.2-.5 1.2-1.2V3.3c0-.7-.5-1.2-1.2-1.2zm8.9 0h-2.3c-.7 0-1.2.5-1.2 1.2v13.5c0 .7.5 1.2 1.2 1.2h2.3c.7 0 1.2-.5 1.2-1.2V3.3c0-.7-.5-1.2-1.2-1.2z";
	const playPath = "M4 3.1v13.8c0 .9 1 1.5 1.8 1 3.1-1.7 9.4-5.2 12.5-6.9.8-.5.8-1.6 0-2.1L5.8 2C5 1.6 4 2.2 4 3.1z";

	return (
		<>
			<div class={styles.voice}>
				<div
					onClick={() => {
						setPlaying((a) => !a);
					}}
					class={styles.icon}
				>
					<svg height={18} width={18} viewBox="0 0 20 20">
						<path d={playing() ? pausePath : playPath}></path>
					</svg>
				</div>
				<div class={styles.waveform}>
					<div class={styles.wavy}>
						<Index each={waveform()}>
							{(num, index) => (
								<div
									style={{
										height: Math.min(100, Math.max(12, (num() / 30) * 100)) + "%",
										background: waveformIndex() != 0 && index <= waveformIndex() ? "var(--accent)" : undefined,
									}}
									class={styles.wave}
								></div>
							)}
						</Index>
					</div>
					<div class={styles.time}>
						{audioPlaying()
							? downloadState() != 100
								? "Loading..."
								: formatTime(currentTime())
							: formatTime(duration())}
					</div>
				</div>

				<div
					style={{
						order: isOutgoing() ? -1 : undefined,
						"border-radius": audioPlaying() ? 0 : undefined,
						"margin-right": isOutgoing() ? "8px" : undefined,
					}}
					class={styles.photo}
				>
					<Show when={audioPlaying()} fallback={<PeerPhotoIcon showSavedIcon={false} peer={message().sender} />}>
						<div class={styles.speed}>{audioSpeed()}x</div>
					</Show>
				</div>
			</div>
			<Show when={showChecks()}>
				<MediaChecks />
			</Show>
			<audio
				// @ts-ignore
				prop:playbackRate={audioSpeed()}
				ref={audioRef}
				onCanPlay={() => {}}
				onTimeUpdate={(e) => {
					setCurrentTime(Math.floor(e.currentTarget.currentTime));
					if (audioPlaying()) setPlaying(true);
					setWaveformIndex(Math.floor((e.currentTarget.currentTime / e.currentTarget.duration) * 31));
				}}
				onEnded={() => {
					setWaveformIndex(0);
					setAudioPlaying(false);
				}}
				prop:mozAudioChannelType="content"
				src={src()}
			></audio>
		</>
	);
}

function LocationMedia(props: FocusableMediaProps) {
	const { message } = useMessageContext();

	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);

	createEffect(() => {
		const _message = message();

		const media = _message.media as Location;

		downloadAsync(
			media.preview({
				width: 192,
				height: 160,
			}),
			"url",
			(url) => {
				setLoading(false);
				setSrc(url);
			},
		);
	});

	return (
		<div
			class={styles.location}
			style={{
				"background-image": `url(${src()})`,
			}}
		>
			<div class={styles.pin}></div>
		</div>
	);
}

function UnsupportedMedia(props: FocusableMediaProps) {
	const { message, mediaType, media, isOutgoing } = useMessageContext();

	const unsupported = useStore(() => message().$isUnsupported);

	return (
		<Show when={unsupported()}>
			<div class={styles.document_file}>
				<div class={styles.preview}>
					<img src="https://cyan-2048.github.io/kaigram-assets/Humanity/mimes/48/unknown.svg"></img>
				</div>
				<div class={styles.description}>
					<div class={styles.name}>Unsupported Media</div>
					<div
						classList={{
							[styles.size]: true,
							[styles.accent_color]: isOutgoing(),
						}}
					>
						{mediaType()}
					</div>
				</div>
			</div>
		</Show>
	);
}

function DocumentMedia(props: FocusableMediaProps) {
	const { media, isOutgoing, focused } = useMessageContext();

	const iconUrl = createMemo(() => "https://file-icons.cyan-2048.workers.dev/" + (media() as Document).mimeType);

	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [thumb, setThumb] = createSignal("");

	const [progress, setProgress] = createSignal(0);

	onMount(() => {
		const doc = media() as Document;
		console.log("DOCUMENT FILE:", doc);
		const thumb = doc.getThumbnail("i");

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location as Uint8Array<ArrayBuffer>]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	onMount(() => {
		const doc = media() as Document;

		// this is good enough?
		const thumb = doc.getThumbnail("m");

		if (!thumb) {
			console.error("THUMB M IS NOT PRESENT, SKIPPING");
			sleep(10).then(() => setThumb(""));
			return;
		}

		downloadAsync(
			thumb,
			"url",
			(url) => {
				setLoading(false);
				if (!doc.mimeType.includes("webp")) {
					setSrc(url);
				} else {
					setThumb("");
				}
			},
			setProgress,
		);
	});

	return (
		<div class={styles.document_file}>
			<div class={styles.preview}>
				<Show when={thumb() && (loading() || !src())}>
					<img class={styles.thumb} src={thumb()}></img>
					<ProgressSpinner class={styles.preview_spinner} size={32} progress={progress()} showClose></ProgressSpinner>
				</Show>
				<Show
					when={src()}
					fallback={
						<Show when={!thumb() && iconUrl()}>
							<img src={iconUrl()}></img>
						</Show>
					}
				>
					<img class={styles.preview_image} src={src() + "#-moz-samplesize=2"}></img>
				</Show>
			</div>
			<div class={styles.description}>
				<div classList={{ [styles.name]: true, [styles.ellipses]: !focused() }}>
					<MarqueeOrNot marquee={focused()}>{(media() as Document).fileName}</MarqueeOrNot>
				</div>
				<div
					classList={{
						[styles.size]: true,
						[styles.accent_color]: isOutgoing(),
					}}
				>
					{niceBytes((media() as Document).fileSize || 0)}
				</div>
			</div>
		</div>
	);
}

function MusicMedia(props: FocusableMediaProps) {
	const { media, isOutgoing, focused } = useMessageContext();

	const [duration, setDuration] = createSignal(0);

	const iconUrl = createMemo(() => "https://file-icons.cyan-2048.workers.dev/" + (media() as Audio).mimeType);

	const title = createMemo(() => {
		const audio = media() as Audio;
		return audio.title || audio.fileName || "";
	});

	onMount(() => {
		const audio = media() as Audio;
		console.log("MUSIC FILE:", audio);

		// apparently this is not accurate
		setDuration(audio.duration);

		// const preview_thumb = doc.getThumbnail()
	});

	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [thumb, setThumb] = createSignal("");

	const [progress, setProgress] = createSignal(0);

	onMount(() => {
		const doc = media() as Audio;
		const thumb = doc.getThumbnail("i");

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location as Uint8Array<ArrayBuffer>]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	onMount(() => {
		const doc = media() as Audio;

		// this is good enough?
		const thumb = doc.getThumbnail("m");

		if (!thumb) {
			console.error("THUMB M IS NOT PRESENT, SKIPPING");
			sleep(10).then(() => setThumb(""));
			return;
		}

		downloadAsync(
			thumb,
			"url",
			(url) => {
				setLoading(false);
				if (!doc.mimeType.includes("webp")) {
					setSrc(url);
				} else {
					setThumb("");
				}
			},
			setProgress,
		);
	});

	return (
		<div class={styles.document_file}>
			<div class={styles.preview}>
				<Transition
					onExit={(el, done) => {
						const a = el.animate([{ opacity: 1 }, { opacity: 0 }], {
							duration: 200,
						});

						a.finished.then(done);
					}}
				>
					<Show when={thumb() && (loading() || !src())}>
						<div>
							<img class={styles.thumb} src={thumb()}></img>
							<ProgressSpinner
								class={styles.preview_spinner}
								size={32}
								progress={progress()}
								showClose
							></ProgressSpinner>
						</div>
					</Show>
				</Transition>

				<Show
					when={src()}
					fallback={
						<Show when={!thumb() && iconUrl()}>
							<img src={iconUrl()}></img>
						</Show>
					}
				>
					<img class={styles.preview_image} src={src() + "#-moz-samplesize=2"}></img>
				</Show>
			</div>
			<div class={styles.description}>
				<div classList={{ [styles.name]: true, [styles.ellipses]: !focused() }}>
					<MarqueeOrNot marquee={focused()}>{title()}</MarqueeOrNot>
				</div>
				<div
					classList={{
						[styles.size]: true,
						[styles.accent_color]: isOutgoing(),
						[styles.white_space_nowrap]: true,
					}}
				>
					<MarqueeOrNot marquee={focused()}>
						{formatTime(duration())} • {(media() as Audio).performer || ""}
					</MarqueeOrNot>
				</div>
			</div>
		</div>
	);
}

export function switchMessageMedia(mediaType: MessageMediaType | undefined) {
	switch (mediaType) {
		case "audio":
			return MusicMedia;
		case "location":
			return LocationMedia;
		case "voice":
			return VoiceMedia;
		case "video":
			return VideoMedia;
		case "sticker":
			return StickerMedia;
		case "photo":
			return PhotoMedia;
		case "document":
			return DocumentMedia;
	}
	return UnsupportedMedia;
}
