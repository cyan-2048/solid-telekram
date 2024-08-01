import { Chat, Message, Thumbnail, tl, User } from "@mtcute/core";
import styles from "./Room.module.scss";
import Content from "./components/Content";
import {
	For,
	JSXElement,
	Show,
	Switch,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	Match,
	batch,
} from "solid-js";
import {
	EE,
	UIDialog,
	UIMessage,
	client,
	currentView,
	dialogsJar,
	editingMessage,
	refreshDialogsByPeer,
	replyingMessage,
	room,
	chat,
	setEditingMessage,
	setReplyingMessage,
	setSoftkeys,
	setView,
	userStatusJar,
} from "@signals";
import ChatPhotoIcon from "./components/ChatPhoto";
import {
	getColorFromPeer,
	getTextFromContentEditable,
	isSelectionAtStart,
	RawPeer,
	sleep,
	typeInTextbox,
	useStore,
} from "@/lib/utils";
import dayjs from "dayjs";
import Markdown, { ModifyString } from "./components/Markdown";
import TelegramIcon from "./components/TelegramIcon";
import AutoResizeTextbox from "./components/AutoResizeTextarea";
import scrollIntoView from "scroll-into-view-if-needed";
import SpatialNavigation from "@/lib/spatial_navigation";
import Options from "./components/Options";
import OptionsItem from "./components/OptionsItem";
import { Portal } from "solid-js/web";
import OptionsMenuMaxHeight from "./components/OptionsMenuMaxHeight";
import { md } from "@mtcute/markdown-parser";
import { debounce } from "lodash-es";
import { downloadFile } from "@/lib/files";
import processWebpToCanvas, { getOptimizedSticker } from "@/lib/heavy-tasks";
import EmojiPicker from "./components/EmojiPicker";
import { timeStamp } from "./Home";
import InsertMenu, { InsertMenuSelected } from "./components/InsertMenu";

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

function getMembersCount(chat: Chat) {
	if ((chat.peer as tl.RawChannel).participantsCount) {
		return (chat.peer as tl.RawChannel).participantsCount;
	}
	return null;
}

const isOverflown = ({ clientHeight, scrollHeight }: HTMLElement) => {
	return scrollHeight - 8 > clientHeight;
};

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

function ActionMessage(props: { children: JSXElement; focusable?: boolean }) {
	return (
		<div class={styles.action_message}>
			<div class={styles.action_message_inner}>
				<span>{props.children}</span>
			</div>
		</div>
	);
}

const SN_ID_OPTIONS = "options";

function willFocusScrollIfNeeded(e: { currentTarget: HTMLElement }) {
	scrollIntoView(e.currentTarget, {
		scrollMode: "if-needed",
		block: "nearest",
		inline: "nearest",
	});
}

const enum TextboxOptionsSelected {
	SEND,
	CANCEL,
	VIEW,
}

function TextboxOptions(props: {
	canSend: boolean;
	onSelect: (e: TextboxOptionsSelected | null) => void;
}) {
	onMount(() => {
		SpatialNavigation.add(SN_ID_OPTIONS, {
			selector: ".option",
			restrict: "self-only",
		});
		SpatialNavigation.focus(SN_ID_OPTIONS);
		setSoftkeys("", "OK", "");
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID_OPTIONS);
	});

	let lastRef!: HTMLDivElement;

	const interacting = createMemo(() => {
		const editing = editingMessage();
		const replying = replyingMessage();
		return editing || replying;
	});

	const isEditing = () => Boolean(editingMessage());

	return (
		<Options
			onClose={() => {
				props.onSelect(null);
			}}
			title="Options"
		>
			<OptionsMenuMaxHeight>
				<Show when={props.canSend}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							props.onSelect(TextboxOptionsSelected.SEND);
						}}
					>
						Send
					</OptionsItem>
				</Show>
				<Show when={interacting()}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							props.onSelect(TextboxOptionsSelected.CANCEL);
						}}
					>
						Cancel {isEditing() ? "Edit" : "Reply"}
					</OptionsItem>
				</Show>
				<OptionsItem
					on:sn-willfocus={willFocusScrollIfNeeded}
					classList={{ option: true, [styles.option_item]: true }}
					tabIndex={-1}
					on:sn-enter-down={() => {
						props.onSelect(TextboxOptionsSelected.VIEW);
					}}
					ref={lastRef}
				>
					Chat info
				</OptionsItem>
			</OptionsMenuMaxHeight>
		</Options>
	);
}

const enum MessageOptionsSelected {
	INFO,
	REPLY,
	EDIT,
	DELETE,
	COPY,
	VIEW,
	JUMP,
}

