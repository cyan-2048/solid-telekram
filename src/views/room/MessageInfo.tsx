import * as styles from "./MessageItem.module.scss";
import Content from "@components/Content";
import { MessageItemInner, MessageProvider, today, toMidnight, useMessageContext } from "./MessageItem";
import {
	batch,
	type ComponentProps,
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	type JSXElement,
	lazy,
	onCleanup,
	onMount,
	Show,
	untrack,
} from "solid-js";
import SpatialNavigation from "@/lib/spatial_navigation";
import { downloadToFile, isToday, mediaFilename, setSoftkeys, sleep, toaster } from "@utils";
import scrollIntoView from "scroll-into-view-if-needed";
import { Wallpaper } from "./Room";
import Separator from "../components/Separator";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import type UIDialog from "@/ui/UIDialog";
import type UIMessage from "@/ui/UIMessage";
import { Dynamic, Portal } from "solid-js/web";
import type { tl, Video } from "@mtcute/core";
import { cloudphone, cloudphone_features } from "@/config";
import once from "lodash-es/once";

import { SPOILER_CLASS, SPOILER_TOGGLE } from "../components/Markdown";
import type { Photo } from "@mtcute/core";
import ImageViewer from "./ImageViewer";
import { $room, $view, setStatusbarColor } from "@/stores";
import Options from "../components/Options";
import OptionsItem from "../components/OptionsItem";
import DownloadPrompt from "./DownloadPrompt";
import { downloadFile } from "@/lib/storage";
import VideoPlayer from "./VideoPlayer";
import { parseTelegramLink, type TelegramDeepLink } from "@/lib/deeplinks";
import { dialogsJar, sortDialogs, tg } from "@globals";
import { unwrap } from "solid-js/store";

const ProxySettings = lazy(() => import("../settings/ProxySettings"));

function tryURL(text: string) {
	try {
		return new URL(text);
	} catch {}
	return null;
}

function parseURL(text: string) {
	return tryURL(text) || tryURL("https://" + text);
}

function formatDate($: Date) {
	const _today = today();

	const __today = _today;

	let date = "";

	if (isToday($, __today)) {
		date = "Today";
	} else if (differenceInCalendarDays(_today, toMidnight($)) === 1) {
		date = "Yesterday";
	} else {
		date = $.toLocaleDateString(navigator.language);
	}

	return (
		date +
		", " +
		$.toLocaleTimeString(navigator.language, {
			hour: "numeric",
			minute: "numeric",
		})
	);
}

type ProxySettingsProps = ComponentProps<typeof ProxySettings>;
type InitialProxyURL = ProxySettingsProps["initialMtproto"] | ProxySettingsProps["initialSocks"];

// let __viewRef: HTMLDivElement | null = null;

function FocusableSpoiler(props: { children: JSXElement }) {
	// onCleanup(() => {
	// 	__viewRef?.focus();
	// });

	const [toggle, setToggle] = createSignal(false);

	return (
		<span
			classList={{
				focusable: true,
				[SPOILER_CLASS]: true,
				[SPOILER_TOGGLE]: toggle(),
			}}
			tabIndex={-1}
			on:sn-enter-down={() => {
				setToggle((e) => !e);
			}}
			on:sn-willfocus={() => {
				setSoftkeys("", "TOGGLE", "");
			}}
		>
			{props.children}
		</span>
	);
}

