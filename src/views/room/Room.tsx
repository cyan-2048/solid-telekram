import { useStore } from "@nanostores/solid";
import * as styles from "./Room.module.scss";
import { $editingMessage, $replyingMessage, $room, $view, $wallpaper, $wallpaper_color } from "@/stores";
import {
	type ComponentProps,
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { tg, typingIndicatorPrivateJar, userStatusJar } from "@globals";
import Content from "@components/Content";
import PeerPhotoIcon from "@components/PeerPhotoIcon";
import type { tl } from "@mtcute/core";
import type { Peer, TypingStatus } from "@mtcute/core";
import { setSoftkeys, sleep, toaster, useStore as useStore_, WALLPAPER_AVERAGE_COLORS } from "@utils";
import { timeStamp } from "../Home";
import type UIDialog from "@/ui/UIDialog";
import SpatialNavigation from "@/lib/spatial_navigation";
import WhenMounted from "@components/WhenMounted";
import MessageItem, { MessageProvider, SponsoredMessageItem, UploadingMessageItem } from "./MessageItem";
import ISpinner from "@components/ISpinner";
import RoomTextBox from "./RoomTextBox";
import KaiButton, { ButtonContainer } from "../components/KaiButton";
import scrollIntoView from "scroll-into-view-if-needed";
import { alert } from "../modals";

const typingStatusDictionaryForPrivateChats = {
	typing: "typing",
	upload_voice: "sending file",
	upload_document: "sending file",
	upload_photo: "sending a photo",
	upload_video: "sending a video",
	upload_round: "sending a video",
	record_video: "recording video",
	record_voice: "recording voice",
	record_round: "recording video",
	game: "playing a game",
	sticker: "choosing a sticker",
};

function typingStatusToEnglish(status: TypingStatus): string {
	return (typingStatusDictionaryForPrivateChats as any)[status] || status;
}

function UserStatusIndicator(props: { userId: number }) {
	const userStatus = () => userStatusJar.get(props.userId);

	const lastOnline = useStore_(() => userStatus().lastOnline);
	const status = useStore_(() => userStatus().status);

	return (
		<Show when={lastOnline()} fallback={status() == "long_time_ago" ? "offline" : status()}>
			Last online on {timeStamp(lastOnline()!)}
		</Show>
	);
}

function PrivateChatBottomHeader(props: { userId: number }) {
	const typingStatus = useStore_(() => typingIndicatorPrivateJar.get(props.userId).$status);

	return (
		<>
			<Show when={typingStatus() === null} fallback={<>{typingStatusToEnglish(typingStatus()!)}...</>}>
				<UserStatusIndicator userId={props.userId} />
			</Show>
		</>
	);
}

function JoinButton(props: { dialog: UIDialog }) {
	const isChannel = () => props.dialog.chatType == "channel";

	const hasJoinRequests = createMemo(() => {
		const peer = props.dialog.peer;

		if (peer.type == "chat") {
			return peer.hasJoinRequests;
		}
		return false;
	});

	const joinLabel = createMemo(() => {
		const channel = isChannel();
		const applyToJoin = hasJoinRequests();
		return channel ? "Subscribe" : applyToJoin ? "Apply to join group" : "Join";
	});

	onCleanup(() => {
		if ($view.get() == "room") {
			sleep(100).then(() => {
				SpatialNavigation.focus("room");
			});
		}
	});

	return (
		<ButtonContainer>
			<KaiButton
				onKeyDown={(e) => {
					if (e.key == "Backspace") {
						e.preventDefault();
					}
				}}
				onKeyUp={async (e) => {
					if (e.key == "Backspace") {
						$view.set("home");
					}

					if (e.key == "Enter") {
						try {
							const previousActive = document.activeElement as HTMLElement;

							previousActive?.blur();

							SpatialNavigation.pause();

							const result = await tg.joinChat(props.dialog.peer);

							switch (result.status) {
								case "ok": {
									const uiDialog = props.dialog;
									const dialog = await tg.getPeerDialogs(result.chat).then((a) => a[0]);
									if (dialog) {
										uiDialog.update(dialog);
										uiDialog.messages.dispose();
										await uiDialog.messages.loadMore();
										await sleep(100);
									}
									break;
								}

								case "request_sent":
									await alert(
										"You will be added to the group once an admin approves your request.",
										"Join request sent",
									);
									break;
								case "webview":
									break;
							}
						} catch (e: any) {
							toaster("Unable to join.");
						} finally {
							SpatialNavigation.resume();
							SpatialNavigation.focus("room");
						}
					}
				}}
				onFocus={(e) => {
					scrollIntoView(e.currentTarget, {
						behavior: "instant",
						block: "center",
					});
					setSoftkeys("", "tg:arrow_next", "");
				}}
				classList={{ last: true, focusable: true, join: true }}
			>
				{joinLabel()}
			</KaiButton>
		</ButtonContainer>
	);
}

function Messages(props: { dialog: UIDialog }) {
	const messages = useStore_(() => props.dialog.messages.$sorted);

	const loading = useStore_(() => props.dialog.messages.$isLoading);

	createEffect(() => {
		const _ = loading();

		if (_) {
			setSoftkeys("", "Loading...", "", true);
		}
	});

	let divRef!: HTMLDivElement;

	const uploading = useStore_(() => props.dialog.$uploading);

	onMount(() => {
		SpatialNavigation.add("room", {
			selector: `.${styles.room} .focusable, .${styles.room} .last.focusable`,
			rememberSource: true,
			enterTo: "last-focused",
			restrict: "self-only",
			defaultElement: `.${styles.room} .last.focusable`,
		});
	});

	const sponsoredMessagesRaw = useStore_(() => props.dialog.$sponsoredMessages);

	const [sponsoredMessagesReady, setSponsoredMessagesReady] = createSignal(true);

	createEffect(() => {
		// Track props.dialog
		props.dialog;

		setSponsoredMessagesReady(false);

		const timer = setTimeout(() => {
			setSponsoredMessagesReady(true);
		}, 2_000);

		onCleanup(() => clearTimeout(timer));
	});

	const sponsoredMessages = createMemo(() => {
		const ready = sponsoredMessagesReady();
		messages();
		sponsoredMessagesRaw();
		return ready ? props.dialog.getSponsoredMessages() : null;
	});

	createEffect(() => {
		sponsoredMessages();

		const current = document.activeElement as HTMLElement;
		if (current && sponsoredMessagesReady() && $view.get() == "room" && current.matches(`.${styles.room} .focusable`)) {
			scrollIntoView(current, {
				behavior: "instant",
				block: "center",
			});
		}
	});

	const view = useStore($view);

	createEffect(() => {
		const inView = view() == "room";

		if (inView && !loading()) {
			props.dialog.getSponsoredMessages();
			sleep(100).then(() => SpatialNavigation.focus("room"));
		}
	});

	onCleanup(() => {
		SpatialNavigation.remove("room");
	});

	const isMember = useStore_(() => props.dialog.$isMember);

	const isChannel = () => props.dialog.chatType == "channel";
	const isForum = () => "isForum" in props.dialog.peer && props.dialog.peer.isForum;

	const showTextBox = createMemo(() => {
		const isNotChannel = !isChannel();
		const isNotForum = !isForum();
		const _isMember = isMember();
		return isNotChannel && isNotForum && _isMember;
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
							<>
								<Show when={sponsoredMessages()?.getByIndex(index())}>
									{(sponsor) => <SponsoredMessageItem sponsor={sponsor()} />}
								</Show>
								<MessageProvider
									first={index() == 0}
									last={index() == messages().length - 1}
									dialog={props.dialog}
									$={e}
									before={messages()[index() - 1]}
								>
									<MessageItem />
								</MessageProvider>
							</>
						)}
					</For>
					<Show when={sponsoredMessages()?.getLast()}>{(sponsor) => <SponsoredMessageItem sponsor={sponsor()} />}</Show>
				</WhenMounted>
				<For each={uploading()}>{(upload) => <UploadingMessageItem upload={upload} />}</For>
				<Show when={showTextBox()}>
					<RoomTextBox dialog={props.dialog} />
				</Show>
				<Show when={!isMember()}>
					<JoinButton {...props} />
				</Show>
			</Show>
		</div>
	);
}

