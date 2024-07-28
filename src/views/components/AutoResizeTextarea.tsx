import { batch, ComponentProps, createEffect, createSignal, splitProps } from "solid-js";
import styles from "./AutoResizeTextarea.module.scss";
import { getTextFromContentEditable } from "@/lib/utils";

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
				{..._props}
				contentEditable
			>
				<br />
			</pre>
		</div>
	);
}
