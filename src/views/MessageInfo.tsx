import { dialogsJar, setMessageInfo, setSoftkeys, UIMessage } from "@signals";
import {
	ComponentProps,
	createEffect,
	createMemo,
	createResource,
	createSignal,
	JSXElement,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import styles from "./Room.module.scss";
import { MessageMedia, Photo, User } from "@mtcute/core";
import { reply } from "@mtcute/core/highlevel/types/bots/keyboards/factories";
import { Dynamic, Portal } from "solid-js/web";
import Markdown, { ModifyString } from "./components/Markdown";
import { decideShowUsername, MessageProvider, switchMessageMedia } from "./Messages";
import { getColorFromPeer, sleep, useMessageChecks, useStore } from "@/lib/utils";
import TelegramIcon from "./components/TelegramIcon";
import { Download } from "@/lib/files/download";
import { UsernameContainer } from "./Room";
import SpatialNavigation from "@/lib/spatial_navigation";
import scrollIntoView from "scroll-into-view-if-needed";
import ImageViewer from "./components/ImageViewer";

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

function MessageAdditionalInfo(props: { $: UIMessage; setWidth: (n: number) => void }) {
	const message = () => props.$;
	const dialog = () => dialogsJar.get(props.$.$.chat.peer.id)!;

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
			<Show when={message().isOutgoing}>
				<div class={styles.info_check}>
					<TelegramIcon name={check() ? "check" : "checks"} />
				</div>
			</Show>
		</div>
	);
}

function FocusableLink(props: ComponentProps<"a">) {
	return (
		<a
			class="focusable"
			onKeyDown={(e) => {
				if (e.key == "Enter") {
					e.preventDefault();
					console.error("not yet implemented open links in new tab");
				}
			}}
			{...props}
		></a>
	);
}

let lastFocused: HTMLElement;

export default function MessageInfo(props: { $: UIMessage }) {
	let viewRef!: HTMLDivElement;

	// const text = useStore(() => props.$.text);
	const entities = useStore(() => props.$.entities);
	const edited = useStore(() => props.$.editDate);

	const [infoWidth, setInfoWidth] = createSignal(0);

	const dialog = () => dialogsJar.get(props.$.$.chat.peer.id)!;

	const check = useMessageChecks(() => props.$, dialog);

	const [reply] = createResource(async () => {
		const _ = props.$.isReply();
		if (_) {
			const msg = await props.$.getReply(dialog());
			return msg ?? 0;
		} else {
			return undefined;
		}
	});

	const [selectedPhoto, setSelectedPhoto] = createSignal<null | Photo>(null);

	const showUsername = createMemo(() => decideShowUsername(undefined, props.$));

	let hasFocusable = false;
	let isFocusing = false;

	onMount(() => {
		if (!lastFocused) lastFocused = document.activeElement as any;
		hasFocusable = !!viewRef.querySelector(".focusable");

		viewRef.focus();

		SpatialNavigation.add("view_message_info", {
			restrict: "self-only",
			rememberSource: true,
			selector: `.${styles.container} .focusable`,
		});
	});

	onCleanup(() => {
		SpatialNavigation.remove("view_message_info");
	});

	let downloadRef!: Download;

	return (
		<>
			<div
				ref={viewRef}
				oncapture:sn-willfocus={(e) => {
					setSoftkeys("", "VIEW", "");
					scrollIntoView(e.target, {
						behavior: "instant",
						block: "center",
						inline: "center",
					});
				}}
				onFocus={() => {
					setSoftkeys("Back", hasFocusable ? "SELECT" : "", "");
				}}
				onKeyDown={(e) => {
					if (isFocusing) {
						if (e.key == "Backspace") {
							e.preventDefault();
							viewRef.focus();
							isFocusing = false;
						}

						return;
					}

					if (hasFocusable && !isFocusing && e.key == "Enter") {
						isFocusing = true;
						sleep(10).then(() => {
							SpatialNavigation.focus("view_message_info");
						});

						// console.error("SHOULD BE FOCUSING");
						return;
					}

					if (e.key == "Backspace" || e.key == "SoftLeft") {
						e.preventDefault();
						setMessageInfo(null);
						sleep(10).then(() => {
							lastFocused.focus();
							// @ts-ignore
							lastFocused = undefined;
						});
					}
				}}
				class={styles.view_message_info}
				tabIndex={-1}
			>
				<div class={styles.container}>
					<div
						classList={{
							[styles.message]: true,
							[styles.padTop]: true,
						}}
						style={{
							"margin-top": 0,
						}}
					>
						<div
							classList={{
								[styles.message_inner]: true,
								[styles.outgoing]: props.$.isOutgoing,
								[styles.tail]: true,
								[styles.isSticker]: props.$.isSticker,
								[styles.isReply]: props.$.isReply(),
								[styles.showUsername]: showUsername(),
							}}
						>
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
							<MessageProvider last={true} $={props.$} dialog={dialog()}>
								<Dynamic
									focusable={true}
									downloadRef={(e: Download) => {
										downloadRef = e;
									}}
									onSelect={(e: NonNullable<MessageMedia>) => {
										console.error("MESSAGE INFO ONSELECT");
										if (e.type == "photo") {
											isFocusing = false;
											setSelectedPhoto(e);
										}
									}}
									component={switchMessageMedia(props.$.$.media?.type)}
								/>
							</MessageProvider>
							<Show when={!props.$.isSticker && (entities().entities || entities().text)}>
								<div class={styles.text_container}>
									<div style="max-height: unset !important;" class={styles.text_wrap}>
										<div class={styles.text}>
											{
												<Markdown
													customRenderer={(e) => {
														// console.error("MESSAGE INFO CUSTOM RENDERER", e);
														if (e.tag == "a" && e.entity._.includes("Url")) {
															if (typeof e.props.href != "string") return;
															return () => <FocusableLink {...e.props}>{e.children[0] as string}</FocusableLink>;
														}
													}}
													entities={entities()}
												/>
											}
											<span class={styles.extra_width} style={{ width: infoWidth() + "px" }}></span>
										</div>
									</div>
								</div>
								<div class={styles.message_info}>
									<Show when={edited() && !props.$.$.hideEditMark}>
										<div class={styles.edited}>edited</div>
									</Show>
									<Show when={props.$.isOutgoing}>
										<div class={styles.info_check}>
											<TelegramIcon name={check() ? "check" : "checks"} />
										</div>
									</Show>
								</div>
								<MessageAdditionalInfo $={props.$} setWidth={setInfoWidth} />
							</Show>
						</div>
					</div>
				</div>
			</div>
			<Show when={selectedPhoto()}>
				<Portal>
					<ImageViewer
						photo={selectedPhoto()!}
						onClose={async () => {
							setSelectedPhoto(null);
							await sleep(2);
							viewRef.focus();
						}}
					></ImageViewer>
				</Portal>
			</Show>
		</>
	);
}
