import { ComponentProps, splitProps } from "solid-js";
import * as styles from "./AutoResizeTextarea.module.scss";

export default function NonResizeTextarea(props: ComponentProps<"input">) {
	const [, _props] = splitProps(props, ["type"]);

	return (
		<div class={styles.container}>
			<input {..._props} type="text" />
		</div>
	);
}
