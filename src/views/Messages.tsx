import {
	createContext,
	createEffect,
	createMemo,
	createRenderEffect,
	createResource,
	createSignal,
	For,
	Index,
	JSXElement,
	onCleanup,
	onMount,
	Setter,
	Show,
	untrack,
	useContext,
} from "solid-js";
import styles from "./Room.module.scss";
import { sleep, useMessageChecks, useStore } from "@/lib/utils";
import {
	TextWithEntities,
	MessageMediaType,
	Message,
	Photo,
	Sticker,
	Thumbnail,
	Video,
	MessageMedia,
	Location,
	Voice,
} from "@mtcute/core";
import { TelegramClient } from "@mtcute/web";
import { UIMessage, UIDialog, client, chat, setSoftkeys } from "@signals";
import dayjs from "dayjs";
import { downloadFile } from "@/lib/files/download";
import processWebpToCanvas, { getOptimizedSticker } from "@/lib/heavy-tasks";
import { Dynamic, Portal } from "solid-js/web";
import { PeerPhotoIcon } from "./components/PeerPhoto";
import TelegramIcon from "./components/TelegramIcon";
import SpatialNavigation from "@/lib/spatial_navigation";

/**
 * Chat type. Can be:
 *  - `private`: PM with other users or yourself (Saved Messages)
 *  - `bot`: PM with a bot
 *  - `group`: Legacy group
 *  - `supergroup`: Supergroup
 *  - `channel`: Broadcast channel
 *  - `gigagroup`: Gigagroup aka Broadcast group
 */
const enum ChatType {
	PRIVATE = "private",
	BOT = "bot",
	GROUP = "group",
	SUPERGROUP = "supergroup",
	CHANNEL = "channel",
	GIGAGROUP = "gigagroup",
}

function toMidnight(date: dayjs.Dayjs) {
	return date.set("hour", 0).set("minute", 0).set("second", 0);
}

function today() {
	return toMidnight(dayjs());
}

function decideDateSepatator(dateBefore: Date | undefined, dateAfter: Date) {
	if (!dateBefore) return true;

	const day1 = toMidnight(dayjs(dateBefore));
	const day2 = toMidnight(dayjs(dateAfter));

	// console.log(day1.toDate(), day2.toDate());
	// console.log(dateBefore, dateAfter);

	const diff = Math.abs(day1.diff(day2, "day"));

	if (diff > 0) {
		const diffToday = today().diff(day2, "day");
		if (diffToday === 1) return 1;
		if (diffToday === 0) return 2;

		return true;
	}

	return false;
}

function decideTail(before: UIMessage | undefined, after: UIMessage) {
	if (!before) return true;

	const hasDateSeparator = decideDateSepatator(before.date, after.date);

	if (hasDateSeparator) return true;

	const chat = before.$.chat;

	if (chat.chatType === ChatType.CHANNEL) {
		// broadcast channels seems to always have tails on them?
		return true;
	}

	// if different senders
	if (before.sender.id !== after.sender.id) {
		return true;
	}

	const day1 = dayjs(before.date);
	const day2 = dayjs(after.date);

	const minuteDiff = Math.abs(day1.diff(day2, "minutes"));

	// if more than 1 minute has passed
	if (minuteDiff > 0) {
		return true;
	}

	return false;
}

function decideShowUsername(before: UIMessage | undefined, after: UIMessage) {
	const chat = after.$.chat;

	if (
		// broadcast groups don't seem to show who sent messages?? idk
		chat.chatType === ChatType.CHANNEL ||
		chat.chatType === ChatType.PRIVATE ||
		after.isOutgoing
	) {
		return false;
	}

	return decideTail(before, after);
}

export const MessageContext = createContext<{
	focused: () => boolean;
	setFocused: Setter<boolean>;

	audioPlaying: () => boolean;
	setAudioPlaying: Setter<boolean>;
	/**
	 * should be 1, 1.5, 2
	 */
	audioSpeed: () => number;
	/**
	 * should be 1, 1.5, 2
	 */
	setAudioSpeed: Setter<number>;

	text: () => string;
	entities: () => TextWithEntities;
	mediaType: () => MessageMediaType | undefined;
	media: () => MessageMedia;
	action: () => Message["action"];
	actionType: () => MessageActionTypes;

	reply: () => UIMessage | undefined | 0;
	dialog: () => UIDialog;
	message: () => UIMessage;
	rawMessage: () => Message;

	isSticker: () => boolean;
	isOutgoing: () => boolean;
	isReply: () => boolean;

	showChecks: () => boolean;
	showTail: () => boolean;
	showContainerTail: () => boolean;
	showUsername: () => boolean;
	showDateSeparator: () => boolean | 1 | 2;

	actualLast: () => boolean;
	last: () => boolean;
	tg: TelegramClient;
}>();