function MessageOptions(props: {
	dialog: UIDialog;
	message: Message;
	$: UIMessage;
	onSelect: (e: MessageOptionsSelected | null) => void;
}) {
	onMount(() => {
		SpatialNavigation.add(SN_ID_OPTIONS, {
			selector: ".option",
			restrict: "self-only",
		});
		SpatialNavigation.focus(SN_ID_OPTIONS);
		setSoftkeys("", "OK", "");
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID_OPTIONS);
	});

	let lastRef!: HTMLDivElement;

	return (
		<Options
			onClose={() => {
				props.onSelect(null);
			}}
		>
			<OptionsMenuMaxHeight>
				<OptionsItem
					on:sn-willfocus={willFocusScrollIfNeeded}
					classList={{ option: true, [styles.option_item]: true }}
					tabIndex={-1}
				>
					Message info
				</OptionsItem>
				<OptionsItem
					on:sn-willfocus={willFocusScrollIfNeeded}
					classList={{ option: true, [styles.option_item]: true }}
					tabIndex={-1}
					on:sn-enter-down={() => {
						props.onSelect(MessageOptionsSelected.REPLY);
					}}
				>
					Reply
				</OptionsItem>
				<Show when={props.$.canEdit()}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							props.onSelect(MessageOptionsSelected.EDIT);
						}}
					>
						Edit
					</OptionsItem>
				</Show>
				<Show
					when={canDeleteForEverone(props.message, props.dialog) || canDeleteForMe(props.dialog)}
				>
					<OptionsItem
						classList={{ option: true, [styles.option_item]: true }}
						on:sn-enter-down={() => {
							props.onSelect(MessageOptionsSelected.DELETE);
						}}
						on:sn-willfocus={willFocusScrollIfNeeded}
						tabIndex={-1}
						arrow
					>
						Delete
					</OptionsItem>
				</Show>
				<OptionsItem
					on:sn-willfocus={willFocusScrollIfNeeded}
					classList={{ option: true, [styles.option_item]: true }}
					tabIndex={-1}
				>
					Copy
				</OptionsItem>
				<OptionsItem
					on:sn-willfocus={willFocusScrollIfNeeded}
					classList={{ option: true, [styles.option_item]: true }}
					tabIndex={-1}
				>
					View contact
				</OptionsItem>
				<OptionsItem
					on:sn-willfocus={willFocusScrollIfNeeded}
					classList={{ option: true, [styles.option_item]: true }}
					tabIndex={-1}
					on:sn-enter-down={() => {
						props.onSelect(MessageOptionsSelected.JUMP);
					}}
					ref={lastRef}
				>
					Jump to bottom
				</OptionsItem>
			</OptionsMenuMaxHeight>
		</Options>
	);
}

function canDeleteForEverone(message: Message, dialog: UIDialog) {
	const chat = dialog.$.chat;
	if (message.isOutgoing) return true;
	if (chat.chatType == "private") return true;
	return false;
}

function canDeleteForMe(dialog: UIDialog) {
	const chat = dialog.$.chat;
	if (chat.chatType == "private") return true;
	return false;
}

function DeleteOptions(props: { dialog: UIDialog; onSelect: () => void; message: Message }) {
	onMount(() => {
		SpatialNavigation.add(SN_ID_OPTIONS, {
			selector: ".option",
			restrict: "self-only",
		});
		SpatialNavigation.focus(SN_ID_OPTIONS);
		setSoftkeys("", "OK", "");
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID_OPTIONS);
	});

	const tg = client()!;

	return (
		<Options
			onClose={() => {
				props.onSelect();
			}}
			title="Delete"
		>
			<OptionsMenuMaxHeight>
				<Show when={canDeleteForMe(props.dialog)}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							sleep(2).then(async () => {
								const message = props.message;
								await tg
									.deleteMessages([message], {
										revoke: false,
									})
									.then(() => {
										props.dialog.messages.delete(message.id);
										refreshDialogsByPeer([props.dialog.id]);
									});
								// props.dialog.messages.delete(message.id);
							});

							props.onSelect();
						}}
						on:sn-navigatefailed={(e) => {
							const direction = e.detail.direction;
							if (direction == "up" && canDeleteForEverone(props.message, props.dialog)) {
								SpatialNavigation.move("down");
							}
						}}
					>
						Delete for me
					</OptionsItem>
				</Show>

				<Show when={canDeleteForEverone(props.message, props.dialog)}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							sleep(2).then(async () => {
								const message = props.message;

								await tg
									.deleteMessages([message], {
										revoke: true,
									})
									.then(() => {
										props.dialog.messages.delete(message.id);
										refreshDialogsByPeer([props.dialog.id]);
									});
								// props.dialog.messages.delete(message.id);
							});
							props.onSelect();
						}}
						on:sn-navigatefailed={(e) => {
							const direction = e.detail.direction;
							if (direction == "down" && canDeleteForMe(props.dialog)) {
								SpatialNavigation.move("up");
							}
						}}
					>
						Delete for everyone
					</OptionsItem>
				</Show>
			</OptionsMenuMaxHeight>
		</Options>
	);
}

