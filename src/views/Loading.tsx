import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { setStatusbarColor } from "../signals";

import styles from "./Loading.module.scss";
import { useKeypress } from "@/lib/utils";

export default function Loading() {
	setStatusbarColor("rgb(0,0,0)");

	const [showSpinner, setShowSpinner] = createSignal(false);

	useKeypress("Backspace", () => {
		window.close();
	});

	onMount(() => {
		const timeout = setTimeout(() => {
			setShowSpinner(true);
		}, 3_000);
		onCleanup(() => clearTimeout(timeout));
	});

	return (
		<div
			style={{
				height: window.outerHeight ? window.outerHeight + "px" : undefined,
			}}
			class={styles.loading}
		>
			<Show when={showSpinner()}>
				<svg class={styles.progressRing} height={24} width={24} viewBox="0 0 16 16">
					<circle cx="8px" cy="8px" r="7px"></circle>
				</svg>
			</Show>
		</div>
	);
}