type MessageActionTypes = NonNullable<Message["action"]>["type"] | undefined;

export function MessageProvider(props: {
	$: UIMessage;
	before?: UIMessage;
	dialog: UIDialog;
	last: boolean;
	children: JSXElement;
}) {
	const tg = client();

	if (!tg) throw new Error("CLIENT NOT READY");

	const [focused, setFocused] = createSignal(false);

	const [reply] = createResource(async () => {
		const _ = props.$.isReply();
		if (_) {
			const msg = await props.$.getReply(props.dialog);
			return msg ?? 0;
		} else {
			return undefined;
		}
	});

	const text = useStore(() => props.$.text);
	const entities = useStore(() => props.$.entities);

	const mediaType = createMemo(() => props.$.$.media?.type);

	const showChecks = createMemo(() => props.$.isOutgoing && !(entities().entities || entities().text));

	const showTail = createMemo(() => decideTail(props.before, props.$));
	const showUsername = createMemo(() => decideShowUsername(props.before, props.$));

	const showContainerTail = createMemo(() =>
		props.$.isSticker ? (props.$.isReply() ? showTail() : false) : showTail()
	);

	const actionType = () => props.$.$.action?.type;

	const showDateSeparator = createMemo(() => decideDateSepatator(props.before?.date, props.$.date));

	const [audioPlaying, setAudioPlaying] = createSignal(false);
	const [audioSpeed, setAudioSpeed] = createSignal(1);

	return (
		<MessageContext.Provider
			value={{
				tg,

				audioSpeed,
				setAudioSpeed,

				audioPlaying,
				setAudioPlaying,

				actionType,
				media: () => props.$.$.media,
				action: () => props.$.$.action,

				focused,
				setFocused,
				reply,
				text,
				entities,
				mediaType,
				showChecks,
				showTail,
				showUsername,
				showContainerTail,
				showDateSeparator,

				dialog: () => props.dialog,

				last: () => props.last && chat()?.chatType == "channel",
				actualLast: () => props.last,
				isOutgoing: () => props.$.isOutgoing,
				rawMessage: () => props.$.$,
				message: () => props.$,
				isSticker: () => props.$.isSticker,
				isReply: () => props.$.isReply(),
			}}
		>
			{props.children}
		</MessageContext.Provider>
	);
}

export function useMessageContext() {
	return useContext(MessageContext)!;
}

