import { sleep, toaster } from "@/utils";
import * as styles from "./Toast.module.scss";
import { createSignal } from "solid-js";

export default function Toast() {
	const [toastText, setToastText] = createSignal("");
	const [showToast, setShowToast] = createSignal(false);

	let current = 0;

	toaster.v = async (text, latency) => {
		const id = (current = current + 1);
		setShowToast(false);
		setToastText(text);
		await sleep(1);
		if (id != current) return;
		setShowToast(true);
		await sleep(300);
		if (id != current) return;
		// to take into consideration the animations
		await sleep(latency);
		if (id != current) return;
		setShowToast(false);
		await sleep(300);
	};

	return <div classList={{ [styles.toast]: true, [styles.displayed]: showToast() }}>{toastText()}</div>;
}
