import { ComponentProps, Show, splitProps } from "solid-js";
import styles from "./OptionsItem.module.scss";

export default function OptionsItem(
	props: ComponentProps<"div"> & {
		arrow?: boolean;
	}
) {
	const [local, rest] = splitProps(props, ["classList", "children"]);
	return (
		<div
			{...rest}
			classList={{ ...local.classList, [styles.item]: true, [styles.tick]: props.arrow }}
		>
			{local.children}
			<Show when={props.arrow}>
				<svg viewBox="0 0 18 18" class="Cv">
					<path d="M7.142 4 6 5.175 9.709 9 6 12.825 7.142 14 12 9z"></path>
				</svg>
			</Show>
		</div>
	);
}
