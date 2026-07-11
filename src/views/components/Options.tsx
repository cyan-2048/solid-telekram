import { type JSXElement, Show } from "solid-js";
import * as styles from "./Options.module.scss";
import Content from "./Content";
import { cloudphone } from "@/config";

export default function Options(props: {
	title?: string;
	children: JSXElement;
	onClose?: () => void;
	maxHeight?: string | null;
}) {
	return (
		<Content>
			<div
				onKeyUp={(e) => {
					if (e.key == "Backspace" || (e.key == "SoftLeft" && cloudphone)) {
						props.onClose?.();
					}
				}}
				onKeyDown={(e) => {
					if (e.key == "Backspace") {
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
