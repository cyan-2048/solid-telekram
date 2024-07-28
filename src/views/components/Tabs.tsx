import { JSXElement } from "solid-js";
import styles from "./Tabs.module.scss";

export function Tab(props: { selected?: boolean; children: JSXElement }) {
	return (
		<div classList={{ [styles.tab]: true, [styles.selected]: props.selected }}>
			{props.children}
		</div>
	);
}

export default function Tabs(props: { children: JSXElement }) {
	return <div class={styles.tabs}>{props.children}</div>;
}