function MessageContainer(props: {
	last: boolean;
	actualLast: boolean;
	children: JSXElement;
	outgoing: boolean;
	tail: boolean;
	dialog: UIDialog;
	$: UIMessage;
	message: Message;
	isSticker: boolean;
	isReply: boolean;
	showUsername: boolean;
}) {
	const tg = client()!;

	onMount(() => {
		if (props.actualLast) {
			console.error("last Message mounted!!!");

			const actEl = document.activeElement as HTMLElement;

			if (actEl && actEl.classList.contains("roomTextbox")) {
				refreshFocusables();

				const dialog = props.dialog;

				setTimeout(() => {
					// if actEl is no longer the same
					if (actEl !== document.activeElement) return;

					dialog.readHistory();
				}, 500);

				scrollIntoView(actEl, {
					behavior: "instant",
					block: "center",
					inline: "center",
				});
			}
		}
	});

	onCleanup(() => {
		const actEl = document.activeElement as HTMLElement;

		if (currentView() == "room" && actEl && actEl.classList.contains(styles.message)) {
			SpatialNavigation.move("down") || SpatialNavigation.move("up");
		}
	});

	const [showOptions, setShowOptions] = createSignal(false);
	const [showDeleteOptions, setShowDeleteOptions] = createSignal(false);

	let divRef!: HTMLDivElement;

	onMount(() => {
		const cb = (msgId: number, chatId: number) => {
			const message = props.message;
			if (message.id === msgId && chatId === message.chat.id) {
				divRef.focus();
			}
		};

		EE.on("requestJump", cb);

		onCleanup(() => EE.off("requestJump", cb));
	});

	function jumpToBottom() {
		sleep(2).then(() => {
			divRef.parentElement!.querySelector<HTMLElement>(".last")?.focus();
		});
	}

	return (
		<>
			<div
				ref={divRef}
				tabIndex={-1}
				onFocus={(e) => {
					if (e.currentTarget == e.target) {
						scrollIntoView(e.currentTarget, {
							behavior: "instant",
							block: "center",
							inline: "center",
						});
					}

					setSoftkeys("tg:arrow_down", "INFO", "tg:more");
				}}
				on:sn-navigatefailed={async (e) => {
					const direction = e.detail.direction;

					if (direction == "up") {
						await props.dialog.messages.loadMore();
						scrollIntoView(e.target, {
							behavior: "instant",
							block: "center",
							inline: "center",
						});
					}
				}}
				onKeyDown={(e) => {
					if (e.key == "Backspace") {
						setView("home");
						e.preventDefault();
						return;
					}

					if (e.key == "SoftLeft") {
						jumpToBottom();
					}

					if (e.key == "SoftRight") {
						setShowOptions(true);
					}
				}}
				classList={{
					[styles.message]: true,
					[styles.padTop]: props.tail,
					focusable: true,
					last: props.last,
				}}
			>
				<div
					classList={{
						[styles.message_inner]: true,
						[styles.outgoing]: props.outgoing,
						[styles.tail]: props.tail,
						[styles.isSticker]: props.isSticker,
						[styles.isReply]: props.isReply,
						[styles.showUsername]: props.showUsername,
					}}
				>
					{props.children}
				</div>
			</div>
			<Show when={showOptions()}>
				<Portal>
					<MessageOptions
						$={props.$}
						message={props.message}
						dialog={props.dialog}
						onSelect={(e) => {
							setShowOptions(false);

							if (e == MessageOptionsSelected.DELETE) {
								setShowDeleteOptions(true);
								return;
							}

							switch (e) {
								case MessageOptionsSelected.JUMP:
									jumpToBottom();
									break;
								case MessageOptionsSelected.EDIT:
								case MessageOptionsSelected.REPLY:
									const edit = e == MessageOptionsSelected.EDIT;

									batch(() => {
										setEditingMessage(null);
										setReplyingMessage(null);

										if (edit) {
											setEditingMessage(props.$);
										} else {
											setReplyingMessage(props.$);
										}
									});

									// we don't want to refocus
									return;
							}

							SpatialNavigation.focus("room");
						}}
					/>
				</Portal>
			</Show>
			<Show when={showDeleteOptions()}>
				<Portal>
					<DeleteOptions
						dialog={props.dialog}
						message={props.message}
						onSelect={() => {
							SpatialNavigation.focus("room");
							setShowDeleteOptions(false);
						}}
					/>
				</Portal>
			</Show>
		</>
	);
}

