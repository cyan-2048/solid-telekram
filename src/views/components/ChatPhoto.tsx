import { downloadFile } from "@/lib/files";
import { Chat, ChatPhoto } from "@mtcute/core";
import { createSignal, createEffect, onCleanup, onMount, Show, JSXElement } from "solid-js";
import styles from "./ChatPhoto.module.scss";
import TelegramIcon from "./TelegramIcon";
import { getColorFromPeer } from "@/lib/utils";

function ChatPhotoWithIcon(props: { src: ChatPhoto }) {
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

		const download = downloadFile(file, {
			retries: 20,
		});

		download.result.then((url) => {
			if (mounted) setSrc(url);
		});

		onCleanup(() => {
			download.cancel();
		});
	});

	return (
		<div class={styles.photo}>
			<Show when={placeholder()}>
				{(src) => <img classList={{ [styles.thumb]: true, [styles.photo]: true }} src={src()} />}
			</Show>
			<Show when={src()}>
				{(src) => <img classList={{ [styles.animate]: true, [styles.photo]: true }} src={src()} />}
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

export default function ChatPhotoIcon(props: { chat: Chat }) {
	return (
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
			<Show when={props.chat.photo}>{(photo) => <ChatPhotoWithIcon src={photo()} />}</Show>
		</Show>
	);
}
