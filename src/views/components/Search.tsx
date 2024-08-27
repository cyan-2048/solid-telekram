import { ComponentProps, createSignal, splitProps, JSX } from "solid-js";
import styles from "./Search.module.scss";

export default function Search(
	props: Omit<ComponentProps<"input">, "onFocus" | "onBlur"> & {
		onFocus?: JSX.FocusEventHandler<HTMLInputElement, FocusEvent>;
		onBlur?: JSX.FocusEventHandler<HTMLInputElement, FocusEvent>;
	}
) {
	const [local, rest] = splitProps(props, ["onFocus", "onBlur"]);

	const [focused, setFocused] = createSignal(false);

	return (
		<div classList={{ [styles.search_wrap]: true, [styles.focused]: focused() }}>
			<div>
				<svg viewBox="0 0 18 18">
					<path d="M11.625 10.5h-.592l-.21-.203A4.853 4.853 0 0012 7.125 4.875 4.875 0 107.125 12a4.853 4.853 0 003.172-1.178l.203.21v.593l3.75 3.742 1.117-1.117-3.742-3.75zm-4.5 0A3.37 3.37 0 013.75 7.125 3.37 3.37 0 017.125 3.75 3.37 3.37 0 0110.5 7.125 3.37 3.37 0 017.125 10.5z"></path>
				</svg>
				<input
					{...rest}
					onFocus={(e) => {
						setFocused(true);
						local.onFocus?.(e);
					}}
					onBlur={(e) => {
						setFocused(false);
						local.onBlur?.(e);
					}}
					onKeyDown={(e) => {
						if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
							e.stopImmediatePropagation();
							e.stopPropagation();
						}
					}}
				></input>
			</div>
		</div>
	);
}
