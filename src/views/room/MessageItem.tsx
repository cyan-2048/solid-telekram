import UIDialog from "@/ui/UIDialog";
import type UIMessage from "@/ui/UIMessage";
import { EE, tg } from "@globals";
import {
	getColorFromPeer,
	isUser,
	niceBytes,
	type RawPeer,
	resolveSync,
	setSoftkeys,
	sleep,
	toaster,
	useMessageChecks,
	useStore,
} from "@utils";
import {
	type JSXElement,
	createSignal,
	createMemo,
	useContext,
	type Setter,
	createContext,
	Show,
	createEffect,
	onCleanup,
	onMount,
	Switch,
	Match,
	type ComponentProps,
	splitProps,
	untrack,
	createUniqueId,
	batch,
} from "solid-js";
import { DiceMedia, StickerMedia, switchMessageMedia } from "./MessageMedia";
import type { TextWithEntities, MessageMediaType, MessageMedia, Message, User, Peer, Audio } from "@mtcute/core";
import { md } from "@mtcute/markdown-parser";
import type { TelegramClient } from "@mtcute/web";

import * as styles from "./MessageItem.module.scss";
import scrollIntoView from "scroll-into-view-if-needed";
import SpatialNavigation from "@/lib/spatial_navigation";
import { $editingMessage, $replyingMessage, $view, setStatusbarColor } from "@/stores";
import { volumeDown, volumeUp } from "@/lib/volumeManager";
import Markdown, { MarkdownText } from "@components/Markdown";
import TelegramIcon from "@components/TelegramIcon";
import { Dynamic, Portal } from "solid-js/web";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { differenceInMinutes } from "date-fns/differenceInMinutes";
import { startOfDay } from "date-fns/startOfDay";
import type { UIMessageUploading } from "@/ui/UIDialog";
import ProgressSpinner from "../components/ProgressSpinner";
import PeerPhotoIcon from "../components/PeerPhotoIcon";
import { joinTextWithEntities } from "@mtcute/core/utils.js";
import Options from "../components/Options";
import OptionsMenuMaxHeight from "../components/OptionsMenuMaxHeight";
import OptionsItem from "../components/OptionsItem";
import MessageInfo from "./MessageInfo";
import MusicPlayer from "./MusicPlayer";

export function toMidnight(date: Date) {
	return startOfDay(date);
}

export function today() {
	return toMidnight(new Date());
}

export function decideDateSepatator(dateBefore: Date | undefined, dateAfter: Date) {
	if (!dateBefore) return true;

	const day1 = toMidnight(dateBefore);
	const day2 = toMidnight(dateAfter);

	// console.log(day1.toDate(), day2.toDate());
	// console.log(dateBefore, dateAfter);

	const diff = Math.abs(differenceInCalendarDays(day1, day2));

	if (diff > 0) {
		const diffToday = differenceInCalendarDays(today(), day2);
		if (diffToday === 1) return 1;
		if (diffToday === 0) return 2;

		return true;
	}

	return false;
}

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

const isOverflown = ({ clientHeight, scrollHeight }: HTMLElement) => {
	const result = scrollHeight - 16 > clientHeight;

	// if (result) {
	// 	console.error("OVERFLOWING REASON:", scrollHeight, clientHeight);
	// }

	return result;
};

function decideTail(before: UIMessage | undefined, after: UIMessage) {
	if (!before) return true;

	const hasDateSeparator = decideDateSepatator(before.date, after.date);

	if (hasDateSeparator) return true;

	if (before.chatType === ChatType.CHANNEL) {
		// broadcast channels seems to always have tails on them?
		return true;
	}

	// if different senders
	if (before.sender.id !== after.sender.id) {
		return true;
	}

	const day1 = before.date;
	const day2 = after.date;

	const minuteDiff = Math.abs(differenceInMinutes(day1, day2));

	// if more than 1 minute has passed
	if (minuteDiff > 0) {
		return true;
	}

	return false;
}

function decideShowUsername(before: UIMessage | undefined, after: UIMessage) {
	const chat = after.raw.chat;

	if (after.isSticker && after.raw.forward) {
		return true;
	}

	if (
		isUser(chat) ||
		// broadcast groups don't seem to show who sent messages?? idk
		chat.chatType === ChatType.CHANNEL ||
		after.isOutgoing
	) {
		return false;
	}

	return decideTail(before, after);
}

