import { JSXElement } from "solid-js";
import styles from "./Content.module.scss";

export default function Content(props: {
	before?: JSXElement;
	after?: JSXElement;
	children: JSXElement;
	hidden?: boolean;
	mainClass?: string;
}) {
	return (
		<div
			style={{
				visibility: props.hidden ? "hidden" : undefined,
			}}
			class={styles.content}
		>
			{props.before}
			<div class={styles.main + (props.mainClass ? " " + props.mainClass : "")}>{props.children}</div>
			{props.after}
		</div>
	);
}
