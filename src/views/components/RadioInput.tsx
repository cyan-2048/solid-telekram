import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";
import * as styles from "./RadioInput.module.scss";

export default function RadioInput(
	props: ComponentProps<"div"> & {
		subtext?: JSX.Element;
		checked?: boolean;
		checkbox?: boolean;
	},
) {
	const [local, rest] = splitProps(props, ["classList", "subtext", "checked", "checkbox"]);

	return (
		<div
			{...rest}
			classList={{
				[styles.radio_container]: true,
				...local.classList,
			}}
		>
			<div class={styles.text}>{props.children}</div>
			<Show when={local.subtext}>
				<div class={styles.subtext}>{local.subtext}</div>
			</Show>
			<div
				classList={{ [styles.radio]: !local.checkbox, [styles.checkbox]: !!local.checkbox, [styles.on]: local.checked }}
			></div>
		</div>
	);
}
