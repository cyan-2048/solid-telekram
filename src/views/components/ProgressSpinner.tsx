import { ComponentProps, splitProps } from "solid-js";
import styles from "./ProgressSpinner.module.scss";

export default function ProgressSpinner(
	props: {
		/**
		 * should be 1-100
		 */
		progress: number;
		size: number;
		/**
		 * whether to show the close icon or not
		 */
		showClose?: boolean;
	} & ComponentProps<"div">
) {
	const [local, rest] = splitProps(props, ["progress", "size", "showClose"]);

	return (
		<div {...rest}>
			<div
				style={{
					width: props.size + "px",
					height: props.size + "px",
				}}
				class={styles.spinner_container}
			>
				<div class={styles.you_spin_me_right_round_baby_right_round}>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="27 27 54 54">
						<circle
							class={styles.path}
							cx="54"
							cy="54"
							r="24"
							fill="rgba(0,0,0,0)"
							stroke-miterlimit="10"
							style={`stroke-dasharray: ${149.825 * (local.progress / 100)}px, 149.825px;`}
						></circle>
					</svg>
				</div>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
					<g fill="none" fill-rule="evenodd">
						<polygon points="0 0 24 0 24 24 0 24"></polygon>
						<path
							fill="currentColor"
							fill-rule="nonzero"
							d="M5.20970461,5.38710056 L5.29289322,5.29289322 C5.65337718,4.93240926 6.22060824,4.90467972 6.61289944,5.20970461 L6.70710678,5.29289322 L12,10.585 L17.2928932,5.29289322 C17.6834175,4.90236893 18.3165825,4.90236893 18.7071068,5.29289322 C19.0976311,5.68341751 19.0976311,6.31658249 18.7071068,6.70710678 L13.415,12 L18.7071068,17.2928932 C19.0675907,17.6533772 19.0953203,18.2206082 18.7902954,18.6128994 L18.7071068,18.7071068 C18.3466228,19.0675907 17.7793918,19.0953203 17.3871006,18.7902954 L17.2928932,18.7071068 L12,13.415 L6.70710678,18.7071068 C6.31658249,19.0976311 5.68341751,19.0976311 5.29289322,18.7071068 C4.90236893,18.3165825 4.90236893,17.6834175 5.29289322,17.2928932 L10.585,12 L5.29289322,6.70710678 C4.93240926,6.34662282 4.90467972,5.77939176 5.20970461,5.38710056 L5.29289322,5.29289322 L5.20970461,5.38710056 Z"
						></path>
					</g>
				</svg>
			</div>
		</div>
	);
}
