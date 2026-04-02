import type { ChatPhoto, Peer } from "@mtcute/core";
import * as styles from "./PeerPhotoIcon.module.scss";
import {
	createEffect,
	createRenderEffect,
	createSignal,
	type JSXElement,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
	untrack,
} from "solid-js";
import { calculateSampleSize, getColorFromPeer, isUser } from "@/utils";
import { downloadFile } from "@/lib/storage";
import TelegramIcon from "./TelegramIcon";

function formatDisplayName(s: string) {
	return s
		.split(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]|\s/gi)
		.map((a) => Array.from(a)[0])
		.join("")
		.slice(0, 2);
}

function ChatPhotoWithIcon(props: {
	src: ChatPhoto;
	peer: Peer;
	// fallback to ChatPhotoColor when an error occurs
	onError: () => void;
}) {
	const [placeholder, setPlaceholder] = createSignal<string | null>(null);
	const [src, setSrc] = createSignal<string | null>(null);
	const [sampleSize, setSampleSize] = createSignal("");

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

	let divRef!: HTMLDivElement;

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
		download.catch(() => {
			props.onError();
		});

		setSampleSize(calculateSampleSize(160, 160, divRef.offsetWidth, divRef.offsetHeight));

		let url!: string;

		function stateChange() {
			if (download.state == "done") {
				const _placeholder = placeholder();
				if (_placeholder) {
					setTimeout(() => {
						URL.revokeObjectURL(_placeholder);
						if (mounted) setPlaceholder(null);
					}, 500);
				}

				if (mounted) {
					// console.error("DOWNLOAD RESULT", download.result);
					setSrc((url = URL.createObjectURL(download.result)));
				}
			}
		}

		if (download.state == "done") {
			stateChange();

			onCleanup(() => {
				setSrc(null);
				URL.revokeObjectURL(url);
			});

			return;
		}

		download.on("state", stateChange);

		onCleanup(() => {
			setSrc(null);
			download.off("state", stateChange);
			URL.revokeObjectURL(url);
		});
	});

	return (
		<div ref={divRef} class={styles.photo}>
			<Show when={placeholder()}>
				{(src) => <img classList={{ [styles.thumb]: true, [styles.photo]: true }} src={src()} />}
			</Show>
			<Show when={sampleSize() && src()}>
				{(src) => <img classList={{ [styles.animate]: true, [styles.photo]: true }} src={src() + sampleSize()} />}
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

export default function PeerPhotoIcon(props: { peer: Peer; showSavedIcon?: boolean }) {
	const isSelf = () => isUser(props.peer) && props.peer.isSelf;
	const [error, setError] = createSignal(false);

	function onError() {
		setError(true);
	}

	createRenderEffect(() => {
		// listen to changes
		props.peer;

		untrack(() => {
			setError(false);
		});
	});

	return (
		<Switch>
			<Match when={error()}>
				<ChatPhotoColor color={getColorFromPeer(props.peer.raw)}>
					{formatDisplayName(props.peer.displayName)}
				</ChatPhotoColor>
			</Match>

			<Match when={isUser(props.peer) && props.peer.isDeleted}>
				<ChatPhotoColor color={getColorFromPeer(props.peer.raw)}>
					<TelegramIcon style={{ "font-size": "1.2rem" }} name="deletedaccount" />
				</ChatPhotoColor>
			</Match>

			<Match when={!(props.showSavedIcon ?? true)}>
				<Show
					when={props.peer.photo}
					fallback={
						<ChatPhotoColor color={getColorFromPeer(props.peer.raw)}>
							{formatDisplayName(props.peer.displayName)}
						</ChatPhotoColor>
					}
				>
					<ChatPhotoWithIcon onError={onError} peer={props.peer} src={props.peer.photo!} />
				</Show>
			</Match>

			<Match when={props.peer.photo && !isSelf()}>
				<ChatPhotoWithIcon onError={onError} peer={props.peer} src={props.peer.photo!} />
			</Match>

			<Match when={!props.peer.photo || isSelf()}>
				<ChatPhotoColor color={isSelf() ? "saved" : getColorFromPeer(props.peer.raw)}>
					<Show when={isSelf()} fallback={formatDisplayName(props.peer.displayName)}>
						<TelegramIcon style={{ "font-size": "1.2rem" }} name="saved" />
					</Show>
				</ChatPhotoColor>
			</Match>
		</Switch>
	);
}
