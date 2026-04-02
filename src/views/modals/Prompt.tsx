import * as styles from "./Alert.module.scss";
import * as softkeys from "@components/Softkeys.module.scss";
import ModalContainer from "./ModalContainer";
import ModalHeader from "./ModalHeader";
import { onCleanup, onMount } from "solid-js";
import { sleep } from "@/helpers";

export default function Prompt(props: {
	title: string;
	text: string;
	defaultValue: string;
	resolve: string;
	reject: string;
	onClose: (value: string | null) => void;
}) {
	let lastFocusedElement!: HTMLElement;

	let inputRef!: HTMLInputElement;

	onMount(() => {
		lastFocusedElement = document.activeElement as HTMLElement;
		// console.log("lastFocusedElement", lastFocusedElement);
		inputRef.value = props.defaultValue;
		inputRef.select();
		inputRef.focus();
	});

	let clean = false;

	onCleanup(() => {
		clean = true;
		lastFocusedElement.focus();
	});

	return (
		<ModalContainer>
			<ModalHeader>{props.title}</ModalHeader>
			<div tabIndex={0} class={styles.content}>
				{props.text}
				<input
					ref={inputRef}
					onKeyDown={(e) => {
						e.stopImmediatePropagation();
						e.stopPropagation();

						if (e.key == "SoftLeft" || e.key == "SoftRight" || e.key == "Backspace" || e.key == "EndCall") {
							if (e.key == "Backspace" && e.currentTarget.value != "") return;
							e.preventDefault();
							props.onClose(e.key == "SoftRight" ? e.currentTarget.value : null);
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
					type="text"
				/>
			</div>
			<div classList={{ [softkeys.softkeys]: true, [styles.softkeys]: true }}>
				<div classList={{ [softkeys.current]: true, [softkeys.black]: true }}>
					<div>{props.reject}</div>
					<div></div>
					<div>{props.resolve}</div>
				</div>
			</div>
		</ModalContainer>
	);
}