type MessageActionTypes = NonNullable<Message["action"]>["type"] | undefined;

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

	/**
	 * - undefined: reply is loading
	 * - 0: reply was deleted
	 * - 1: reply is a quote
	 */
	reply: () => UIMessage | undefined | 0 | 1;
	dialog: () => UIDialog;
	message: () => UIMessage;
	rawMessage: () => Message;

	isSticker: () => boolean;
	isDice: () => boolean;
	isOutgoing: () => boolean;
	isReply: () => boolean;

	showChecks: () => boolean;
	showTail: () => boolean;
	showContainerTail: () => boolean;
	showUsername: () => boolean;
	showDateSeparator: () => boolean | 1 | 2;

	isExpanded: () => boolean;

	actualLast: () => boolean;
	last: () => boolean;
	first: () => boolean;
	edited: () => Date | null;
	tg: TelegramClient;
}>();

export function MessageProvider(props: {
	$: UIMessage;
	before?: UIMessage;
	dialog: UIDialog;
	last: boolean;
	first: boolean;
	children: JSXElement;
	expanded?: boolean;
}) {
	const [focused, setFocused] = createSignal(false);

	/*
	const [reply] = createResource(async () => {
		const isReply = props.$.isReply();
		if (isReply) {
			const replyToMessage = props.$.rawMessage.replyToMessage;
			if (replyToMessage?.isQuote) {
				return 1;
			}

			const msg = await props.$.getReply(props.dialog);
			return msg ?? 0;
		} else {
			return undefined;
		}
	});
	*/

	const [reply, setReply] = createSignal<UIMessage | undefined | 0 | 1>(undefined);

	createEffect(() => {
		let mounted = true;

		setReply(undefined);

		const msg = props.$;
		const dialog = props.dialog;
		const isReply = msg.isReply();
		const replyToMessage = msg.raw.replyToMessage;

		if (isReply) {
			if (replyToMessage!.isQuote) {
				setReply(1);
				return;
			}

			resolveSync(msg.getReply(dialog), (msg) => {
				if (mounted) setReply(msg ?? 0);
			});
		} else {
			setReply(undefined);
		}

		onCleanup(() => {
			mounted = false;
		});
	});

	const text = useStore(() => props.$.$text);
	const entities = useStore(() => props.$.$entities);

	const mediaType = createMemo(() => props.$.raw.media?.type);

	const showChecks = createMemo(() => props.$.isOutgoing && !(entities().entities || entities().text));

	const showTail = createMemo(() => decideTail(props.before, props.$));
	const showUsername = createMemo(() => decideShowUsername(props.before, props.$));

	const showContainerTail = createMemo(() =>
		props.$.isSticker ? (props.$.isReply() ? showTail() : false) : showTail(),
	);

	const actionType = createMemo(() => props.$.raw.action?.type);

	const showDateSeparator = createMemo(() => decideDateSepatator(props.before?.date, props.$.date));

	const [audioPlaying, setAudioPlaying] = createSignal(false);
	const [audioSpeed, setAudioSpeed] = createSignal(1);

	const edited = useStore(() => props.$.$editDate);

	const isExpanded = () => !!props.expanded;

	return (
		<MessageContext.Provider
			value={{
				tg,

				isExpanded,

				edited,

				audioSpeed,
				setAudioSpeed,

				audioPlaying,
				setAudioPlaying,

				actionType,
				media: () => props.$.raw.media,
				action: () => props.$.raw.action,

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

				last: () => props.last && props.$.chatType == "channel",
				actualLast: () => props.last,
				isOutgoing: () => props.$.isOutgoing,
				rawMessage: () => props.$.raw,
				message: () => props.$,
				isSticker: () => props.$.isSticker || props.$.media?.type == "dice",
				isDice: () => props.$.media?.type == "dice",
				isReply: () => props.$.isReply(),

				first: () => props.first,
			}}
		>
			{props.children}
		</MessageContext.Provider>
	);
}