function FocusableLink(props: {
	children: JSXElement;
	url: null | URL;
	onDeepLink: (deeplink: TelegramDeepLink, url: URL) => void;
}) {
	const [showProxySettings, setShowProxySettings] = createSignal(false);

	let spanRef!: HTMLSpanElement;

	// onCleanup(() => {
	// 	__viewRef?.focus();
	// });

	let isSocks: boolean | null = null;
	let initial: InitialProxyURL = null;

	return (
		<>
			<span
				ref={spanRef}
				on:sn-focused={() => {
					setSoftkeys("", "OPEN", "");
				}}
				on:sn-enter-up={(e) => {
					const url = props.url;

					// toaster("HREF!!! " + url?.href);

					if (!url) {
						toaster("Invalid URL!");
						return;
					}

					const deeplink = parseTelegramLink(url);

					if (deeplink.type != "unknown") {
						// proxy is unavailable on CloudPhone
						if (!cloudphone) {
							isSocks = null;

							const searchParams = url.searchParams;

							const port = searchParams.get("port") || "";
							const server = searchParams.get("server") || "";

							initial = null;

							if (url.pathname == "/proxy" || url.host == "proxy") {
								initial = {
									host: server,
									port: port,
									secret: searchParams.get("secret") || "",
								};
								isSocks = false;
							} else if (url.pathname == "/socks" || url.host == "socks") {
								initial = {
									host: server,
									port: port,
									password: searchParams.get("pass") || "",
									user: searchParams.get("user") || "",
								};
								isSocks = true;
							}

							if (initial) {
								setShowProxySettings(true);
								return;
							}
						}

						props.onDeepLink(deeplink, url);
					} else {
						window.open(url, "_blank");
					}
				}}
				tabIndex={-1}
				class="focusable"
			>
				{props.children}
			</span>
			<Show when={showProxySettings()}>
				<Portal>
					<ProxySettings
						onCancel={() => {
							spanRef.focus();
							setShowProxySettings(false);
						}}
						initialMtproto={isSocks ? null : initial}
						initialSocks={isSocks ? initial : null}
					></ProxySettings>
				</Portal>
			</Show>
		</>
	);
}

function MessageInfoProviderInner(props: { children: JSXElement }) {
	const { setFocused } = useMessageContext();

	setFocused(true);

	return <>{props.children}</>;
}

function MessageInfoProvider(props: { $: UIMessage; dialog: UIDialog; children: JSXElement }) {
	return (
		<MessageProvider dialog={props.dialog} $={props.$} last first expanded>
			<MessageInfoProviderInner>{props.children}</MessageInfoProviderInner>
		</MessageProvider>
	);
}

enum MessageInfoOptions {
	Download,
	JumpToReply,
}

