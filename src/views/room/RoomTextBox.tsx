import type UIMessage from "@/ui/UIMessage";
import * as styles from "./MessageItem.module.scss";
import * as stylesRoom from "./Room.module.scss";
import type UIDialog from "@/ui/UIDialog";
import { batch, createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from "solid-js";
import { sortDialogs, tg } from "@globals";
import { useStore } from "@nanostores/solid";
import { $editingMessage, $previousView, $replyingMessage, $sendByEnter, $view, setStatusbarColor } from "@/stores";
import AutoResizeTextbox from "@components/AutoResizeTextarea";
import {
	getColorFromPeer,
	getTextFromContentEditable,
	isSelectionAtStart,
	setSoftkeys,
	sleep,
	typeInTextbox,
	useStore as useStore_,
} from "@utils";
import SpatialNavigation from "@/lib/spatial_navigation";
import { ReplyMessage } from "./MessageItem";
import NonResizeTextarea from "@components/NonResizeTextarea";
import { md } from "@mtcute/markdown-parser";
import { Portal } from "solid-js/web";
import { VoiceRecorderWeb } from "@components/VoiceRecorder";
import { InputMedia } from "@mtcute/web";
import Options from "@components/Options";
import OptionsMenuMaxHeight from "@components/OptionsMenuMaxHeight";
import OptionsItem from "@components/OptionsItem";
import scrollIntoView from "scroll-into-view-if-needed";
import Settings from "../settings";
import InsertMenu, { InsertMenuSelected } from "./InsertMenu";
import ImageUpload from "./ImageUpload";
import LazyGifPicker from "./LazyGifPicker";
import LazyEmojiPicker from "./LazyEmojiPicker";
import { cloudphone, cloudphone_features } from "@/config";

const SN_ID_OPTIONS = "options";

const enum TextboxOptionsSelected {
	SEND,
	CANCEL,
	CHAT_INFO,
	PASTE,
	COPY,
	KAIAD,
	SETTINGS,
}

function willFocusScrollIfNeeded(e: { currentTarget: HTMLElement }) {
	scrollIntoView(e.currentTarget, {
		scrollMode: "if-needed",
		block: "nearest",
		inline: "nearest",
	});
}

function TextboxOptions(props: {
	// dialog: UIDialog;
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

	const editingMessage = useStore($editingMessage);
	const replyingMessage = useStore($replyingMessage);
	const sendByEnter = useStore($sendByEnter);

	// const uploading = useStore_(() => props.dialog.$uploading);

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
				<Show when={!sendByEnter()}>
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
				{/* <Show when={uploading().length > 0}>
					<OptionsItem
						on:sn-willfocus={(e) => {
							willFocusScrollIfNeeded(e);
						}}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {}}
					>
						Uploading ({uploading().length})
					</OptionsItem>
				</Show> */}
				<OptionsItem
					on:sn-willfocus={(e) => {
						willFocusScrollIfNeeded(e);
						Settings.preload();
					}}
					classList={{ option: true, [styles.option_item]: true }}
					tabIndex={-1}
					on:sn-enter-down={() => {
						props.onSelect(TextboxOptionsSelected.SETTINGS);
					}}
					ref={lastRef}
				>
					Settings
				</OptionsItem>
				{/* <Show when={!localStorage.getItem("NO_ADS")}>
					<OptionsItem
						on:sn-willfocus={willFocusScrollIfNeeded}
						classList={{ option: true, [styles.option_item]: true }}
						tabIndex={-1}
						on:sn-enter-down={() => {
							props.onSelect(TextboxOptionsSelected.KAIAD);
						}}
						ref={(ref) => {
							lastRef = ref;
						}}
					>
						Show Ad
					</OptionsItem>
				</Show> */}
			</OptionsMenuMaxHeight>
		</Options>
	);
}

export default function RoomTextBox(props: { message?: UIMessage; floating?: boolean; dialog: UIDialog }) {
	const [focused, setFocused] = createSignal(false);

	const [divRef, setDivRef] = createSignal<null | HTMLDivElement>(null);
	const [textboxRef, setTextBoxRef] = createSignal<null | HTMLPreElement | HTMLInputElement>(null);

	const [showOptions, setShowOptions] = createSignal(false);
	const [showEmojiPicker, setShowEmojiPicker] = createSignal(false);
	const [showGifPicker, setShowGifPicker] = createSignal(false);
	const [showInsertMenu, setShowInsertMenu] = createSignal(false);

	const [photoBlob, setPhotoBlob] = createSignal<null | Blob>(null);
	const [videoBlob, setVideoBlob] = createSignal<null | Blob>(null);

	const [text, setText] = createSignal("");

	const editingMessage = useStore($editingMessage);
	const replyingMessage = useStore($replyingMessage);
	const sendByEnter = useStore($sendByEnter);

	onMount(() => {
		// only relevant for floating textbox
		if (!props.floating) return;
		const _textboxRef = textboxRef();
		if (!_textboxRef) return;

		setTimeout(() => {
			_textboxRef.focus();
			const edit = editingMessage();
			if (edit) {
				typeInTextbox(md.unparse(edit.textWithEntities), _textboxRef);
			}
		}, 100);
	});

	const [showVoiceRecorder, setShowVoiceRecorder] = createSignal(false);

	let audioBlob: Blob;
	let audioWaveform: number[];
	let audioDuration: number;

	//#region Events

	const [isTyping, setIsTyping] = createSignal(false);

	let typingTimeout!: NodeJS.Timeout;

	createEffect(
		on(
			isTyping,
			(typing) => {
				console.log("SET TYPING", typing);
				tg.setTyping({
					peerId: props.dialog.peer,
					status: typing ? "typing" : "cancel",
				});
			},
			{ defer: true },
		),
	);

	onCleanup(() => {
		setIsTyping(false);
		tg.setTyping({
			peerId: props.dialog.peer,
			status: "cancel",
		});
	});

	const setTyping = () => {
		clearTimeout(typingTimeout);
		setIsTyping(true);

		typingTimeout = setTimeout(
			() => {
				setIsTyping(false);
			},
			1000 + Math.floor(Math.random() * 500),
		);
	};

	const interacting = createMemo(() => {
		const editing = editingMessage();
		const replying = replyingMessage();
		return editing || replying;
	});

	const divClassList = () => {
		const _focused = focused();

		if (props.floating) {
			return { [styles.floating_textbox]: true, [styles.focused]: true };
		}
		return { [styles.textarea_container]: true, [styles.focused]: _focused };
	};

	// share dom event handlers
	function onBlur() {
		setFocused(false);
	}
	function onFocus() {
		setFocused(true);
		setSoftkeys("tg:add", $sendByEnter.get() ? "Send" : "Enter", "tg:more");
		setStatusbarColor("#1c96c3");

		if (!props.floating) {
			divRef()?.scrollIntoView(true);
			const dialog = props.dialog;
			dialog.readHistory();
		}
	}
	function onInput() {
		setTyping();
		if (!props.floating) {
			const div = divRef();
			if (!div) return;

			div.scrollIntoView(true);

			sleep(0).then(() => {
				div.scrollIntoView(true);
			});
		}
	}
	function onKeyDown(e: KeyboardEvent, canUseKeyboard: boolean) {
		if (e.key == "Backspace" && canUseKeyboard) {
			if (props.floating) {
				batch(() => {
					$editingMessage.set(null);
					$replyingMessage.set(null);
				});

				SpatialNavigation.focus("room");
			} else {
				$view.set("home");
			}

			e.preventDefault();
			return;
		}

		if (e.key.includes("Arrow")) {
			e.stopImmediatePropagation();
			e.stopPropagation();

			if (e.key == "ArrowUp" && canUseKeyboard) {
				// prevents the scroll
				e.preventDefault();

				const exists = document.querySelector<HTMLElement>(
					props.dialog.$uploading.get().length
						? `.${stylesRoom.room} .focusable.uploading`
						: `.${stylesRoom.room} .focusable.actual_last`,
				);

				if (exists) {
					exists.focus();
					return;
				} else {
					SpatialNavigation.move("up");
				}
			}
		}

		if (e.key == "SoftRight") {
			setShowOptions(true);
		}

		if (e.key == "SoftLeft") {
			setShowInsertMenu(true);
		}
	}

	function markdown(str: string) {
		const trimmed = str.trim();
		try {
			return md(trimmed);
		} catch (e) {
			console.error("mtcute markdown error:", e);
		}
		return trimmed;
	}

	function focusNonFloatingTextbox() {
		return sleep(0).then(() => {
			document.querySelector<HTMLDivElement>(".roomTextbox")?.focus();
		});
	}

	function sendMessage() {
		const dialog = props.dialog;

		const replying = replyingMessage();

		const entities = markdown(text());

		if (!interacting()) {
			const upload = dialog.createUpload(entities);
			tg.sendText(dialog.peer, entities, { abortSignal: upload.abortSignal })
				.then((msg) => {
					dialog.removeUpload(upload);
					dialog.$lastMessage.set(dialog.messages.add(msg));
					sortDialogs();
				})
				.catch((e) => {
					console.error(e);
					upload.abort();
				});
		} else {
			const editing = editingMessage();

			batch(() => {
				$editingMessage.set(null);
				$replyingMessage.set(null);
			});

			if (editing) {
				tg.editMessage({
					message: editing.raw,
					text: entities,
					shouldDispatch: true,
				}).then((msg) => {
					dialog.messages.update(msg.id, msg);
				});
			} else if (replying) {
				const upload = dialog.createUpload(entities, replying);

				tg.replyText(replying.raw, entities, {
					shouldDispatch: true,
				})
					.then((msg) => {
						// eh????
						if (!msg.raw.replyTo) {
							msg.raw.replyTo = {
								_: "messageReplyHeader",
								forumTopic: false,
								quote: false,
								replyToMsgId: replying.raw.id,
								replyToScheduled: false,
							};
						}
						dialog.removeUpload(upload);
						dialog.$lastMessage.set(dialog.messages.add(msg));
						sortDialogs();
					})
					.catch((e) => {
						console.error(e);
						upload.abort();
					});

				sleep(0).then(() => {
					document.querySelector<HTMLDivElement>(".roomTextbox")?.focus();
				});
			}
		}

		resetTextbox();

		if (!replying) sleep(10).then(() => SpatialNavigation.focus("room"));
	}

	function resetTextbox(dispatch = true) {
		const textboxEl = textboxRef();

		if (textboxEl) {
			if ($sendByEnter.get()) {
				(textboxEl as HTMLInputElement).value = "";
			} else {
				textboxEl.textContent = "";
				// ignore please
				textboxEl.appendChild((<br></br>) as Node);
			}
			dispatch && textboxEl.dispatchEvent(new Event("input", { bubbles: true }));
		}
	}

	//#endregion

	async function sendFile(blob: Blob) {
		await sleep(0);
		textboxRef()?.focus();

		const replying = replyingMessage();
		const _interacting = interacting();

		batch(() => {
			$editingMessage.set(null);
			$replyingMessage.set(null);
		});

		const dialog = props.dialog;

		tg.setTyping({
			status: "upload_document",
			peerId: dialog.peer,
			progress: 0.5,
		});

		const upload = dialog.createUpload();

		upload.setFileSize(blob.size);

		const additionalProps = replying ? { replyTo: replying.id } : {};

		if (_interacting) {
			await focusNonFloatingTextbox();
		}

		tg.sendMedia(dialog.peer, InputMedia.document(blob, {}), {
			...additionalProps,
			shouldDispatch: true,
			abortSignal: upload.abortSignal,
			progressCallback(uploaded, total) {
				upload.setFileSize(total);
				upload.setUploaded(uploaded);
				const progress = Math.ceil((uploaded / total) * 100);
				upload.setProgress(progress);
			},
		})
			.then((msg) => {
				dialog.removeUpload(upload);
				dialog.$lastMessage.set(dialog.messages.add(msg));
				sortDialogs();
			})
			.catch((err) => {
				console.error("UPLOAD FILE ERROR", err);
				upload.abort();
				sleep(3000).then(() => {
					dialog.removeUpload(upload);
				});
			})
			.finally(() => {
				tg.setTyping({
					status: "cancel",
					peerId: dialog.peer,
				});
			});
	}

	async function sendAudio(blob: Blob) {
		await sleep(0);
		textboxRef()?.focus();

		const replying = replyingMessage();
		const _interacting = interacting();

		batch(() => {
			$editingMessage.set(null);
			$replyingMessage.set(null);
		});

		const dialog = props.dialog;

		tg.setTyping({
			status: "upload_document",
			peerId: dialog.peer,
			progress: 0.5,
		});

		const upload = dialog.createUpload();

		upload.setFileSize(blob.size);

		const additionalProps = replying ? { replyTo: replying.id } : {};

		if (_interacting) {
			await focusNonFloatingTextbox();
		}

		tg.sendMedia(dialog.peer, InputMedia.audio(blob, {}), {
			...additionalProps,
			shouldDispatch: true,
			abortSignal: upload.abortSignal,
			progressCallback(uploaded, total) {
				upload.setFileSize(total);
				upload.setUploaded(uploaded);
				const progress = Math.ceil((uploaded / total) * 100);
				upload.setProgress(progress);
			},
		})
			.then((msg) => {
				dialog.removeUpload(upload);
				dialog.$lastMessage.set(dialog.messages.add(msg));
				sortDialogs();
			})
			.catch((err) => {
				console.error("UPLOAD MUSIC ERROR", err);
				upload.abort();
				sleep(3000).then(() => {
					dialog.removeUpload(upload);
				});
			})
			.finally(() => {
				tg.setTyping({
					status: "cancel",
					peerId: dialog.peer,
				});
			});
	}

	return (
		<>
			<div
				style={
					!props.floating && interacting()
						? {
								display: "none",
							}
						: undefined
				}
				ref={setDivRef}
				classList={divClassList()}
			>
				<Show when={props.message}>
					{(message) => (
						<div
							style={{
								"--border": `var(--peer-avatar-${getColorFromPeer(message().sender.raw)}-bottom)`,
							}}
						>
							<ReplyMessage $={message()} />
						</div>
					)}
				</Show>
				<Show
					when={sendByEnter()}
					fallback={
						<AutoResizeTextbox
							ref={setTextBoxRef}
							placeholder="Message"
							classList={props.floating ? undefined : { focusable: true, last: true, roomTextbox: true }}
							//
							// dom events
							//
							onBlur={onBlur}
							onFocus={onFocus}
							onInput={(e) => {
								setText(getTextFromContentEditable(e.currentTarget));
								onInput();
							}}
							onKeyDown={(e) => {
								const canUseKeyboard = !getTextFromContentEditable(e.currentTarget) || isSelectionAtStart();
								onKeyDown(e, canUseKeyboard);
							}}
						/>
					}
				>
					<NonResizeTextarea
						ref={setTextBoxRef}
						placeholder="Message"
						classList={props.floating ? undefined : { focusable: true, last: true, roomTextbox: true }}
						//
						// dom events
						//
						onBlur={onBlur}
						onFocus={onFocus}
						onInput={(e) => {
							setText(e.currentTarget.value);
							onInput();
						}}
						onKeyDown={(e) => {
							const canUseKeyboard = !e.currentTarget.value || e.currentTarget.selectionStart === 0;
							if (e.key == "Enter" && e.currentTarget.value.trim()) {
								sendMessage();
							}
							onKeyDown(e, canUseKeyboard);
						}}
					/>
				</Show>
			</div>
			<Show when={photoBlob()}>
				<Portal>
					<ImageUpload
						src={photoBlob()!}
						onSend={async (e) => {
							const blob = photoBlob()!;
							setPhotoBlob(null);
							await sleep(0);
							textboxRef()?.focus();

							if (e === false) return;

							const replying = replyingMessage();
							const _interacting = interacting();

							batch(() => {
								$editingMessage.set(null);
								$replyingMessage.set(null);
							});

							const dialog = props.dialog;

							tg.setTyping({
								status: "upload_photo",
								peerId: dialog.peer,
								progress: 0.5,
							});

							const upload = dialog.createUpload();

							upload.setFileSize(blob.size);

							const additionalProps = replying ? { replyTo: replying.id } : {};

							if (_interacting) {
								await focusNonFloatingTextbox();
							}

							tg.sendMedia(
								dialog.peer,
								InputMedia.photo(
									blob,
									e
										? {
												caption: e,
											}
										: {},
								),
								{
									...additionalProps,
									shouldDispatch: true,
									abortSignal: upload.abortSignal,
									progressCallback(uploaded, total) {
										upload.setFileSize(total);
										upload.setUploaded(uploaded);
										const progress = Math.ceil((uploaded / total) * 100);
										upload.setProgress(progress);
									},
								},
							)
								.then((msg) => {
									dialog.removeUpload(upload);
									dialog.$lastMessage.set(dialog.messages.add(msg));
									sortDialogs();
								})
								.catch((err) => {
									console.error("UPLOAD PHOTO ERROR", err);
									upload.abort();
									sleep(3000).then(() => {
										dialog.removeUpload(upload);
									});
								})
								.finally(() => {
									tg.setTyping({
										status: "cancel",
										peerId: dialog.peer,
									});
								});
						}}
					></ImageUpload>
				</Portal>
			</Show>
			<Show when={videoBlob()}>
				<Portal>
					<ImageUpload
						src={videoBlob()!}
						isVideo
						onSend={async (e) => {
							const originalBlob = videoBlob()! as File;

							const blob = originalBlob.type.includes("3gp")
								? new File([originalBlob], originalBlob.name ? originalBlob.name.slice(0, -4) + ".mp4" : "video.mp4", {
										type: "video/mp4",
									})
								: originalBlob;

							setVideoBlob(null);
							await sleep(0);
							textboxRef()?.focus();

							if (e === false) return;

							const replying = replyingMessage();
							const _interacting = interacting();

							batch(() => {
								$editingMessage.set(null);
								$replyingMessage.set(null);
							});

							const dialog = props.dialog;

							// console.error(e);

							const upload = dialog.createUpload();

							console.log("UPLOAD", upload);

							upload.setFileSize(blob.size);

							// temp_setUploadingFiles((e) => e.concat(upload));

							const additionalProps = replying ? { replyTo: replying.id } : {};

							if (_interacting) {
								await focusNonFloatingTextbox();
							}

							tg.sendMedia(
								dialog.peer,
								InputMedia.video(
									blob,
									e
										? {
												caption: e,
												supportsStreaming: true,
											}
										: { supportsStreaming: true },
								),
								{
									...additionalProps,
									shouldDispatch: true,
									abortSignal: upload.abortSignal,
									progressCallback(uploaded, total) {
										upload.setFileSize(total);
										upload.setUploaded(uploaded);
										const progress = Math.ceil((uploaded / total) * 100);
										upload.setProgress(progress);
										tg.setTyping({
											peerId: dialog.peer,
											status: "upload_video",
											// this doesn't seem to actually be useful?
											// seems like it should always be a number less than 1
											progress: progress / 100,
										});
									},
								},
							)
								.then((msg) => {
									dialog.removeUpload(upload);
									dialog.$lastMessage.set(dialog.messages.add(msg));
									sortDialogs();
								})
								.catch((e) => {
									console.error("tg.sendMedia ERROR:", e);
									upload.abort();
									sleep(3000).then(() => {
										dialog.removeUpload(upload);
									});
								})
								.finally(() => {
									tg.setTyping({
										peerId: dialog.peer,
										status: "cancel",
									});
								});
						}}
					></ImageUpload>
				</Portal>
			</Show>
			<Show when={showInsertMenu()}>
				<Portal>
					<InsertMenu
						onSelect={async (e) => {
							const dialog = props.dialog;

							await sleep(2);
							setShowInsertMenu(false);

							switch (e) {
								case InsertMenuSelected.EMOJI:
									setShowEmojiPicker(true);
									return;
								case InsertMenuSelected.GIF:
									setShowGifPicker(true);
									return;
								case InsertMenuSelected.PHOTO: {
									const input = document.createElement("input");

									input.type = "file";
									input.accept = "image/*";

									input.onchange = () => {
										const file = input.files![0];

										if (cloudphone) {
											// validate ourselves
											if (!cloudphone_features.ImageUpload) {
												// do nothing if file is not image
												if (!file.type.startsWith("image/")) {
													console.warn("Selected file is not image!");
													return;
												}
											}
										}

										setPhotoBlob(file);
									};

									input.click();

									break;
								}
								case InsertMenuSelected.VIDEO: {
									const input = document.createElement("input");

									input.type = "file";
									input.accept = "video/*";

									input.onchange = () => {
										const file = input.files![0];

										if (cloudphone) {
											// validate ourselves
											if (!cloudphone_features.VideoUpload) {
												// do nothing if file is not video
												if (!file.type.startsWith("video/")) {
													console.warn("Selected file is not video!");
													return;
												}
											}
										}

										setVideoBlob(file);
									};

									input.click();

									break;
								}

								case InsertMenuSelected.FILE: {
									const input = document.createElement("input");

									input.type = "file";

									input.onchange = () => {
										const file = input.files![0];

										if (file.type.startsWith("audio")) {
											sendAudio(file);
											return;
										}

										sendFile(file);
									};

									input.click();
									break;
								}

								case InsertMenuSelected.AUDIO: {
									const input = document.createElement("input");

									input.type = "file";

									if (!cloudphone) {
										input.accept = "audio/*";
									}

									input.onchange = () => {
										const file = input.files![0];
										sendAudio(file);
									};

									input.click();
									break;
								}

								case InsertMenuSelected.VOICE:
									resetTextbox(false);
									setText("");

									tg.setTyping({
										peerId: dialog.peer,
										status: "record_voice",
									});
									setShowVoiceRecorder(true);
									return;
							}

							textboxRef()?.focus();
						}}
					/>
				</Portal>
			</Show>
			<Show when={showEmojiPicker()}>
				<Portal>
					<LazyEmojiPicker
						onSelect={async (e) => {
							setShowEmojiPicker(false);
							await sleep(100);
							textboxRef()?.focus();
							await sleep(1);
							if (e) {
								typeInTextbox(e, textboxRef()!);
							}
						}}
					/>
				</Portal>
			</Show>
			<Show when={showGifPicker()}>
				<Portal>
					<LazyGifPicker
						onSelect={async (e) => {
							setShowGifPicker(false);
							await sleep(100);
							textboxRef()?.focus();
							await sleep(1);
							if (e) {
								const dialog = props.dialog;

								const _interacting = interacting();
								const replying = replyingMessage();

								batch(() => {
									$editingMessage.set(null);
									$replyingMessage.set(null);
								});

								if (_interacting) {
									await focusNonFloatingTextbox();
								}

								const additionalProps = replying ? { replyTo: replying.id } : {};

								tg.sendMedia(dialog.peer, e.inputMedia, {
									...additionalProps,
									shouldDispatch: true,
								});
							}
						}}
					/>
				</Portal>
			</Show>
			<Show when={showVoiceRecorder()}>
				<Portal>
					<VoiceRecorderWeb
						setAudioBlob={(blob, waveform, duration) => {
							audioBlob = blob;
							audioWaveform = waveform;
							audioDuration = duration;
						}}
						onComplete={async (send) => {
							const dialog = props.dialog;
							setShowVoiceRecorder(false);
							await tg.setTyping({
								peerId: dialog.peer,
								status: "cancel",
							});
							await sleep(5);

							textboxRef()?.focus();

							if (send) {
								await tg.setTyping({
									peerId: dialog.peer,
									status: "upload_voice",
									progress: 0.5,
								});

								const _interacting = interacting();
								const replying = replyingMessage();

								batch(() => {
									$editingMessage.set(null);
									$replyingMessage.set(null);
								});

								if (_interacting) {
									await focusNonFloatingTextbox();
								} else {
									sleep(0).then(() => {
										textboxRef()?.focus();
									});
								}

								const upload = dialog.createUpload();
								upload.setFileSize(audioBlob.size);

								if (replying) {
									tg.replyMedia(
										replying.raw,
										InputMedia.voice(audioBlob, {
											duration: audioDuration,
											waveform: audioWaveform,
										}),
										{
											abortSignal: upload.abortSignal,
											progressCallback(uploaded, total) {
												upload.setFileSize(total);
												upload.setUploaded(uploaded);
												const progress = Math.ceil((uploaded / total) * 100);
												upload.setProgress(progress);
											},
										},
									)
										.then((msg) => {
											dialog.$lastMessage.set(dialog.messages.add(msg));
											sortDialogs();
											upload.detach();
										})
										.finally(() => {
											tg.setTyping({
												peerId: dialog.peer,
												status: "cancel",
											});
										});

									return;
								}

								tg.sendMedia(
									dialog.peer,
									InputMedia.voice(audioBlob, {
										duration: audioDuration,
										waveform: audioWaveform,
									}),
									{
										abortSignal: upload.abortSignal,
										progressCallback(uploaded, total) {
											upload.setFileSize(total);
											upload.setUploaded(uploaded);
											const progress = Math.ceil((uploaded / total) * 100);
											upload.setProgress(progress);
										},
									},
								)
									.then((msg) => {
										dialog.$lastMessage.set(dialog.messages.add(msg));
										sortDialogs();
										upload.detach();
									})
									.finally(() => {
										tg.setTyping({
											peerId: dialog.peer,
											status: "cancel",
										});
									});
							}
						}}
					/>
				</Portal>
			</Show>
			<Show when={showOptions()}>
				<Portal>
					<TextboxOptions
						// dialog={props.dialog}
						canSend={!!text().trim()}
						onSelect={async (e) => {
							await sleep(100);

							setShowOptions(false);

							if (e == TextboxOptionsSelected.SETTINGS) {
								batch(() => {
									$previousView.set("room");
									$view.set("settings");
								});

								return;
							}

							if (!interacting()) {
								// TODO: don't focus if show info
								SpatialNavigation.focus("room");
							}

							if (e === null) {
								textboxRef()?.focus();
								return;
							}

							switch (e) {
								case TextboxOptionsSelected.PASTE: {
									const text = sessionStorage.getItem("copy");
									sessionStorage.removeItem("copy");
									if (text) typeInTextbox(text, textboxRef()!);
									break;
								}

								case TextboxOptionsSelected.COPY: {
									sessionStorage.setItem("copy", text());
									break;
								}

								case TextboxOptionsSelected.KAIAD: {
									// showKaiAd();
									break;
								}

								case TextboxOptionsSelected.SEND:
									sendMessage();
									break;

								case TextboxOptionsSelected.CANCEL:
									batch(() => {
										$editingMessage.set(null);
										$replyingMessage.set(null);
									});

									SpatialNavigation.focus("room");

									break;
							}
						}}
					/>
				</Portal>
			</Show>
		</>
	);
}
