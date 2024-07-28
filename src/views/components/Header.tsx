import { JSXElement } from "solid-js";
import styles from "./Header.module.scss";

export default function Header(props: { children: JSXElement }) {
	return <div class={styles.header}>{props.children}</div>;
}
