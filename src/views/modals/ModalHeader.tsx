import type { JSXElement } from "solid-js";
import * as styles from "./ModalHeader.module.scss";

export default function ModalHeader(props: { children: JSXElement }) {
	return <div class={styles.header}>{props.children}</div>;
}