// my initial idea for MessageInfo is that it would be a view
// but I think it being a modal makes more sense?
export default function MessageInfo(props: { onClose: () => void }) {
	const { message, entities, dialog, edited, isOutgoing, isSticker, isReply, reply } = useMessageContext();

	function tail() {
		const sticker = isSticker();
		const reply = isReply();
		const tail = true;

		return sticker ? reply && tail : tail;
	}

	const onClose = once(props.onClose);

	let viewRef!: HTMLDivElement;

	const [hasFocusable, setHasFocusable] = createSignal(false);
	let isFocusing = false;

	const SN_ID = createUniqueId();
	const SN_ID_OPTIONS = createUniqueId();

	onMount(() => {
		setHasFocusable(!!viewRef.querySelector(".focusable"));
		viewRef.focus();
		// __viewRef = viewRef;

		SpatialNavigation.add(SN_ID, {
			restrict: "self-only",
			rememberSource: true,
			selector: `.${styles.view_message_info}#${SN_ID} .focusable`,
		});

		SpatialNavigation.add(SN_ID_OPTIONS, {
			restrict: "self-only",
			rememberSource: true,
			selector: `.${SN_ID_OPTIONS}.${styles.option_item}`,
		});
	});

	const hasAttachment = createMemo(() => {
		const media = message().media;
		return (media && "fileId" in media && media.type != "sticker" && media) || null;
	});

	const hasReply = createMemo(() => {
		const repliedMessage = reply();
		if (typeof repliedMessage == "object") {
			return repliedMessage;
		}
		return null;
	});

	const optionItems = createMemo(() => {
		const arr = [];

		if (hasAttachment() && (!cloudphone || cloudphone_features.FileDownload)) {
			arr.push(MessageInfoOptions.Download);
		}

		if (hasReply()) {
			arr.push(MessageInfoOptions.JumpToReply);
		}

		return arr;
	});
	const [showOptions, setShowOptions] = createSignal(false);

	const [showDownloadPrompt, setShowDownloadPrompt] = createSignal(false);

	const [showReply, setShowReply] = createSignal<UIMessage | null>(null);

	function updateSoftkeys() {
		const _hasFocusable = hasFocusable();
		const _hasOptionItems = optionItems().length != 0;

		if (showOptions()) {
			setSoftkeys("", "OK", "");
			return;
		}

		setSoftkeys(
			//
			"Back",
			_hasFocusable ? "SELECT" : "",
			_hasOptionItems ? "Options" : "",
		);
	}

	const [photo, setPhoto] = createSignal<Photo | null>(null);
	const [video, setVideo] = createSignal<Video | null>(null);

	createEffect(() => {
		updateSoftkeys();
	});

	createEffect(() => {
		entities();

		untrack(() => {
			sleep(10).then(() => {
				setHasFocusable(!!viewRef.querySelector(".focusable"));
				isFocusing = false;
				viewRef.focus();
			});
		});
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
		// __viewRef = null;
		onClose();
	});

	let _last_inner_focused: HTMLElement | null = null;

	return (
		<>
			<Content>
				<div
					ref={viewRef}
					tabIndex={0}
					class={styles.view_message_info}
					id={SN_ID}
					onFocus={() => {
						updateSoftkeys();
					}}
					oncapture:sn-willfocus={(e) => {
						const target = e.target;

						_last_inner_focused = target as HTMLElement;

						scrollIntoView(target, {
							behavior: "smooth",
							block: "center",
						});
					}}
					onKeyDown={(e) => {
						if (e.key == "Backspace") {
							e.preventDefault();
						}
					}}
					onKeyUp={(e) => {
						if (isFocusing) {
							if (e.key == "Backspace" || (cloudphone && e.key == "SoftLeft")) {
								sleep(100).then(() => viewRef.focus());
								isFocusing = false;
							}

							return;
						}

						if (hasFocusable() && !isFocusing && e.key == "Enter") {
							isFocusing = true;
							sleep(100).then(() => {
								SpatialNavigation.focus(SN_ID);
							});

							// console.error("SHOULD BE FOCUSING");
							return;
						}

						if (e.key == "SoftRight" && optionItems().length != 0) {
							setShowOptions(true);
							SpatialNavigation.focus(SN_ID_OPTIONS);
						}

						if (e.key == "Backspace" || e.key == "SoftLeft") {
							sleep(100).then(() => onClose());
						}
					}}
				>
					<div class={styles.container}>
						<Wallpaper classList={{ [styles.wallpaper]: true }} />
						{/* <div
							style={{
								"text-align": "center",
								"font-size": "13px",
								color: "white",
							}}
						>
							🚧🚀 UNDER CONSTRUCTION 🛠️👷
						</div> */}

						<div
							classList={{
								[styles.message]: true,
								[styles.padTop]: true,
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
								<MessageInfoProvider $={message()} dialog={dialog()}>
									<MessageItemInner
										onSelect={(media) => {
											switch (media.type) {
												case "photo":
													setPhoto(media);
													break;
												case "video":
													setVideo(media);
													break;
											}
										}}
										onFocus={(media) => {
											setSoftkeys("", "VIEW", "");
										}}
										customRenderer={(e, _default, _children) => {
											if (e.tag == "spoiler") {
												return () => (
													<FocusableSpoiler>
														<Dynamic component={_children}></Dynamic>
													</FocusableSpoiler>
												);
											}

											console.error("MESSAGE INFO CUSTOM RENDERER", unwrap(e));
											if (
												e.tag == "a" &&
												(e.entity._ == "messageEntityUrl" ||
													e.entity._ == "messageEntityTextUrl" ||
													e.entity._ == "messageEntityEmail" ||
													e.entity._ == "messageEntityMention" ||
													e.entity._ == "messageEntityMentionName")
											) {
												// const entity = e.entity;

												let url = parseURL(e.props.href);

												return () => (
													<FocusableLink
														url={url}
														onDeepLink={async (deeplink, url) => {
															SpatialNavigation.pause();

															if (deeplink.type == "username" || deeplink.type == "user") {
																const dialog = await tg
																	.getPeerDialogs(deeplink.type == "user" ? deeplink.id : deeplink.username)
																	.then((a) => a[0])
																	.catch(() => null);
																if (dialog) {
																	// const peer = dialog.peer;

																	const uiDialog = dialogsJar.add(dialog);
																	sortDialogs();
																	onClose();

																	if (!uiDialog.messages.hasLoadedBefore) {
																		uiDialog.messages.loadMore();
																	}

																	batch(() => {
																		setStatusbarColor("#1c96c3");
																		$room.set(uiDialog);
																		$view.set("room");
																	});

																	SpatialNavigation.resume();
																	return;
																}
															}

															SpatialNavigation.resume();

															toaster("Unsupported Telegram Link!");
														}}
													>
														<Dynamic component={_default}></Dynamic>
													</FocusableLink>
												);
											}
										}}
									/>
								</MessageInfoProvider>
							</div>
						</div>
					</div>
					<div class={styles.view_message_info_more_info}>
						<Separator>Sent</Separator>
						<div class={styles.info_date}>
							<div class={styles.date}>{formatDate(message().date)}</div>
						</div>
						<Show when={edited()}>
							{(date) => (
								<>
									<Separator>Edited</Separator>
									<div class={styles.info_date}>
										<div class={styles.date}>{formatDate(date())}</div>
									</div>
								</>
							)}
						</Show>
					</div>
				</div>
			</Content>
			<Show when={photo()}>
				<Portal>
					<ImageViewer
						photo={photo()!}
						onClose={() => {
							setPhoto(null);
							setStatusbarColor("#1c96c3");
							_last_inner_focused?.focus();
						}}
					></ImageViewer>
				</Portal>
			</Show>
			<Show when={video()}>
				<VideoPlayer
					video={video()!}
					onClose={() => {
						setVideo(null);
						setStatusbarColor("#1c96c3");
						_last_inner_focused?.focus();
					}}
				></VideoPlayer>
			</Show>
			<Show when={showReply()}>
				<Portal>
					<MessageProvider $={showReply()!} dialog={dialog()} last first expanded>
						<MessageInfo
							onClose={() => {
								setShowReply(null);
								viewRef.focus();
							}}
						></MessageInfo>
					</MessageProvider>
				</Portal>
			</Show>
			<Show when={showOptions()}>
				<Portal>
					<Options
						onClose={() => {
							setTimeout(() => {
								setShowOptions(false);
								viewRef.focus();
							}, 100);
						}}
						title="Options"
					>
						<For each={optionItems()}>
							{(item) => (
								<OptionsItem
									tabIndex={-1}
									classList={{
										[SN_ID_OPTIONS]: true,
										[styles.option_item]: true,
									}}
									on:keydown={(e) => {
										if (e.key == "Enter") {
											viewRef.focus();
											setShowOptions(false);

											if (item == MessageInfoOptions.Download) {
												const attachment = hasAttachment()!;
												const notNecessary = downloadFile.fromCache(attachment);
												if (notNecessary) {
													const url = URL.createObjectURL(notNecessary.result);
													downloadToFile(url, mediaFilename(attachment));
												} else {
													setShowDownloadPrompt(true);
												}
											}

											if (item == MessageInfoOptions.JumpToReply) {
												setShowReply(hasReply()!);
											}
										}
									}}
								>
									{item == MessageInfoOptions.Download
										? "Download"
										: item == MessageInfoOptions.JumpToReply
											? "Go to Reply"
											: item}
								</OptionsItem>
							)}
						</For>
					</Options>
				</Portal>
			</Show>
			<Show when={showDownloadPrompt()}>
				<DownloadPrompt
					file={hasAttachment()!}
					onClose={() => {
						viewRef.focus();
						setShowDownloadPrompt(false);
					}}
				></DownloadPrompt>
			</Show>
		</>
	);
}