function StickerThumbnail() {
	const { media } = useMessageContext();
	const thumbnail = createMemo(() => (media() as Sticker).getThumbnail(Thumbnail.THUMB_OUTLINE));

	const photoSize = createMemo(() => (media() as Sticker).attr2);

	return (
		<Show when={thumbnail()}>
			<div class={styles.svg}>
				<svg
					version="1.1"
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

function StickerMedia() {
	// TODO: only play video sticker when focused to lessen memory usage
	const { message, focused } = useMessageContext();

	let canvasRef!: HTMLCanvasElement;

	// if this is set, use img tag
	const [src, setSrc] = createSignal("");
	const [video, setVideo] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [showUnsupported, setShowUnsupported] = createSignal(false);

	let mounted = true;

	onCleanup(() => {
		mounted = false;
	});

	onMount(() => {
		const media = message().$.media;
		if (!media) return;
		if (media.type !== "sticker") return;

		if (media.mimeType.includes("webm")) {
			const download = downloadFile(media);

			let url!: string;

			function stateChange() {
				if (download.state == "done") {
					if (mounted) {
						setVideo((url = URL.createObjectURL(download.result)));
					}
				}
			}

			if (download.state == "done") {
				stateChange();

				onCleanup(() => {
					URL.revokeObjectURL(url);
				});

				return;
			}

			download.on("state", stateChange);

			onCleanup(() => {
				download.off("state", stateChange);
				URL.revokeObjectURL(url);
			});
			return;
		}

		if (media.mimeType.includes("webp")) return;

		if (media.hasStickerSet) {
			console.error(
				"non-webp sticker set",
				media.mimeType,
				media.emoji,
				media,

				media.raw.id.toInt()
			);

			getOptimizedSticker(media.uniqueFileId).then((hasPrecompiled) => {
				if (hasPrecompiled) {
					setSrc(hasPrecompiled);
				} else {
					setShowUnsupported(true);
				}
			});
		}
	});

	onMount(() => {
		const media = message().$.media;
		if (!media) return;
		if (media.type !== "sticker") return;
		if (!media.mimeType.includes("webp")) return;

		// console.error("STICKEERRRR", media, media.thumbnails);

		// use media preview instead of actual file if available
		const file = media.getThumbnail("m") || media;

		const isKai3 = import.meta.env.VITE_KAIOS == 3;

		// if kai3 use img tag
		if (isKai3) {
			const download = downloadFile(file);

			let url!: string;

			const stateChange = () => {
				if (download.state == "done") {
					if (mounted) {
						setVideo((url = URL.createObjectURL(download.result)));
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

			download.on("state", stateChange);

			onCleanup(() => {
				download.off("state", stateChange);
				URL.revokeObjectURL(url);
			});
			return;
		}

		const download = downloadFile(file);

		let url!: string;

		const stateChange = async () => {
			if (download.state == "done") {
				if (mounted) {
					const buffer = await download.result.arrayBuffer();

					processWebpToCanvas(canvasRef, new Uint8Array(buffer), media.width, media.height).then((res) => {
						if (res != null) {
							setSrc((url = URL.createObjectURL(res)));
						} else {
							setLoading(false);
						}
					});
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

		download.on("state", stateChange);

		onCleanup(() => {
			download.off("state", stateChange);
			URL.revokeObjectURL(url);
		});
	});

	return (
		<div class={styles.sticker}>
			<Show
				when={showUnsupported()}
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
							onError={(e) => {
								const err = [
									"Unknown",
									"MEDIA_ERR_ABORTED",
									"MEDIA_ERR_NETWORK",
									"MEDIA_ERR_DECODE",
									"MEDIA_ERR_SRC_NOT_SUPPORTED",
								][e.currentTarget.error?.code || 0];
								console.error("VIDEO ERROR", err, e.target);
							}}
							autoplay
							loop
							src={video()}
						></video>
					</Show>
				}
			>
				<img src={new URL("../assets/unsupported sticker.jpg", import.meta.url).href + "#-moz-samplesize=2"}></img>
			</Show>
		</div>
	);
}

function PhotoMedia() {
	const { message, showChecks } = useMessageContext();

	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [showUnsupported, setShowUnsupported] = createSignal(false);
	const [thumb, setThumb] = createSignal("");

	let mounted = true;

	onCleanup(() => {
		mounted = false;
	});

	onMount(() => {
		const media = message().$.media as Photo;
		const thumb = media.getThumbnail(Thumbnail.THUMB_STRIP);

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	onMount(() => {
		const media = message().$.media as Photo;

		// this is good enough?
		const thumb = media.getThumbnail(Thumbnail.THUMB_320x320_BOX);

		if (!thumb) {
			console.error("THUMB M IS NOT PRESENT, SKIPPING");
			return;
		}

		const download = downloadFile(thumb);

		let url!: string;

		const stateChange = () => {
			if (download.state == "done") {
				if (mounted) {
					setLoading(false);
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

		download.on("state", stateChange);

		onCleanup(() => {
			download.off("state", stateChange);
			URL.revokeObjectURL(url);
		});
	});

	return (
		<div class={styles.photo}>
			<Show when={thumb() && (loading() || !src() || showUnsupported())}>
				<img class={styles.thumb} src={thumb()}></img>
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

function VideoMedia() {
	const { message, focused, showChecks } = useMessageContext();

	const round = () => (message().$.media as Video).isRound;

	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [showUnsupported, setShowUnsupported] = createSignal(false);
	const [thumb, setThumb] = createSignal("");
	const [preview, setPreview] = createSignal("");

	// if legacy use 1
	const [isGif, setIsGif] = createSignal<boolean | 1>(false);

	let mounted = true;

	onCleanup(() => {
		mounted = false;
	});

	onMount(() => {
		const media = message().$.media as Video;

		setIsGif(media.isLegacyGif ? 1 : media.isAnimation);

		const thumb = media.getThumbnail(Thumbnail.THUMB_STRIP);

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	onMount(() => {
		const media = message().$.media as Video;
		const thumb = media.getThumbnail("m");

		if (thumb) {
			const download = downloadFile(thumb);

			let url!: string;

			const stateChange = () => {
				if (download.state == "done") {
					if (mounted) {
						setPreview((url = URL.createObjectURL(download.result)));
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

			download.on("state", stateChange);

			onCleanup(() => {
				download.off("state", stateChange);
				URL.revokeObjectURL(url);
			});
		}
	});

	onMount(() => {
		const media = message().$.media as Video;

		const fileSize = media.fileSize;

		if (!media.fileSize) {
			// found memory issue with this lmao
			return;
		}

		if (media.fileSize > 5242880) {
			console.error("SKIPPING DOWNLOAD BECAUSE FILE SIZE TOO BIG", fileSize);
			// todo do to something about this
			return;
		}

		const isGif = media.isLegacyGif ? 1 : media.isAnimation;

		if (!isGif) {
			console.error("SKIPPING DOWNLOAD BECAUSE IT IS NOT A GIF???");
			return;
		}

		const download = downloadFile(media);

		let url!: string;

		const stateChange = () => {
			if (download.state == "done") {
				if (mounted) {
					setLoading(false);
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

		download.on("state", stateChange);

		onCleanup(() => {
			download.off("state", stateChange);
			URL.revokeObjectURL(url);
		});
	});

	const [width, setWidth] = createSignal(0);

	return (
		<div
			class={styles.video}
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
							0:05
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

function formatTime(seconds: number) {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.round(seconds % 60);
	const t = [h, m > 9 ? m : h ? "0" + m : m || "0", s > 9 ? s : "0" + s].filter(Boolean).join(":");
	return seconds < 0 && seconds ? `-${t}` : t;
}

function VoiceMedia() {
	const { showChecks, message, media, isOutgoing, audioPlaying, audioSpeed, setAudioPlaying } = useMessageContext();

	const [src, setSrc] = createSignal("");

	const [waveform, setWaveform] = createSignal<number[] | null>(null);

	const [playing, setPlaying] = createSignal(false);

	let audioRef!: HTMLAudioElement;

	const [duration, setDuration] = createSignal(0);

	const [downloadState, setDownloadState] = createSignal(0);

	const [currentTime, setCurrentTime] = createSignal(0);

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

	createRenderEffect(() =>
		untrack(() => {
			const voice = media() as Voice;
			setWaveform(downsampleWaveform(voice.waveform));

			setDuration(voice.duration);
		})
	);

	onMount(() => {
		const voice = media() as Voice;

		console.log(voice);
	});

	createEffect(() => {
		const audioIsPlaying = audioPlaying();

		if (audioIsPlaying) {
			setSoftkeys("Rewind", "PAUSE", untrack(audioSpeed) + 0.5 + "x");

			if (!download) {
				untrack(startDownload);
			}

			if (untrack(src)) {
				audioRef.play();
			}

			onCleanup(() => {
				SpatialNavigation.resume();
				setPlaying(false);
				setSoftkeys("tg:arrow_down", "PLAY", "tg:more");
				audioRef?.pause();
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
							{(num) => (
								<div
									style={{
										height: Math.min(100, Math.max(12, (num() / 30) * 100)) + "%",
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
			<Portal>
				<Show when={src()}>
					<audio
						// @ts-ignore
						prop:playbackRate={audioSpeed()}
						ref={audioRef}
						onCanPlay={() => {}}
						onTimeUpdate={(e) => {
							setCurrentTime(Math.floor(e.currentTarget.currentTime));
							if (audioPlaying()) setPlaying(true);
						}}
						onEnded={() => {
							setAudioPlaying(false);
						}}
						src={src()}
					></audio>
				</Show>
			</Portal>
		</>
	);
}

function MusicMedia() {
	return null;
}

function LocationMedia() {
	const { message } = useMessageContext();

	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);

	let mounted = true;
	onCleanup(() => {
		mounted = false;
	});

	onMount(() => {
		const _message = message();

		const media = _message.$.media as Location;

		const download = downloadFile(
			media.preview({
				width: 192,
				height: 160,
			})
		);

		let url!: string;

		const stateChange = () => {
			if (download.state == "done") {
				if (mounted) {
					setLoading(false);
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

		download.on("state", stateChange);

		onCleanup(() => {
			download.off("state", stateChange);
			URL.revokeObjectURL(url);
		});
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
	}
	return () => null;
}
