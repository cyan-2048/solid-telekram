import { JSXElement } from "solid-js";
import styles from "./OptionsMenuMaxHeight.module.scss";

export default function OptionsMenuMaxHeight(props: { children: JSXElement }) {
	return <div class={styles.content}>{props.children}</div>;
}
