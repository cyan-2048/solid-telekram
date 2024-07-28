import { JSXElement, Show } from "solid-js";
import styles from "./Options.module.scss";
import Content from "./Content";

export default function Options(props: {
	title?: string;
	children: JSXElement;
	onClose?: () => void;
	maxHeight?: string | null;
}) {
	return (
		<Content>
			<div
				onKeyDown={(e) => {
					if (e.key == "Backspace") {
						props.onClose?.();
						e.preventDefault();
					}
				}}
				class={styles.background}
			>
				<div
					style={{
						"max-height": props.maxHeight === undefined ? "80%" : props.maxHeight || undefined,
					}}
					class={styles.wrap}
				>
					<Show when={props.title}>
						<div class={styles.header}>{props.title}</div>
					</Show>
					<div class={styles.content}>{props.children}</div>
				</div>
			</div>
		</Content>
	);
}
