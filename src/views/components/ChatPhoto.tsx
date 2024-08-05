import { Chat, ChatPhoto } from "@mtcute/core";
import { createSignal, createEffect, onCleanup, onMount, Show, JSXElement } from "solid-js";
import styles from "./ChatPhoto.module.scss";
import TelegramIcon from "./TelegramIcon";
import { getColorFromPeer } from "@/lib/utils";
import { downloadFile } from "@/lib/files/download";

function ChatPhotoWithIcon(props: { src: ChatPhoto; chat: Chat }) {
	const [placeholder, setPlaceholder] = createSignal<string | null>(null);

	createEffect(() => {
		const src = props.src.thumb;
		if (src) {
			const url = URL.createObjectURL(new Blob([src]));
			setPlaceholder(url);

			onCleanup(() => {
				URL.revokeObjectURL(url);
			});
		} else {
			setPlaceholder(null);
		}
	});

	const [src, setSrc] = createSignal<string | null>(null);

	let mounted = true;

	onMount(() => {
		mounted = true;
	});

	onCleanup(() => {
		mounted = false;
	});

	createEffect(() => {
		const file = props.src.small;

		const download = downloadFile(file);

		let url!: string;

		function stateChange() {
			if (download.state == "done") {
				if (mounted) {
					// console.error("DOWNLOAD RESULT", download.result);
					setSrc((url = URL.createObjectURL(download.result)));
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
	});

	return (
		<div class={styles.photo}>
			<Show when={placeholder()}>
				{(src) => <img classList={{ [styles.thumb]: true, [styles.photo]: true }} src={src() + "#-moz-samplesize=2"} />}
			</Show>
			<Show when={src()}>
				{(src) => (
					<img classList={{ [styles.animate]: true, [styles.photo]: true }} src={src() + "#-moz-samplesize=2"} />
				)}
			</Show>
		</div>
	);
}

function ChatPhotoColor(props: { color: string; children: JSXElement }) {
	return (
		<div
			style={{
				"background-color": props.color,
			}}
			classList={{ [styles.color]: true }}
			data-color={props.color}
		>
			{props.children}
		</div>
	);
}

export default function ChatPhotoIcon(props: { chat: Chat; showSavedIcon?: boolean }) {
	return (
		<Show
			when={props.showSavedIcon === undefined || props.showSavedIcon}
			fallback={
				<Show
					when={props.chat.photo}
					fallback={
						<ChatPhotoColor color={getColorFromPeer(props.chat.peer)}>
							{props.chat.displayName
								.split(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]|\s/gi)
								.map((a) => Array.from(a)[0])
								.join("")
								.slice(0, 2)}
						</ChatPhotoColor>
					}
				>
					<Show when={props.chat.photo}>{(photo) => <ChatPhotoWithIcon chat={props.chat} src={photo()} />}</Show>
				</Show>
			}
		>
			<Show
				when={props.chat.photo && !props.chat.isSelf}
				fallback={
					<ChatPhotoColor color={props.chat.isSelf ? "saved" : getColorFromPeer(props.chat.peer)}>
						<Show
							when={props.chat.isSelf}
							fallback={props.chat.displayName
								.split(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]|\s/gi)
								.map((a) => Array.from(a)[0])
								.join("")
								.slice(0, 2)}
						>
							<TelegramIcon style={{ "font-size": "1.1rem" }} name="saved" />
						</Show>
					</ChatPhotoColor>
				}
			>
				<Show when={props.chat.photo}>{(photo) => <ChatPhotoWithIcon chat={props.chat} src={photo()} />}</Show>
			</Show>
		</Show>
	);
}
