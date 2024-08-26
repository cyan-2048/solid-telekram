import { JSXElement } from "solid-js";
import styles from "./Separator.module.scss";

export default function Separator(props: { children: JSXElement }) {
	return <div class={styles.separator}>{props.children}</div>;
}
