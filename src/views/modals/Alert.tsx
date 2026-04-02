import * as styles from "./Alert.module.scss";
import * as softkeys from "@components/Softkeys.module.scss";
import ModalContainer from "./ModalContainer";
import ModalHeader from "./ModalHeader";
import { onCleanup, onMount } from "solid-js";
import { sleep } from "@/helpers";

export default function Alert(props: { title: string; text: string; onClose: () => void }) {
	let lastFocusedElement!: HTMLElement;

	let divRef!: HTMLDivElement;

	onMount(() => {
		lastFocusedElement = document.activeElement as HTMLElement;
		// console.log("lastFocusedElement", lastFocusedElement);
		divRef.focus();
	});

	let clean = false;

	onCleanup(() => {
		clean = true;
		lastFocusedElement.focus();
	});

	return (
		<ModalContainer>
			<ModalHeader>{props.title}</ModalHeader>
			<div
				onKeyDown={(e) => {
					e.stopImmediatePropagation();
					e.stopPropagation();

					if (e.key == "Enter" || e.key == "Backspace" || e.key == "EndCall") {
						e.preventDefault();
						props.onClose();
					}
				}}
				onBlur={(e) => {
					const target = e.currentTarget;
					if (!clean) {
						sleep().then(() => {
							target.focus();
						});
					}
				}}
				ref={divRef}
				tabIndex={0}
				class={styles.content}
			>
				{props.text}
			</div>
			<div classList={{ [softkeys.softkeys]: true, [styles.softkeys]: true }}>
				<div classList={{ [softkeys.current]: true, [softkeys.black]: true }}>
					<div></div>
					<div>OK</div>
				</div>
			</div>
		</ModalContainer>
	);
}
