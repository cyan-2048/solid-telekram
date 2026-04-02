import { ComponentProps, createSignal, splitProps } from "solid-js";
import * as styles from "./AutoResizeTextarea.module.scss";
import { getTextFromContentEditable, typeInTextbox } from "@utils";

export default function AutoResizeTextbox(
	props: ComponentProps<"pre"> & {
		placeholder?: string;
	}
) {
	const [local, _props] = splitProps(props, ["onInput", "placeholder"]);

	const [show, setShow] = createSignal(true);

	return (
		<div
			class={styles.container}
			style={
				props.placeholder && show()
					? {
							"--placeholder": `"${props.placeholder}"`,
					  }
					: undefined
			}
		>
			<pre
				onInput={(e) => {
					if (typeof local.onInput == "function") {
						local.onInput(e);
					}

					const target = e.currentTarget;

					setShow(!getTextFromContentEditable(target));
				}}
				// might be useful for KaiOS 4.0
				onPaste={(e) => {
					// prevent default paste behavior
					e.preventDefault();

					const target = e.currentTarget;

					const text = e.clipboardData?.getData("text/plain");

					if (text) {
						typeInTextbox(text, target);
					}
				}}
				{..._props}
				contentEditable
			>
				<br />
			</pre>
		</div>
	);
}