export function useMessageContext() {
	return useContext(MessageContext)!;
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

function willFocusScrollIfNeeded(e: { currentTarget: HTMLElement }) {
	scrollIntoView(e.currentTarget, {
		scrollMode: "if-needed",
		block: "nearest",
		inline: "nearest",
	});
}

function canDeleteForEverone(message: Message, dialog: UIDialog) {
	if (message.isOutgoing) return true;
	if (dialog.chatType == "private") return true;
	return false;
}

function canDeleteForMe(dialog: UIDialog) {
	if (dialog.chatType == "private") return true;
	return false;
}

function DeleteOptions(props: { onSelect: () => void }) {
	const { dialog, rawMessage } = useMessageContext();

	const SN_ID = createUniqueId();

	onMount(() => {
		SpatialNavigation.add(SN_ID, {
			selector: ".option",
			restrict: "self-only",
		});
		SpatialNavigation.focus(SN_ID);
		setSoftkeys("", "OK", "");
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
	});

	return (
		<Options
			onClose={() => {
				props.onSelect();
			}}
			title="Delete"
		>
			<OptionsMenuMaxHeight>
				<Show when={canDeleteForMe(dialog())}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							sleep(2).then(async () => {
								const message = rawMessage();
								await tg
									.deleteMessages([message], {
										revoke: false,
									})
									.then(() => {
										dialog().messages.delete(message.id);
										UIDialog.refreshDialogsByPeer([dialog().peer]);
									});
								// dialog().messages.delete(message.id);
							});

							props.onSelect();
						}}
						on:sn-navigatefailed={(e) => {
							const direction = e.detail.direction;
							if (direction == "up" && canDeleteForEverone(rawMessage(), dialog())) {
								SpatialNavigation.move("down");
							}
						}}
					>
						Delete for me
					</OptionsItem>
				</Show>

				<Show when={canDeleteForEverone(rawMessage(), dialog())}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							const _dialog = dialog();
							sleep(2).then(() => {
								const message = rawMessage();

								tg.deleteMessages([message], {
									revoke: true,
								}).then(() => {
									_dialog.messages.delete(message.id);
									UIDialog.refreshDialogsByPeer(_dialog.id);
								});
								// dialog().messages.delete(message.id);
							});
							props.onSelect();
						}}
						on:sn-navigatefailed={(e) => {
							const direction = e.detail.direction;
							if (direction == "down" && canDeleteForMe(dialog())) {
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

function MessageOptions(props: { onSelect: (e: MessageOptionsSelected | null) => void }) {
	const { dialog, message, rawMessage, entities } = useMessageContext();

	const SN_ID = createUniqueId();

	onMount(() => {
		SpatialNavigation.add(SN_ID, {
			selector: ".option",
			restrict: "self-only",
		});
		SpatialNavigation.focus(SN_ID);
		setSoftkeys("", "OK", "");
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
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
					on:sn-enter-down={() => {
						props.onSelect(MessageOptionsSelected.INFO);
					}}
				>
					Message info
				</OptionsItem>
				<Show when={dialog().chatType !== "channel"}>
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
				</Show>
				<Show when={message().canEdit()}>
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
				<Show when={canDeleteForEverone(rawMessage(), dialog()) || canDeleteForMe(dialog())}>
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
				<Show when={entities().entities || entities().text}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							props.onSelect(MessageOptionsSelected.COPY);
						}}
					>
						Copy
					</OptionsItem>
				</Show>
				{/* <OptionsItem
					on:sn-willfocus={willFocusScrollIfNeeded}
					classList={{ option: true, [styles.option_item]: true }}
					tabIndex={-1}
				>
					View contact
				</OptionsItem> */}
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

export function UsernameContainer(props: {
	children: JSXElement;
	peer: RawPeer;
	sticker?: boolean;
	after?: JSXElement;
	forward?: boolean;
}) {
	return (
		<div
			classList={{
				[styles.username]: true,
				[styles.sticker_username]: props.sticker,
				[styles.lite]: props.forward,
			}}
		>
			<div class={styles.username_inner}>
				<span
					style={{
						color: `var(--peer-avatar-${getColorFromPeer(props.peer)}-bottom)`,
					}}
				>
					{props.children}
				</span>
			</div>
			{props.after}
		</div>
	);
}

function ReplyBase(props: { title: JSXElement; children: JSXElement; multiline?: boolean }) {
	return (
		<div class={styles.reply}>
			<div class={styles.reply_border}></div>
			<div class={styles.reply_details}>
				<div class={styles.reply_username}>
					<span>{props.title}</span>
				</div>
				<div
					style={
						props.multiline
							? {
									"white-space": "normal",
								}
							: undefined
					}
					class={styles.reply_text}
				>
					<span>{props.children}</span>
				</div>
			</div>
		</div>
	);
}

export function ReplyMessage(props: { $: UIMessage }) {
	const text = useStore(() => props.$.$text);

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
			<MarkdownText text={text()} />
		</ReplyBase>
	);
}

function QuoteReplyMessage(props: { entities: TextWithEntities; chat: Peer }) {
	return (
		<ReplyBase
			multiline
			title={
				<>
					{props.chat.displayName}
					<div class={styles.quote_icon}>
						<TelegramIcon name="quote" />
					</div>
				</>
			}
		>
			<Markdown entities={props.entities}></Markdown>
		</ReplyBase>
	);
}

function DeletedReplyMessage() {
	return <ReplyBase title="Deleted Message">Deleted Message</ReplyBase>;
}

function LoadingReplyMessage() {
	return <ReplyBase title="Loading...">Loading...</ReplyBase>;
}

function MessageAdditionalInfo(props: { setWidth: (n: number) => void }) {
	const { message, dialog, isOutgoing, edited } = useMessageContext();

	const check = useMessageChecks(message, dialog);

	let divRef!: HTMLDivElement;

	createEffect(() => {
		edited();
		check();

		props.setWidth(divRef.offsetWidth);
	});

	return (
		<div ref={divRef} class={styles.message_info}>
			<Show when={edited()}>
				<div class={styles.edited}>edited</div>
			</Show>
			<Show when={isOutgoing()}>
				<div class={styles.info_check}>
					<TelegramIcon name={check() ? "check" : "checks"} />
				</div>
			</Show>
		</div>
	);
}

function ActionMessage(
	props: ComponentProps<"div"> & {
		focusable?: boolean;
		last?: boolean;
		actualLast?: boolean;
	},
) {
	const [local, rest] = splitProps(props, ["focusable", "children", "tabIndex", "last", "actualLast", "ref"]);

	return (
		<div
			{...rest}
			ref={(el) => {
				if (typeof local.ref === "function") {
					local.ref(el);
				}
			}}
			tabIndex={local.focusable ? 0 : undefined}
			classList={{
				[styles.action_message]: true,
				focusable: local.focusable,
				last: local.last,
				actual_last: local.actualLast,
			}}
		>
			<div class={styles.action_message_inner}>
				<span>{props.children}</span>
			</div>
		</div>
	);
}

function MessageAction() {
	const { text, actionType, actualLast, dialog, last } = useMessageContext();

	let divRef!: HTMLDivElement;

	onMount(() => {
		if (actualLast()) {
			console.error("last action Message mounted!!!");

			const actEl = document.activeElement as HTMLElement;

			if (actEl && actEl.classList.contains("roomTextbox")) {
				const _dialog = dialog();

				scrollIntoView(actEl, {
					behavior: "instant",
					block: "center",
				});

				setTimeout(() => {
					// if actEl is no longer the same
					if (actEl !== document.activeElement) return;

					_dialog.readHistory();
				}, 500);
			}
		}
	});

	onCleanup(() => {
		const actEl = document.activeElement as HTMLElement;

		if (
			$view.get() == "room" &&
			actEl &&
			(actEl.classList.contains(styles.action_message) || actEl.classList.contains(styles.message))
		) {
			SpatialNavigation.move("down") || SpatialNavigation.move("up");
		}
	});

	function jumpToBottom() {
		sleep(2).then(() => {
			divRef.parentElement!.querySelector<HTMLElement>(".last")?.focus();
		});
	}

	return (
		<Show when={actionType() != "history_cleared" && actionType() != "contact_joined"}>
			<ActionMessage
				ref={(el) => {
					divRef = el;
				}}
				onFocus={(e) => {
					if (actualLast()) {
						dialog().readHistory();
					}

					if (e.currentTarget == e.target) {
						scrollIntoView(e.currentTarget, {
							behavior: "instant",
							block: "center",
						});

						// setFocused(true);
					}

					setSoftkeys("tg:arrow_down", "", "tg:more");
				}}
				on:sn-navigatefailed={async (e) => {
					const direction = e.detail.direction;

					if (direction == "up") {
						await dialog().messages.loadMore();
						scrollIntoView(e.target, {
							behavior: "instant",
							block: "center",
						});
					}
				}}
				onKeyDown={(e) => {
					if (e.key == "Backspace") {
						$view.set("home");
						e.preventDefault();
						return;
					}

					if (e.key == "SoftLeft") {
						jumpToBottom();
					}

					if (e.key == "SoftRight") {
						// TODO
						// setShowOptions(true);
					}
				}}
				last={last()}
				actualLast={actualLast()}
				focusable
			>
				{text()}
			</ActionMessage>
		</Show>
	);
}

function MessageContainer(props: { children: JSXElement }) {
	const {
		dialog,
		focused,
		actualLast,
		setFocused,
		showContainerTail,
		last,
		isOutgoing,
		isSticker,
		isReply,
		message,
		rawMessage,
		mediaType,
		media,
		audioPlaying,
		setAudioPlaying,
		setAudioSpeed,
		audioSpeed,
		entities,
	} = useMessageContext();

	onMount(() => {
		if (actualLast()) {
			console.info("last Message mounted!!!");

			const actEl = document.activeElement as HTMLElement;

			if (actEl && actEl.classList.contains("roomTextbox")) {
				const _dialog = dialog();

				setTimeout(() => {
					// if actEl is no longer the same
					if (actEl !== document.activeElement) return;

					_dialog.readHistory();
				}, 500);

				const scroll = () =>
					scrollIntoView(actEl, {
						behavior: "instant",
						block: "center",
					});

				scroll();
				// do it twice i guess???
				sleep().then(scroll);
			}
		}
	});

	onCleanup(() => {
		const actEl = document.activeElement as HTMLElement;

		if (
			$view.get() == "room" &&
			actEl &&
			(actEl.classList.contains(styles.message) || actEl.classList.contains(styles.action_message))
		) {
			SpatialNavigation.move("down") || SpatialNavigation.move("up");

			sleep().then(() => {
				scrollIntoView(document.activeElement!, {
					behavior: "instant",
					block: "center",
				});
			});
		}
	});

	const [showOptions, setShowOptions] = createSignal(false);
	const [showDeleteOptions, setShowDeleteOptions] = createSignal(false);
	const [showMessageInfo, setShowMessageInfo] = createSignal(false);
	const [showMusicPlayer, setShowMusicPlayer] = createSignal(false);

	let divRef!: HTMLDivElement;

	onMount(() => {
		const cb = (msgId: number, chatId: number) => {
			const message = rawMessage();
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

	function tail() {
		const sticker = isSticker();
		const reply = isReply();
		const tail = showContainerTail();

		return sticker ? reply && tail : tail;
	}

	createEffect(() => {
		// listen for changes to text entities
		entities();

		// when focused, re-center
		if (untrack(focused)) {
			sleep().then(() => {
				scrollIntoView(divRef, {
					behavior: "instant",
					block: "center",
				});
			});
		}
	});

	return (
		<>
			<div
				ref={divRef}
				tabIndex={-1}
				onFocus={(e) => {
					if (import.meta.env.DEV) {
						// @ts-ignore
						e.currentTarget["__props__"] = message();
					}

					if (actualLast()) {
						dialog().readHistory();
					}

					if (e.currentTarget == e.target) {
						scrollIntoView(e.currentTarget, {
							behavior: "instant",
							block: "center",
						});

						setFocused(true);
					}

					const type = mediaType();

					if (type == "voice" || type == "audio") {
						setSoftkeys("tg:arrow_down", "PLAY", "tg:more");
						return;
					}

					setSoftkeys("tg:arrow_down", "INFO", "tg:more");
				}}
				onBlur={() => {
					setFocused(false);
				}}
				on:sn-enter-down={() => {
					const type = mediaType();
					if (type == "voice") {
						setAudioPlaying(true);
						SpatialNavigation.pause();
					} else if (type == "audio") {
						setShowMusicPlayer(true);
					} else {
						setShowMessageInfo(true);
					}
				}}
				on:sn-navigatefailed={async (e) => {
					const direction = e.detail.direction;

					if (direction == "up") {
						await dialog().messages.loadMore();
						scrollIntoView(e.target, {
							behavior: "instant",
							block: "center",
						});
					}
				}}
				onKeyDown={(e) => {
					if (audioPlaying()) {
						if (e.key == "Enter") {
							sleep(10).then(() => {
								setAudioPlaying(false);
							});
						}

						if (e.key == "Backspace") {
							e.preventDefault();
							setAudioPlaying(false);
						}

						if (e.key.includes("Arrow")) {
							e.preventDefault();

							switch (e.key) {
								case "ArrowUp":
									volumeUp();
									break;
								case "ArrowDown":
									volumeDown();
									break;
							}
						}

						if (e.key == "SoftLeft") {
							EE.emit("audio_rewind");
						}

						if (e.key == "SoftRight") {
							if (mediaType() == "voice") {
								setAudioSpeed((prev) => {
									if (prev == 2) return 1;
									return prev + 0.5;
								});
								setSoftkeys(null, null, (audioSpeed() == 2 ? "1" : audioSpeed() + 0.5) + "x");
							} else {
								EE.emit("audio_stop");
							}
						}

						return;
					}

					if (e.key == "Backspace") {
						$view.set("home");
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
					[styles.padTop]: showContainerTail(),
					focusable: true,
					last: last(),
					actual_last: actualLast(),
				}}
			>
				<div
					classList={{
						[styles.message_inner]: true,
						[styles.message_inner_sticker]: isSticker(),
						[styles.outgoing]: isOutgoing(),
						[styles.tail]: tail(),
					}}
				>
					{props.children}
				</div>
			</div>

			<Show when={showOptions()}>
				<Portal>
					<MessageOptions
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
								case MessageOptionsSelected.INFO:
									setShowMessageInfo(true);
									return;
								case MessageOptionsSelected.COPY:
									sessionStorage.setItem("copy", md.unparse(entities()));
									break;
								case MessageOptionsSelected.EDIT:
								case MessageOptionsSelected.REPLY:
									const edit = e == MessageOptionsSelected.EDIT;

									batch(() => {
										$editingMessage.set(null);
										$replyingMessage.set(null);

										if (edit) {
											$editingMessage.set(message());
										} else {
											$replyingMessage.set(message());
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
						onSelect={() => {
							SpatialNavigation.focus("room");
							setShowDeleteOptions(false);
						}}
					/>
				</Portal>
			</Show>
			<Show when={showMessageInfo()}>
				<Portal>
					<MessageInfo
						onClose={() => {
							setShowMessageInfo(false);
							SpatialNavigation.focus("room");
						}}
					/>
				</Portal>
			</Show>
			<Show when={showMusicPlayer()}>
				<Portal>
					<MusicPlayer
						music={media() as Audio}
						onClose={() => {
							setShowMusicPlayer(false);
							setStatusbarColor("#1c96c3");
							divRef.focus();
						}}
					></MusicPlayer>
				</Portal>
			</Show>
		</>
	);
}

export function UploadingMessageItem(props: { upload: UIMessageUploading }) {
	let divRef!: HTMLDivElement;
	let outerDivRef!: HTMLDivElement;

	const [isOverflowing, setOverflowing] = createSignal(false);

	const [focused, setFocused] = createSignal(false);

	onMount(async () => {
		outerDivRef.scrollIntoView(true);

		const isOverflowing = isOverflown(divRef);
		setOverflowing(isOverflowing);
	});

	onCleanup(() => {
		// console.log("ONCLEANUP", document.activeElement === outerDivRef);
		if (document.activeElement === outerDivRef) SpatialNavigation.move("down");
		const upload = props.upload;
		if (upload.$error.get()) {
			upload.detach();
		}
	});

	createEffect(() => {
		const upload = props.upload;

		if (focused()) {
			setSoftkeys("", upload.isText ? "" : "Cancel", "");
		}
	});

	const fileSize = useStore(() => props.upload.$fileSize);
	const progress = useStore(() => props.upload.$progress);
	const uploaded = useStore(() => props.upload.$uploaded);
	const error = useStore(() => props.upload.$error);

	return (
		<div
			ref={outerDivRef}
			tabIndex={-1}
			onKeyDown={(e) => {
				if (e.key == "Backspace") {
					$view.set("home");
					e.preventDefault();
					return;
				}

				if (e.key == "Enter") {
					const upload = props.upload;
					SpatialNavigation.move("down");
					if (upload.$error.get()) {
						upload.detach();
					} else {
						upload.detach();
						upload.cancel();
					}
				}
			}}
			onBlur={() => setFocused(false)}
			onFocus={(e) => {
				setFocused(true);

				scrollIntoView(e.currentTarget, {
					behavior: "instant",
					block: "center",
				});
			}}
			classList={{
				[styles.fake_message]: true,
				[styles.padTop]: true,
				focusable: true,
				uploading: true,
			}}
		>
			<div
				classList={{
					[styles.fake_message_inner]: true,
					[styles.outgoing]: true,
					[styles.tail]: true,
				}}
			>
				<div ref={divRef} class={styles.overflowing}>
					<Show
						when={props.upload.isText}
						fallback={
							<div class={styles.document_file}>
								<div class={styles.preview}>
									<ProgressSpinner
										class={styles.preview_spinner}
										size={32}
										progress={progress()}
										showClose
									></ProgressSpinner>
								</div>
								<div class={styles.description}>
									<div classList={{ [styles.name]: true }}>
										<Show when={!error()} fallback="An Error Occured!">
											Uploading {progress()}%
										</Show>
									</div>
									<div
										classList={{
											[styles.size]: true,
											[styles.accent_color]: true,
										}}
									>
										{niceBytes(uploaded())} / {niceBytes(fileSize())}
									</div>
								</div>
							</div>
						}
					>
						<Show when={props.upload.isReply}>
							<ReplyMessage $={props.upload.reply}></ReplyMessage>
						</Show>
						<div class={styles.text_container}>
							<div class={styles.text}>
								{<Markdown entities={joinTextWithEntities([props.upload.text])} />}
								<span class={styles.extra_width} style={{ width: "17px" }}></span>
							</div>
						</div>
					</Show>
				</div>
				<Show when={isOverflowing()}>
					<div class={styles.more_container}>
						<div class={styles.more_fade}></div>
						<div class={styles.more_button}>
							more
							<span class={styles.extra_width} style={{ width: "17px" }}></span>
						</div>
					</div>
				</Show>
				<div class={styles.message_info}>
					<div class={styles.info_check}>
						<TelegramIcon name={error() ? "sendingerror" : "sending"} />
					</div>
				</div>
			</div>
		</div>
	);
}

function ForwardedFrom(props: { noPadding?: boolean }) {
	const { message, isOutgoing } = useMessageContext();

	const forward = () => message().raw.forward;

	const peer = () => {
		const sender = forward()?.sender;
		if (sender && sender.type != "anonymous") return sender;
		return null;
	};

	const color = () => {
		const outgoing = isOutgoing();
		const sender = forward()?.sender;

		if (!outgoing && sender && sender.type != "anonymous") {
			return `var(--peer-avatar-${getColorFromPeer(sender.raw)}-bottom)`;
		}

		return "var(--bubbles-accent)";
	};

	return (
		<Show when={forward()}>
			<div
				style={{
					color: color(),
				}}
				classList={{
					[styles.forwarded_from]: true,
					[styles.noPadding]: props.noPadding,
				}}
			>
				<div>Forwarded from</div>
				<div class={styles.name}>
					<Show when={peer()}>
						<div class={styles.forwarded_avatar}>
							<PeerPhotoIcon peer={peer()!}></PeerPhotoIcon>
						</div>
					</Show>
					{forward()!.sender.displayName}
				</div>
			</div>
		</Show>
	);
}

export function MessageItemInner(props: {
	customRenderer?: ComponentProps<typeof Markdown>["customRenderer"];
	onSelect?: (media: NonNullable<MessageMedia>) => void;
}) {
	const { text, entities, reply, mediaType, showUsername, message, isReply, isSticker, isDice, isExpanded } =
		useMessageContext();

	const [isOverflowing, setOverflowing] = createSignal(false);
	const [overflowDivRef, setOverflowDivRef] = createSignal<null | HTMLDivElement>(null);

	createEffect(() => {
		text();

		untrack(() => {
			if (isExpanded()) {
				setOverflowing(false);
				return;
			}

			const divRef = overflowDivRef();
			if (divRef) {
				const isOverflowing = isOverflown(divRef);
				// isOverflowing && console.error("OVERFLOWING!!!", isOverflowing);
				setOverflowing(isOverflowing);
			}
		});
	});

	const [infoWidth, setInfoWidth] = createSignal(0);

	return (
		<>
			<Show
				when={isSticker()}
				fallback={
					<>
						<Show when={showUsername()}>
							<UsernameContainer peer={message().sender.raw}>{message().sender.displayName}</UsernameContainer>
						</Show>
						<div ref={setOverflowDivRef} class={isExpanded() ? styles.not_overflowing : styles.overflowing}>
							<Switch>
								<Match when={isReply() && reply() === undefined}>
									<LoadingReplyMessage />
								</Match>
								<Match when={reply() === 0}>
									<DeletedReplyMessage />
								</Match>
								<Match when={reply() === 1}>
									<Show when={message().getQuote()}>{(quote) => <QuoteReplyMessage {...quote()} />}</Show>
								</Match>
								<Match when={reply()}>
									<ReplyMessage $={reply() as UIMessage} />
								</Match>
							</Switch>
							<ForwardedFrom />
							<Dynamic focusable={isExpanded()} onSelect={props.onSelect} component={switchMessageMedia(mediaType())} />
							<Show when={!isSticker() && (entities().entities || entities().text)}>
								<div class={styles.text_container}>
									<div class={styles.text}>
										{<Markdown customRenderer={props.customRenderer} entities={entities()} />}
										<span class={styles.extra_width} style={{ width: infoWidth() + "px" }}></span>
									</div>
								</div>
							</Show>
						</div>
						<Show when={isOverflowing()}>
							<div class={styles.more_container}>
								<div class={styles.more_fade}></div>
								<div class={styles.more_button}>
									more
									<span class={styles.extra_width} style={{ width: infoWidth() + "px" }}></span>
								</div>
							</div>
						</Show>
					</>
				}
			>
				<div class={isReply() ? styles.message_inner_inner_sticker : undefined}>
					<Show when={showUsername()}>
						<UsernameContainer
							sticker={!isReply()}
							peer={message().sender.raw}
							after={<ForwardedFrom noPadding={!isReply()} />}
							forward={!!message().raw.forward}
						>
							{message().sender.displayName}
						</UsernameContainer>
					</Show>
					<Switch>
						<Match when={isReply() && reply() === undefined}>
							<LoadingReplyMessage />
						</Match>
						<Match when={reply() === 0}>
							<DeletedReplyMessage />
						</Match>
						<Match when={reply()}>
							<ReplyMessage $={reply() as UIMessage} />
						</Match>
					</Switch>
				</div>

				<Show when={isDice()} fallback={<StickerMedia />}>
					<DiceMedia />
				</Show>
			</Show>
			<MessageAdditionalInfo setWidth={setInfoWidth} />
		</>
	);
}

export default function MessageItem() {
	const { message, showDateSeparator } = useMessageContext();

	return (
		<>
			<Show when={showDateSeparator()}>
				{(res) => (
					<ActionMessage>
						{res() === 1
							? "YESTERDAY"
							: res() == 2
								? "TODAY"
								: message()
										.date.toLocaleDateString(navigator.language, {
											month: "long",
											day: "2-digit",
											year: "numeric",
										})
										.toUpperCase()}
					</ActionMessage>
				)}
			</Show>
			<Show
				when={message().action}
				fallback={
					<MessageContainer>
						<MessageItemInner></MessageItemInner>
					</MessageContainer>
				}
			>
				<MessageAction />
			</Show>
		</>
	);
}
