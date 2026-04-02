import type { Audio } from "@mtcute/core";
import * as styles from "./MusicPlayer.module.scss";
import { lazy, onMount, Show } from "solid-js";
import { setSoftkeys } from "@/utils";
import { setStatusbarColor } from "@/stores";
const MusicPlayerFlac = lazy(() => import("./MusicPlayerFlac"));

function MusicPlayerNormal(props: { music: Audio; onClose: () => void }) {
	let divRef!: HTMLDivElement;

	onMount(() => {
		divRef.focus();
		setSoftkeys("", "", "Options", false, true);
		setStatusbarColor("#000");
	});

	return (
		<div
			ref={divRef}
			on:keydown={(e) => {
				const key = e.key;

				if (key == "Backspace") {
					e.preventDefault();
					props.onClose();
				}
			}}
			tabIndex={-1}
			class={styles.player}
		></div>
	);
}

export default function MusicPlayer(props: { music: Audio; onClose: () => void }) {
	return (
		<Show
			when={props.music.mimeType.includes("flac") && import.meta.env.KAIOS == 2}
			fallback={<MusicPlayerNormal {...props} />}
		>
			<MusicPlayerFlac {...props} />
		</Show>
	);
}