function AvatarSpinner(props: { spin: boolean }) {
	return (
		<Show when={props.spin}>
			<div class={styles.spinner}>
				<ISpinner></ISpinner>
			</div>
		</Show>
	);
}

function RoomAvatar(props: { dialog: UIDialog }) {
	const showSpinner = useStore_(() => props.dialog.messages.$showSpinner);

	return (
		<>
			<div
				style={
					showSpinner()
						? {
								opacity: "0.5",
							}
						: undefined
				}
			>
				<PeerPhotoIcon peer={props.dialog.peer} />
			</div>
			<AvatarSpinner spin={showSpinner()}></AvatarSpinner>
		</>
	);
}

export function Wallpaper(props: { classList?: ComponentProps<"div">["classList"] }) {
	const wallpaper = useStore($wallpaper);
	const wallpaperColor = useStore($wallpaper_color);

	function wallpaperStyle(): JSX.CSSProperties {
		const _wallpaper = wallpaper();
		const color = wallpaperColor();

		return _wallpaper == "color"
			? {
					"background-color": color,
				}
			: {
					"background-image": `var(--wallpaper)`,
					"background-color": WALLPAPER_AVERAGE_COLORS[_wallpaper as number],
				};
	}

	return (
		<Show when={typeof wallpaper() == "number" || wallpaper() == "color"}>
			<div classList={{ [styles.wallpaper_image]: true, ...props.classList }} style={wallpaperStyle()}></div>
		</Show>
	);
}

