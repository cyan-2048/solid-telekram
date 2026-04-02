import { mergeProps } from "solid-js";
import * as styles from "./ProgressRing.module.scss";

export default function ProgressRing(_props: { width?: number; height?: number }) {
	const props = mergeProps({ width: 24, height: 24 }, _props);

	return (
		<svg class={styles.progressRing} {...props} viewBox="0 0 16 16">
			<circle cx="8px" cy="8px" r="7px"></circle>
		</svg>
	);
}
