import { Chat, InputMedia, Message, tl, User } from "@mtcute/core";
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
	Suspense,
} from "solid-js";
import {
	EE,
	UIDialog,
	UIMessage,
	client,
	currentView,
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
	uiDialog,
	setMessageInfo,
	toaster,
	showKaiAd,
} from "@signals";
import ChatPhotoIcon from "./components/ChatPhoto";
import {
	getColorFromPeer,
	getTextFromContentEditable,
	isSelectionAtStart,
	RawPeer,
	sleep,
	typeInTextbox,
	useMessageChecks,
	useStore,
} from "@/lib/utils";
import Markdown, { ModifyString } from "./components/Markdown";
import TelegramIcon from "./components/TelegramIcon";
import AutoResizeTextbox from "./components/AutoResizeTextarea";
import scrollIntoView from "scroll-into-view-if-needed";
import SpatialNavigation from "@/lib/spatial_navigation";
import Options from "./components/Options";
import OptionsItem from "./components/OptionsItem";
import { Dynamic, Portal } from "solid-js/web";
import OptionsMenuMaxHeight from "./components/OptionsMenuMaxHeight";
import { md } from "@mtcute/markdown-parser";
import { debounce } from "lodash-es";
import EmojiPicker from "./components/EmojiPicker";
import { timeStamp } from "./Home";
import InsertMenu, { InsertMenuSelected } from "./components/InsertMenu";
import { MessageProvider, switchMessageMedia, useMessageContext } from "./Messages";
import { VoiceRecorderWeb } from "./components/VoiceRecorder";
import { volumeUp, volumeDown } from "@/lib/volumeManager";
import ImageUpload from "./ImageUpload";
import { temp_setUploadingFiles, TempFileUploading } from "./components/TemporaryUploadingIndicator";

function getMembersCount(chat: Chat) {
	if ((chat.peer as tl.RawChannel).participantsCount) {
		return (chat.peer as tl.RawChannel).participantsCount;
	}
	return null;
}

const isOverflown = ({ clientHeight, scrollHeight }: HTMLElement) => {
	return scrollHeight - 8 > clientHeight;
};

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
	CHAT_INFO,
	PASTE,
	COPY,
	KAIAD,
}

function TextboxOptions(props: { canSend: boolean; onSelect: (e: TextboxOptionsSelected | null) => void }) {
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
				<Show when={sessionStorage.getItem("copy")}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							props.onSelect(TextboxOptionsSelected.PASTE);
						}}
					>
						Paste
					</OptionsItem>
				</Show>
				<Show when={props.canSend}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							props.onSelect(TextboxOptionsSelected.COPY);
						}}
					>
						Copy
					</OptionsItem>
				</Show>
				<OptionsItem
					on:sn-willfocus={willFocusScrollIfNeeded}
					classList={{ option: true, [styles.option_item]: true }}
					tabIndex={-1}
					on:sn-enter-down={() => {
						props.onSelect(TextboxOptionsSelected.KAIAD);
					}}
					ref={lastRef}
				>
					Show Ad
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