export default function Room(props: { hidden: boolean }) {
	const editingMessage = useStore($editingMessage);
	const replyingMessage = useStore($replyingMessage);

	const room = useStore($room);

	const interacting = createMemo(() => {
		const editing = editingMessage();
		const replying = replyingMessage();
		return editing || replying;
	});

	const memberCount = useStore_(() => room()?.$memberCount);

	createEffect(() => {
		const _room = room()?.peer;

		if (_room) {
			if ("isForum" in _room && _room.isForum) {
				// currently this one is so confusing
				toaster("Forum supergroups are currently unstable!");
			}

			if ("isBot" in _room && _room.isBot) {
				toaster("Bots are currently not supported!");
			}

			tg.openChat(_room);

			// console.log(dialogsJar.get(_room.id), _room.id, _room);

			onCleanup(() => {
				tg.closeChat(_room);
			});
		}
	});

	return (
		<Show when={room()}>
			{(dialog) => (
				<Content
					before={
						<div class={styles.header}>
							<div class={styles.avatar}>
								<RoomAvatar dialog={dialog()} />
							</div>
							<div class={styles.details}>
								<div class={styles.top}>
									<span>{dialog().isSelf ? "Saved Messages" : dialog().displayName}</span>
								</div>

								<div class={styles.bottom}>
									<span>
										<Show
											when={dialog().chatType != "private"}
											fallback={
												<Show
													when={
														!dialog().isSupport &&
														dialog().peer.raw._ == "user" &&
														!(dialog().peer.raw as tl.RawUser).bot
													}
												>
													<PrivateChatBottomHeader userId={dialog().peer.id}></PrivateChatBottomHeader>
												</Show>
											}
										>
											{memberCount() || 0} {dialog().chatType == "channel" ? "Subscribers" : "Members"}
										</Show>
									</span>
								</div>
							</div>
						</div>
					}
					after={
						<Show when={interacting()}>{(msg) => <RoomTextBox floating dialog={dialog()} message={msg()} />}</Show>
					}
					hidden={props.hidden}
					mainClass={styles.room_wrap}
				>
					<Wallpaper />
					<Messages dialog={dialog()}></Messages>
				</Content>
			)}
		</Show>
	);
}
