import type { ComponentProps, JSXElement } from "solid-js";
import * as styles from "./Content.module.scss";

export default function Content(props: {
	before?: JSXElement;
	after?: JSXElement;
	children: JSXElement;
	hidden?: boolean;
	mainClass?: string;
	mainStyle?: ComponentProps<"div">["style"];
}) {
	return (
		<div
			style={{
				visibility: props.hidden ? "hidden" : undefined,
			}}
			class={styles.content}
		>
			{props.before}
			<div style={props.mainStyle} class={styles.main + (props.mainClass ? " " + props.mainClass : "")}>
				{props.children}
			</div>
			{props.after}
		</div>
	);
}