function ReplyBase(props: { title: JSXElement; children: JSXElement }) {
	return (
		<div class={styles.reply}>
			<div class={styles.reply_border}></div>
			<div class={styles.reply_details}>
				<div class={styles.reply_username}>
					<span>{props.title}</span>
				</div>
				<div class={styles.reply_text}>
					<span>{props.children}</span>
				</div>
			</div>
		</div>
	);
}

function ReplyMessage(props: { $: UIMessage }) {
	const text = useStore(() => props.$.text);

	return (
		<ReplyBase
			title={
				<span
					style={{
						color: `var(--peer-avatar-${getColorFromPeer((props.$.sender as User).raw)}-bottom)`,
					}}
				>
					{props.$.sender.displayName}
				</span>
			}
		>
			<ModifyString text={text()} />
		</ReplyBase>
	);
}

function DeletedReplyMessage() {
	return <ReplyBase title="Deleted Message">???</ReplyBase>;
}

function LoadingReplyMessage() {
	return <ReplyBase title="Loading...">???</ReplyBase>;
}

function UsernameContainer(props: { children: JSXElement; peer: RawPeer }) {
	return (
		<div class={styles.username}>
			<div class={styles.username_inner}>
				<span style={{ color: `var(--peer-avatar-${getColorFromPeer(props.peer)}-bottom)` }}>
					{props.children}
				</span>
			</div>
		</div>
	);
}

function MessageAdditionalInfo(props: {
	$: UIMessage;
	dialog: UIDialog;
	setWidth: (n: number) => void;
}) {
	const edited = useStore(() => props.$.editDate);
	const lastReadOutgoing = useStore(() => props.dialog.lastReadOutgoing);

	// returns false if double check
	const check = () => lastReadOutgoing() < props.$.id;

	let divRef!: HTMLDivElement;

	createEffect(() => {
		edited();
		check();
		lastReadOutgoing();

		props.setWidth(divRef.offsetWidth);
	});

	return (
		<div ref={divRef} class={styles.message_info}>
			<Show when={edited() && !props.$.$.hideEditMark}>
				<div class={styles.edited}>edited</div>
			</Show>
			<Show when={props.$.isOutgoing}>
				<div class={styles.info_check}>
					<TelegramIcon name={check() ? "check" : "checks"} />
				</div>
			</Show>
		</div>
	);
}

function StickerThumbnail(props: { $: UIMessage }) {
	if (props.$.$.media?.type != "sticker") throw new Error("NOT A STICKER!");

	return (
		<div>
			<svg
				version="1.1"
				xmlns="http://www.w3.org/2000/svg"
				xmlns:xlink="http://www.w3.org/1999/xlink"
				viewBox="0 0 512 512"
			>
				<path
					fill="rgba(0, 0, 0, 0.08)"
					d={props.$.$.media.getThumbnail(Thumbnail.THUMB_OUTLINE)!.path}
				/>
			</svg>
		</div>
	);
}