function MessageOptions(props: { onSelect: (e: MessageOptionsSelected | null) => void }) {
	const { dialog, message, rawMessage, entities } = useMessageContext();

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
					on:sn-enter-down={() => {
						props.onSelect(MessageOptionsSelected.INFO);
					}}
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

function DeleteOptions(props: { onSelect: () => void }) {
	const { dialog, rawMessage } = useMessageContext();

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
										refreshDialogsByPeer([dialog().$.chat.inputPeer]);
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
							sleep(2).then(async () => {
								const message = rawMessage();

								await tg
									.deleteMessages([message], {
										revoke: true,
									})
									.then(() => {
										dialog().messages.delete(message.id);
										refreshDialogsByPeer([dialog().id]);
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

function MessageContainer(props: { children: JSXElement }) {
	const {
		dialog,
		actualLast,
		setFocused,
		showContainerTail,
		last,
		isOutgoing,
		isSticker,
		isReply,
		showUsername,
		message,
		rawMessage,
		mediaType,
		audioPlaying,
		setAudioPlaying,
		setAudioSpeed,
		audioSpeed,
		entities,
	} = useMessageContext();

	onMount(() => {
		if (actualLast()) {
			console.error("last Message mounted!!!");

			const actEl = document.activeElement as HTMLElement;

			if (actEl && actEl.classList.contains("roomTextbox")) {
				refreshFocusables();

				const _dialog = dialog();

				setTimeout(() => {
					// if actEl is no longer the same
					if (actEl !== document.activeElement) return;

					_dialog.readHistory();
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

	return (
		<>
			<div
				ref={divRef}
				tabIndex={-1}
				onFocus={(e) => {
					if (actualLast()) {
						dialog().readHistory();
					}

					if (e.currentTarget == e.target) {
						scrollIntoView(e.currentTarget, {
							behavior: "instant",
							block: "center",
							inline: "center",
						});
						setFocused(true);
					}

					if (mediaType() == "voice" || mediaType() == "audio") {
						setSoftkeys("tg:arrow_down", "PLAY", "tg:more");
						return;
					}

					setSoftkeys("tg:arrow_down", "INFO", "tg:more");
				}}
				onBlur={() => {
					setFocused(false);
				}}
				on:sn-enter-down={() => {
					if (mediaType() == "audio" || mediaType() == "voice") {
						setAudioPlaying(true);
						SpatialNavigation.pause();
					} else {
						setMessageInfo(message());
					}
				}}
				on:sn-navigatefailed={async (e) => {
					const direction = e.detail.direction;

					if (direction == "up") {
						await dialog().messages.loadMore();
						scrollIntoView(e.target, {
							behavior: "instant",
							block: "center",
							inline: "center",
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
					[styles.padTop]: showContainerTail(),
					focusable: true,
					last: last(),
				}}
			>
				<div
					classList={{
						[styles.message_inner]: true,
						[styles.outgoing]: isOutgoing(),
						[styles.tail]: showContainerTail(),
						[styles.isSticker]: isSticker(),
						[styles.isReply]: isReply(),
						[styles.showUsername]: showUsername(),
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
									SpatialNavigation.focus("room");
									setMessageInfo(message());
									return;
								case MessageOptionsSelected.COPY:
									sessionStorage.setItem("copy", md.unparse(entities()));
									break;
								case MessageOptionsSelected.EDIT:
								case MessageOptionsSelected.REPLY:
									const edit = e == MessageOptionsSelected.EDIT;

									batch(() => {
										setEditingMessage(null);
										setReplyingMessage(null);

										if (edit) {
											setEditingMessage(message());
										} else {
											setReplyingMessage(message());
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

export function UsernameContainer(props: { children: JSXElement; peer: RawPeer }) {
	return (
		<div class={styles.username}>
			<div class={styles.username_inner}>
				<span style={{ color: `var(--peer-avatar-${getColorFromPeer(props.peer)}-bottom)` }}>{props.children}</span>
			</div>
		</div>
	);
}

function MessageAdditionalInfo(props: { setWidth: (n: number) => void }) {
	const { message, dialog, isOutgoing } = useMessageContext();

	const edited = useStore(() => message().editDate);

	const check = useMessageChecks(message, dialog);

	let divRef!: HTMLDivElement;

	createEffect(() => {
		edited();
		check();

		props.setWidth(divRef.offsetWidth);
	});

	return (
		<div ref={divRef} class={styles.message_info}>
			<Show when={edited() && !message().$.hideEditMark}>
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

// wtf typescript????
function MessageAction() {
	const { text, actionType } = useMessageContext();

	return (
		<Show when={actionType() != "history_cleared" && actionType() != "contact_joined"}>
			<ActionMessage>{text()}</ActionMessage>
		</Show>
	);
}

function MessageItem(props: { $: UIMessage; before?: UIMessage; dialog: UIDialog; last: boolean }) {
	const { text, entities, reply, mediaType, showUsername, showDateSeparator } = useMessageContext();

	const [isOverflowing, setOverflowing] = createSignal(false);

	let textWrapRef!: HTMLDivElement;

	createEffect(() => {
		text();
		textWrapRef && setOverflowing(isOverflown(textWrapRef));
	});

	const [infoWidth, setInfoWidth] = createSignal(0);

	return (
		<>
			<Show when={showDateSeparator()}>
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
					<MessageContainer>
						<Show when={showUsername()}>
							<UsernameContainer peer={(props.$.sender as User).raw}>{props.$.sender.displayName}</UsernameContainer>
						</Show>
						<Switch>
							<Match when={props.$.isReply() && reply() === undefined}>
								<LoadingReplyMessage />
							</Match>
							<Match when={reply() === 0}>
								<DeletedReplyMessage />
							</Match>
							<Match when={reply()}>
								<ReplyMessage $={reply() as UIMessage} />
							</Match>
						</Switch>
						<Dynamic component={switchMessageMedia(mediaType())} />
						<Show when={!props.$.isSticker && (entities().entities || entities().text)}>
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
												<span class={styles.extra_width} style={{ width: infoWidth() + "px" }}></span>
											</div>
										</div>
									</Show>
								</div>
							</div>
							<MessageAdditionalInfo setWidth={setInfoWidth} />
						</Show>
					</MessageContainer>
				}
			>
				<MessageAction />
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

	onPhotoSelect: (e: Blob) => void;
	onVideoSelect: (e: Blob) => void;

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

	const [showVoiceRecorder, setShowVoiceRecorder] = createSignal(false);

	let audioBlob: Blob;
	let audioWaveform: number[];
	let audioDuration: number;

	return (
		<>
			<Show when={showVoiceRecorder()}>
				<Portal>
					<VoiceRecorderWeb
						setAudioBlob={(blob, waveform, duration) => {
							audioBlob = blob;
							audioWaveform = waveform;
							audioDuration = duration;
						}}
						onComplete={async (send) => {
							setShowVoiceRecorder(false);
							await sleep(5);

							props.textboxRef.focus();
							if (send) {
								const dialog = props.dialog;
								tg.sendMedia(
									props.dialog.$.chat,
									InputMedia.voice(audioBlob, {
										duration: audioDuration,
										waveform: audioWaveform,
									})
								).then((msg) => {
									dialog.lastMessage.set(dialog.messages.add(msg));
								});
							}
						}}
					/>
				</Portal>
			</Show>
			<Show when={showOptions()}>
				<Portal>
					<TextboxOptions
						canSend={!!text()}
						onSelect={async (e) => {
							await sleep(100);

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
								case TextboxOptionsSelected.PASTE: {
									const text = sessionStorage.getItem("copy");
									sessionStorage.removeItem("copy");
									if (text) typeInTextbox(text, props.textboxRef);
									break;
								}

								case TextboxOptionsSelected.COPY: {
									sessionStorage.setItem("copy", text());
									break;
								}

								case TextboxOptionsSelected.KAIAD: {
									showKaiAd();
									break;
								}

								case TextboxOptionsSelected.SEND:
									if (!interacting()) {
										tg.sendText(props.dialog.$.chat, md(text()), {}).then((msg) => {
											dialog.lastMessage.set(dialog.messages.add(msg));
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
											tg.replyText(replying.$, md(text()), { shouldDispatch: true }).then((msg) => {
												dialog.lastMessage.set(dialog.messages.add(msg));
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
							await sleep(100);
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
								case InsertMenuSelected.PHOTO: {
									const input = document.createElement("input");

									input.type = "file";
									input.accept = "image/*";

									input.onchange = () => {
										props.onPhotoSelect(input.files![0]);
									};

									input.click();

									break;
								}
								case InsertMenuSelected.VIDEO: {
									const input = document.createElement("input");

									input.type = "file";
									input.accept = "video/*";

									input.onchange = () => {
										props.onVideoSelect(input.files![0]);
									};

									input.click();

									break;
								}
								case InsertMenuSelected.VOICE:
									props.textboxRef.textContent = "";
									// ignore please
									props.textboxRef.appendChild((<br></br>) as Node);
									props.textboxRef.dispatchEvent(new Event("input", { bubbles: true }));

									setShowVoiceRecorder(true);
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

	const [photoBlob, setPhotoBlob] = createSignal<null | Blob>(null);
	const [videoBlob, setVideoBlob] = createSignal<null | Blob>(null);

	const tg = client()!;

	const [text, setText] = createSignal("");

	let textboxRef!: HTMLPreElement;

	const debounced_sendTyping = debounce(() => {
		console.log("SENDING TYPING STATE");
		tg.sendTyping(props.dialog.$.chat);
	}, 2000);

	const interacting = createMemo(() => {
		const editing = editingMessage();
		const replying = replyingMessage();
		return editing || replying;
	});

	return (
		<>
			<Show when={photoBlob()}>
				<Portal>
					<ImageUpload
						image={photoBlob()!}
						onSend={async (e) => {
							const blob = photoBlob()!;
							setPhotoBlob(null);
							sleep(0);
							textboxRef.focus();

							if (e === false) return;

							const dialog = props.dialog;

							console.error(e);

							tg.sendMedia(
								dialog.$.chat,
								InputMedia.photo(
									blob,
									e
										? {
												caption: e,
										  }
										: {}
								)
							).then((msg) => {
								dialog.lastMessage.set(dialog.messages.add(msg));
							});
						}}
					></ImageUpload>
				</Portal>
			</Show>
			<Show when={videoBlob()}>
				<Portal>
					<ImageUpload
						image={videoBlob()!}
						isVideo
						onSend={async (e) => {
							const blob = videoBlob()!;
							setVideoBlob(null);
							sleep(0);
							textboxRef.focus();

							if (e === false) return;

							const dialog = props.dialog;

							console.error(e);

							const upload = new TempFileUploading();

							temp_setUploadingFiles((e) => e.concat(upload));

							tg.sendMedia(
								dialog.$.chat,
								InputMedia.video(
									blob,
									e
										? {
												caption: e,
										  }
										: {}
								),
								{
									progressCallback(uploaded, total) {
										upload.progress.set(Math.ceil((uploaded / total) * 100));
									},
								}
							).then((msg) => {
								dialog.lastMessage.set(dialog.messages.add(msg));
							});
						}}
					></ImageUpload>
				</Portal>
			</Show>
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
					onKeyDown={(e) => {
						const canUseKeyboard = !getTextFromContentEditable(e.currentTarget) || isSelectionAtStart();

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
				onPhotoSelect={setPhotoBlob}
				onVideoSelect={setVideoBlob}
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
							<MessageProvider
								last={index() == messages().length - 1}
								dialog={props.dialog}
								$={e}
								before={messages()[index() - 1]}
							>
								<MessageItem
									last={index() == messages().length - 1}
									dialog={props.dialog}
									$={e}
									before={messages()[index() - 1]}
								/>
							</MessageProvider>
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

	const [photoBlob, setPhotoBlob] = createSignal<null | Blob>(null);
	const [videoBlob, setVideoBlob] = createSignal<null | Blob>(null);

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
			<Show when={photoBlob()}>
				<Portal>
					<ImageUpload
						image={photoBlob()!}
						onSend={async (e) => {
							const blob = photoBlob()!;
							setPhotoBlob(null);
							sleep(0);
							textboxRef.focus();

							if (e === false) return;

							const dialog = props.dialog;

							console.error(e);

							tg.sendMedia(
								dialog.$.chat,
								InputMedia.photo(
									blob,
									e
										? {
												caption: e,
										  }
										: {}
								)
							).then((msg) => {
								dialog.lastMessage.set(dialog.messages.add(msg));
							});
						}}
					></ImageUpload>
				</Portal>
			</Show>
			<Show when={videoBlob()}>
				<Portal>
					<ImageUpload
						image={videoBlob()!}
						isVideo
						onSend={async (e) => {
							const blob = videoBlob()!;
							setVideoBlob(null);
							sleep(0);
							textboxRef.focus();

							if (e === false) return;

							const dialog = props.dialog;

							console.error(e);

							const upload = new TempFileUploading();

							temp_setUploadingFiles((e) => e.concat(upload));

							tg.sendMedia(
								dialog.$.chat,
								InputMedia.video(
									blob,
									e
										? {
												caption: e,
										  }
										: {}
								),
								{
									progressCallback(uploaded, total) {
										upload.progress.set(Math.ceil((uploaded / total) * 100));
									},
								}
							).then((msg) => {
								dialog.lastMessage.set(dialog.messages.add(msg));
							});
						}}
					></ImageUpload>
				</Portal>
			</Show>
			<div classList={{ [styles.floating_textbox]: true, [styles.focused]: true }}>
				<div
					style={{
						"--border": `var(--peer-avatar-${getColorFromPeer((props.message.sender as User).raw)}-bottom)`,
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
						const canUseKeyboard = !getTextFromContentEditable(e.currentTarget) || isSelectionAtStart();

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
				onPhotoSelect={setPhotoBlob}
				showOptions={showOptions()}
				setShowOptions={setShowOptions}
				showEmojiPicker={showEmojiPicker()}
				setShowEmojiPicker={setShowEmojiPicker}
				showInsertMenu={showInsertMenu()}
				setShowInsertMenu={setShowInsertMenu}
				dialog={props.dialog}
				textboxRef={textboxRef}
				onVideoSelect={setVideoBlob}
			/>
		</>
	);
}

export default function Room(props: { hidden: boolean }) {
	const interacting = createMemo(() => {
		const editing = editingMessage();
		const replying = replyingMessage();
		return editing || replying;
	});

	createEffect(() => {
		const tg = client();
		if (!tg) return;

		const _room = room();

		if (_room) {
			tg.openChat(_room);

			// console.log(dialogsJar.get(_room.id), _room.id, _room);

			onCleanup(() => {
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
												<Show when={!chat().isSupport && chat().peer._ == "user" && !(chat().peer as tl.RawUser).bot}>
													<UserStatusIndicator userId={chat().peer.id} />
												</Show>
											}
										>
											{getMembersCount(chat())} {chat().chatType == "channel" ? "Subscribers" : "Members"}
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
								<Show when={interacting()}>{(msg) => <FloatingTextbox dialog={dialog()} message={msg()} />}</Show>
							)}
						</Show>
					}
					mainClass={styles.room_wrap}
				>
					<Show when={uiDialog()}>{(dialog) => <Messages dialog={dialog()} />}</Show>
				</Content>
			)}
		</Show>
	);
}
