import { ComponentProps, createSignal, splitProps, JSX } from "solid-js";

import * as styles from "./TextInput.module.scss";

export default function TextInput(
	props: Omit<ComponentProps<"input">, "onFocus" | "onBlur"> & {
		onFocus?: JSX.FocusEventHandler<HTMLInputElement, FocusEvent>;
		onBlur?: JSX.FocusEventHandler<HTMLInputElement, FocusEvent>;
		label?: JSX.Element;
		parentClassList?: Record<string, boolean | undefined>;
		invalid?: boolean;
		/**
		 * attempts to set the caret/cursor position to the end
		 * selectionStart will be set when focused for the first time
		 * only use when necessary
		 */
		caretEnd?: boolean;
		focused?: boolean;
	}
) {
	let pushed = false;

	const [local, rest] = splitProps(props, [
		"onFocus",
		"onBlur",
		"onKeyDown",
		"label",
		"parentClassList",
		"invalid",
		"caretEnd",
	]);

	const [focused, setFocused] = createSignal(false);

	return (
		<div
			classList={{
				...local.parentClassList,
				[styles.text_input]: true,
				[styles.focused]: props.focused || focused(),
				[styles.invalid]: props.invalid,
			}}
		>
			<label>{props.label}</label>
			<input
				{...rest}
				onFocus={(e) => {
					setFocused(true);
					if (!pushed && local.caretEnd) {
						pushed = true;
						e.currentTarget.selectionStart = e.currentTarget.value.length;
					}
					local.onFocus?.(e);
				}}
				onBlur={(e) => {
					setFocused(false);
					local.onBlur?.(e);
				}}
				onKeyDown={(e) => {
					if (typeof local.onKeyDown == "function") {
						local.onKeyDown(e);
					}

					if (e.currentTarget.value !== "" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
						e.stopImmediatePropagation();
						e.stopPropagation();
					}
				}}
			>
				test input
			</input>
		</div>
	);
}