function StickerMedia(props: { $: UIMessage }) {
	if (props.$.$.media?.type !== "sticker") throw new Error("NOT STICKER MEDIA");

	let canvasRef!: HTMLCanvasElement;

	// if this is set, use img tag
	const [src, setSrc] = createSignal("");
	const [video, setVideo] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [showUnsupported, setShowUnsupported] = createSignal(false);

	onMount(() => {
		const media = props.$.$.media;
		if (!media) return;
		if (media.type !== "sticker") return;

		if (media.mimeType.includes("webm")) {
			const download = downloadFile(media, {
				retries: 12,
			});

			download.result.then((url) => {
				setVideo(url);
			});

			onCleanup(() => {
				download.cancel();
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

				media.raw.id.toInt(),
				props.$.$.date
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
		const media = props.$.$.media;
		if (!media) return;
		if (media.type !== "sticker") return;
		if (!media.mimeType.includes("webp")) return;

		console.error("STICKEERRRR", media, media.thumbnails);

		const isKai3 = import.meta.env.VITE_KAIOS == 3;

		// if kai3 use img tag
		if (isKai3) {
			const download = downloadFile(media, {
				retries: 12,
			});

			download.result.then((url) => {
				setSrc(url);
			});

			onCleanup(() => {
				download.cancel();
			});

			return;
		}

		const download = downloadFile<Uint8Array>(media, {
			retries: 12,
			buffer: true,
		});

		let url: string | undefined;

		download.result.then((buffer) => {
			processWebpToCanvas(canvasRef, buffer).then((res) => {
				if (res != null) {
					setSrc((url = URL.createObjectURL(res)));
				} else {
					setLoading(false);
				}
			});
		});

		onCleanup(() => {
			download.cancel();
			url && URL.revokeObjectURL(url);
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
									<StickerThumbnail $={props.$}></StickerThumbnail>
								</Show>
								<Show
									when={src()}
									fallback={<canvas ref={canvasRef} width={128} height={128}></canvas>}
								>
									{(src) => (
										<img
											onLoad={() => {
												setLoading(false);
											}}
											onError={(e) => {
												console.error("ERROR OCCURED STICKER", e);
											}}
											width={128}
											src={src()}
										/>
									)}
								</Show>
							</>
						}
					>
						<video
							onError={(e) => {
								console.error("VIDEO STICKER ERROR", e);
							}}
							autoplay
							loop
							src={video()}
						></video>
					</Show>
				}
			>
				<img src={new URL("../assets/unsupported sticker.jpg", import.meta.url).href}></img>
			</Show>
		</div>
	);
}

// wtf typescript????
function MessageAction(props: {
	$: UIMessage & {
		$: Message & {
			action: {};
		};
	};
}) {
	const text = useStore(() => props.$.text);

	return (
		<Show when={props.$.$.action.type != "history_cleared"}>
			<ActionMessage>{text()}</ActionMessage>
		</Show>
	);
}

function MessageItem(props: { $: UIMessage; before?: UIMessage; dialog: UIDialog; last: boolean }) {
	const tg = client();

	if (!tg) {
		throw new Error("CLIENT NOT READY !!!!");
	}

	const text = useStore(() => props.$.text);
	const entities = useStore(() => props.$.entities);

	const [isOverflowing, setOverflowing] = createSignal(false);

	let textWrapRef!: HTMLDivElement;

	createEffect(() => {
		text();

		textWrapRef && setOverflowing(isOverflown(textWrapRef));
	});

	// 0 when deleted message
	const [reply, setReply] = createSignal(null as UIMessage | null | 0);

	createEffect(() => {
		const _ = props.$.isReply();

		if (_) {
			props.$.getReply(props.dialog).then((msg) => {
				setReply(msg ?? 0);
			});
		} else {
			setReply(null);
		}
	});

	const [infoWidth, setInfoWidth] = createSignal(0);

	return (
		<>
			<Show when={decideDateSepatator(props.before?.date, props.$.date)}>
				{(res) => (
					<ActionMessage>
						{res() === 1
							? "YESTERDAY"
							: res() == 2
							? "TODAY"
							: props.$.date
									.toLocaleDateString(navigator.language, {
										month: "long",
										day: "2-digit",
										year: "numeric",
									})
									.toUpperCase()}
					</ActionMessage>
				)}
			</Show>
			<Show
				when={props.$.$.action}
				fallback={
					<MessageContainer
						actualLast={props.last}
						last={props.last && chat()?.chatType == "channel"}
						outgoing={props.$.isOutgoing}
						tail={
							props.$.isSticker
								? props.$.isReply()
									? decideTail(props.before, props.$)
									: false
								: decideTail(props.before, props.$)
						}
						dialog={props.dialog}
						message={props.$.$}
						$={props.$}
						isSticker={props.$.isSticker}
						isReply={!!props.$.isReply()}
						showUsername={decideShowUsername(props.before, props.$)}
					>
						<Show when={decideShowUsername(props.before, props.$)}>
							<UsernameContainer peer={(props.$.sender as User).raw}>
								{props.$.sender.displayName}
							</UsernameContainer>
						</Show>

						<Show when={props.$.isReply() && reply() === null}>
							<LoadingReplyMessage />
						</Show>
						<Switch>
							<Match when={reply() === 0}>
								<DeletedReplyMessage />
							</Match>
							<Match when={reply() instanceof UIMessage}>
								<ReplyMessage $={reply() as UIMessage} />
							</Match>
						</Switch>
						<Show when={props.$.isSticker}>
							<StickerMedia $={props.$} />
						</Show>
						<Show when={!props.$.isSticker}>
							<div class={styles.text_container}>
								<div ref={textWrapRef} class={styles.text_wrap}>
									<div class={styles.text}>
										{<Markdown entities={entities()} />}
										<span class={styles.extra_width} style={{ width: infoWidth() + "px" }}></span>
									</div>
									<Show when={isOverflowing()}>
										<div class={styles.more_container}>
											<div class={styles.more_fade}></div>
											<div class={styles.more_button}>
												more
												<span
													class={styles.extra_width}
													style={{ width: infoWidth() + "px" }}
												></span>
											</div>
										</div>
									</Show>
								</div>
							</div>
							<MessageAdditionalInfo
								$={props.$}
								dialog={props.dialog}
								setWidth={(n) => {
									setInfoWidth(n);
								}}
							/>
						</Show>
					</MessageContainer>
				}
			>
				<MessageAction $={props.$ as any} />
			</Show>
		</>
	);
}

function WhenMounted(props: { children: JSXElement; onMount: () => void }) {
	onMount(() => {
		props.onMount();
	});

	return <>{props.children}</>;
}

function TextBoxOptionsWrap(props: {
	text: string;
	showOptions: boolean;
	showEmojiPicker: boolean;
	showInsertMenu: boolean;

	setShowOptions: (e: boolean) => void;
	setShowEmojiPicker: (e: boolean) => void;
	setShowInsertMenu: (e: boolean) => void;

	dialog: UIDialog;
	textboxRef: HTMLPreElement;
}) {
	const tg = client()!;
	const text = () => props.text;
	const showOptions = () => props.showOptions;
	const showEmojiPicker = () => props.showEmojiPicker;
	const showInsertMenu = () => props.showInsertMenu;

	const interacting = createMemo(() => {
		const editing = editingMessage();
		const replying = replyingMessage();
		return editing || replying;
	});

	return (
		<>
			<Show when={showOptions()}>
				<Portal>
					<TextboxOptions
						canSend={!!text()}
						onSelect={async (e) => {
							await sleep(2);

							props.setShowOptions(false);

							if (!interacting()) {
								// TODO: don't focus if show info
								SpatialNavigation.focus("room");
							}

							if (e === null) {
								props.textboxRef.focus();
								return;
							}

							const dialog = props.dialog;
							switch (e) {
								case TextboxOptionsSelected.SEND:
									if (!interacting()) {
										tg.sendText(props.dialog.$.chat, md(text())).then((msg) => {
											dialog.messages.add(msg);
										});
									} else {
										const editing = editingMessage();
										const replying = replyingMessage();

										batch(() => {
											setEditingMessage(null);
											setReplyingMessage(null);
										});

										if (editing) {
											tg.editMessage({
												message: editing.$,
												text: md(text()),
											}).then((msg) => {
												dialog.messages.update(msg.id, msg);
											});
										} else if (replying) {
											tg.replyText(replying.$, md(text())).then((msg) => {
												dialog.messages.add(msg);
											});

											sleep(0).then(() => {
												document.querySelector<HTMLDivElement>(".roomTextbox")?.focus();
											});
										}
									}

									props.textboxRef.textContent = "";
									// ignore please
									props.textboxRef.appendChild((<br></br>) as Node);
									props.textboxRef.dispatchEvent(new Event("input", { bubbles: true }));

									SpatialNavigation.focus("room");

									break;

								case TextboxOptionsSelected.CANCEL:
									batch(() => {
										setEditingMessage(null);
										setReplyingMessage(null);
									});

									SpatialNavigation.focus("room");

									break;
							}
						}}
					/>
				</Portal>
			</Show>
			<Show when={showEmojiPicker()}>
				<Portal>
					<EmojiPicker
						onSelect={async (e) => {
							await sleep(2);
							props.setShowEmojiPicker(false);
							props.textboxRef.focus();
							await sleep(1);
							if (e) {
								typeInTextbox(e, props.textboxRef);
							}
						}}
					/>
				</Portal>
			</Show>
			<Show when={showInsertMenu()}>
				<Portal>
					<InsertMenu
						onSelect={async (e) => {
							await sleep(2);
							props.setShowInsertMenu(false);

							switch (e) {
								case InsertMenuSelected.EMOJI:
									props.setShowEmojiPicker(true);
									return;
							}

							props.textboxRef.focus();
						}}
					/>
				</Portal>
			</Show>
		</>
	);
}

function TextBox(props: { dialog: UIDialog }) {
	const [focused, setFocused] = createSignal(false);
	let divRef!: HTMLDivElement;

	const [showOptions, setShowOptions] = createSignal(false);
	const [showEmojiPicker, setShowEmojiPicker] = createSignal(false);
	const [showInsertMenu, setShowInsertMenu] = createSignal(false);

	const tg = client()!;

	const [text, setText] = createSignal("");

	let textboxRef!: HTMLPreElement;

	const debounced_sendTyping = debounce(() => {
		console.log("SENDING TYPING STATE");
		tg.sendTyping(props.dialog.$.chat);
	}, 2000);

	let keyup = false;

	const interacting = createMemo(() => {
		const editing = editingMessage();
		const replying = replyingMessage();
		return editing || replying;
	});

	return (
		<>
			<div
				style={
					interacting()
						? {
								display: "none",
						  }
						: undefined
				}
				ref={divRef}
				classList={{ [styles.textarea_container]: true, [styles.focused]: focused() }}
			>
				<AutoResizeTextbox
					onBlur={() => {
						setFocused(false);
					}}
					ref={textboxRef}
					onFocus={() => {
						setFocused(true);
						divRef.scrollIntoView(true);
						setSoftkeys("tg:add", "Enter", "tg:more");
						const dialog = props.dialog;

						dialog.$.chat.isAdmin;

						dialog.readHistory();
					}}
					onInput={(e) => {
						debounced_sendTyping();
						divRef.scrollIntoView(true);

						setText(getTextFromContentEditable(e.currentTarget));

						sleep(0).then(() => {
							divRef.scrollIntoView(true);
						});
					}}
					classList={{ focusable: true, last: true, roomTextbox: true }}
					placeholder="Message"
					onKeyUp={() => {
						keyup = true;
					}}
					onKeyDown={(e) => {
						keyup = false;
						const canUseKeyboard =
							!getTextFromContentEditable(e.currentTarget) || isSelectionAtStart();

						if (e.key == "Backspace" && canUseKeyboard) {
							setView("home");
							e.preventDefault();
							return;
						}

						if (e.key.includes("Arrow")) {
							if (e.key == "ArrowUp" && canUseKeyboard) return;
							e.stopImmediatePropagation();
							e.stopPropagation();
						}

						if (e.key == "SoftRight") {
							setShowOptions(true);
						}

						if (e.key == "SoftLeft") {
							setShowInsertMenu(true);
						}
					}}
				/>
			</div>
			<TextBoxOptionsWrap
				text={text()}
				showOptions={showOptions()}
				setShowOptions={setShowOptions}
				showEmojiPicker={showEmojiPicker()}
				setShowEmojiPicker={setShowEmojiPicker}
				showInsertMenu={showInsertMenu()}
				setShowInsertMenu={setShowInsertMenu}
				dialog={props.dialog}
				textboxRef={textboxRef}
			/>
		</>
	);
}

const ONE_FOCUSABLE = ".focusable";
const TWO_FOCUSABLE = ONE_FOCUSABLE.repeat(2);

let lastUsedFocusableClass = TWO_FOCUSABLE;

function refreshFocusables() {
	SpatialNavigation.remove("room");

	const focusableToUse = (lastUsedFocusableClass =
		lastUsedFocusableClass == ONE_FOCUSABLE ? TWO_FOCUSABLE : ONE_FOCUSABLE);

	SpatialNavigation.add("room", {
		selector: `.${styles.room} ${focusableToUse}, .${styles.room} .last${focusableToUse}`,
		rememberSource: true,
		enterTo: "last-focused",
		restrict: "self-only",
		defaultElement: `.${styles.room} .last${focusableToUse}`,
	});
}

function Messages(props: { dialog: UIDialog }) {
	const messages = useStore(() => props.dialog.messages.sorted);

	const loading = useStore(() => props.dialog.messages.isLoading);

	createEffect(() => {
		const _ = loading();

		if (_) {
			setSoftkeys("", "Loading...", "", true);
		}
	});

	let divRef!: HTMLDivElement;

	onMount(() => {
		refreshFocusables();
	});

	createEffect(() => {
		const inView = currentView() == "room";

		if (inView && !loading()) {
			sleep(100).then(() => SpatialNavigation.focus("room"));
		}
	});

	onCleanup(() => {
		SpatialNavigation.remove("room");
	});

	return (
		<div
			ref={divRef}
			class={styles.room}
			style={
				import.meta.env.DEV
					? {
							overflow: "auto",
					  }
					: undefined
			}
		>
			<Show when={!loading()}>
				<WhenMounted
					onMount={() => {
						divRef.scrollTop = divRef.scrollHeight;
						sleep(10).then(() => {
							SpatialNavigation.focus("room");
						});
					}}
				>
					<For each={messages()}>
						{(e, index) => (
							<MessageItem
								last={index() == messages().length - 1}
								dialog={props.dialog}
								$={e}
								before={messages()[index() - 1]}
							/>
						)}
					</For>
				</WhenMounted>

				<Show when={chat()!.chatType !== "channel"}>
					<TextBox dialog={props.dialog} />
				</Show>
			</Show>
		</div>
	);
}

function UserStatusIndicator(props: { userId: number }) {
	const userStatus = () => userStatusJar.get(props.userId);

	const lastOnline = useStore(() => userStatus().lastOnline);
	const status = useStore(() => userStatus().status);

	return (
		<Show when={lastOnline()} fallback={status() == "long_time_ago" ? "offline" : status()}>
			Last online on {timeStamp(lastOnline()!)}
		</Show>
	);
}

function FloatingTextbox(props: { message: UIMessage; dialog: UIDialog }) {
	const [showOptions, setShowOptions] = createSignal(false);
	const [showEmojiPicker, setShowEmojiPicker] = createSignal(false);
	const [showInsertMenu, setShowInsertMenu] = createSignal(false);

	const tg = client()!;

	let textboxRef!: HTMLPreElement;

	const [text, setText] = createSignal("");

	const debounced_sendTyping = debounce(
		() => {
			console.log("SENDING TYPING STATE");
			tg.sendTyping(props.dialog.$.chat);
		},
		2000,
		{
			leading: true,
			maxWait: 1,
		}
	);

	onMount(() => {
		setTimeout(() => {
			textboxRef.focus();
			const edit = editingMessage();
			if (edit) {
				typeInTextbox(md.unparse(edit.$.textWithEntities), textboxRef);
			}
		}, 100);
	});

	return (
		<>
			<div classList={{ [styles.floating_textbox]: true, [styles.focused]: true }}>
				<div
					style={{
						"--border": `var(--peer-avatar-${getColorFromPeer(
							(props.message.sender as User).raw
						)}-bottom)`,
					}}
				>
					<ReplyMessage $={props.message} />
				</div>
				<AutoResizeTextbox
					ref={textboxRef}
					onInput={(e) => {
						debounced_sendTyping();

						setText(getTextFromContentEditable(e.currentTarget));
					}}
					placeholder="Message"
					onFocus={() => {
						setSoftkeys("tg:add", "Enter", "tg:more");
					}}
					onKeyDown={(e) => {
						const canUseKeyboard =
							!getTextFromContentEditable(e.currentTarget) || isSelectionAtStart();

						if (e.key == "Backspace" && canUseKeyboard) {
							batch(() => {
								setEditingMessage(null);
								setReplyingMessage(null);
							});

							SpatialNavigation.focus("room");

							e.preventDefault();
							return;
						}

						if (e.key.includes("Arrow")) {
							if (e.key == "ArrowUp" && canUseKeyboard) return;
							e.stopImmediatePropagation();
							e.stopPropagation();
						}

						if (e.key == "SoftRight") {
							setShowOptions(true);
						}

						if (e.key == "SoftLeft") {
							setShowInsertMenu(true);
						}
					}}
				/>
			</div>

			<TextBoxOptionsWrap
				text={text()}
				showOptions={showOptions()}
				setShowOptions={setShowOptions}
				showEmojiPicker={showEmojiPicker()}
				setShowEmojiPicker={setShowEmojiPicker}
				showInsertMenu={showInsertMenu()}
				setShowInsertMenu={setShowInsertMenu}
				dialog={props.dialog}
				textboxRef={textboxRef}
			/>
		</>
	);
}

export default function Room(props: { hidden: boolean }) {
	const [uiDialog, setUIDialog] = createSignal<null | UIDialog>(null);

	const interacting = createMemo(() => {
		const editing = editingMessage();
		const replying = replyingMessage();
		return editing || replying;
	});

	createEffect(() => {
		const tg = client();
		if (!tg) return;

		const _room = room();

		let clean = true;

		if (_room) {
			tg.openChat(_room);

			// console.log(dialogsJar.get(_room.id), _room.id, _room);

			if (_room instanceof UIDialog) {
				setUIDialog(_room);
			} else {
				tg.getPeerDialogs(_room).then(([e]) => {
					if (e && clean) {
						setUIDialog(dialogsJar.add(e));
					}
				});
			}

			onCleanup(() => {
				clean = false;
				tg.closeChat(_room);
			});
		}
	});

	return (
		<Show when={chat()}>
			{(chat) => (
				<Content
					before={
						<div class={styles.header}>
							<div class={styles.avatar}>
								<ChatPhotoIcon chat={chat()} />
							</div>
							<div class={styles.details}>
								<div class={styles.top}>
									<span>{chat().isSelf ? "Saved Messages" : chat().displayName}</span>
								</div>

								<div class={styles.bottom}>
									<span>
										<Show
											when={chat().chatType != "private"}
											fallback={
												<Show
													when={
														!chat().isSupport &&
														chat().peer._ == "user" &&
														!(chat().peer as tl.RawUser).bot
													}
												>
													<UserStatusIndicator userId={chat().peer.id} />
												</Show>
											}
										>
											{getMembersCount(chat())}{" "}
											{chat().chatType == "channel" ? "Subscribers" : "Members"}
										</Show>
									</span>
								</div>
							</div>
						</div>
					}
					hidden={props.hidden}
					after={
						<Show when={uiDialog()}>
							{(dialog) => (
								<Show when={interacting()}>
									{(msg) => <FloatingTextbox dialog={dialog()} message={msg()} />}
								</Show>
							)}
						</Show>
					}
				>
					<Show when={uiDialog()}>{(dialog) => <Messages dialog={dialog()} />}</Show>
				</Content>
			)}
		</Show>
	);
}
