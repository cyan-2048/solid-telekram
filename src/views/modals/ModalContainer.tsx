import { JSXElement } from "solid-js";
import * as styles from "./ModalContainer.module.scss";

export default function ModalContainer(props: { select?: boolean; children: JSXElement }) {
	return (
		<div class={styles.wrap}>
			<div classList={{ [styles.container]: true, [styles.select]: props.select }}>{props.children}</div>
		</div>
	);
}
