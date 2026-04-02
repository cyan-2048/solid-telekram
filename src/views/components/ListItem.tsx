import { ComponentProps, JSX, Show, splitProps } from "solid-js";
import * as styles from "./ListItem.module.scss";

export default function ListItem(
	props: ComponentProps<"div"> & {
		subtext?: JSX.Element;
		indicator?: boolean;
		focusable?: boolean;
	}
) {
	const [local, rest] = splitProps(props, ["classList", "subtext", "indicator", "tabIndex", "focusable"]);

	return (
		<div
			{...rest}
			classList={{
				...local.classList,
				[styles.list_item]: true,
				[styles.indicator]: Boolean(local.indicator),
			}}
			tabIndex={local.focusable ? 0 : local.tabIndex}
		>
			<div class={styles.text}>{props.children}</div>
			<Show when={local.subtext}>
				<div class={styles.subtext}>{local.subtext}</div>
			</Show>
			<Show when={local.indicator}>
				<div class={styles.indicator}></div>
			</Show>
		</div>
	);
}
