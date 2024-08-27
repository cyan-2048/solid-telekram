import { createEffect, JSXElement } from "solid-js";
import styles from "./Tabs.module.scss";
import scrollIntoView from "scroll-into-view-if-needed";

export function Tab(props: { onClick?: any; selected?: boolean; children: JSXElement }) {
	let divRef!: HTMLDivElement;

	createEffect(() => {
		if (props.selected) {
			scrollIntoView(divRef, {
				block: "center",
				inline: "center",
			});
		}
	});

	return (
		<div ref={divRef} onClick={props.onClick} classList={{ [styles.tab]: true, [styles.selected]: props.selected }}>
			{props.children}
		</div>
	);
}

export default function Tabs(props: { children: JSXElement }) {
	return <div class={styles.tabs}>{props.children}</div>;
}
