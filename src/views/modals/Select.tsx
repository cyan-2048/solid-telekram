import * as styles from "./Alert.module.scss";
import * as softkeys from "@components/Softkeys.module.scss";
import ModalContainer from "./ModalContainer";
import ModalHeader from "./ModalHeader";
import { createUniqueId, For, onCleanup, onMount } from "solid-js";
import { sleep } from "@/helpers";
import SpatialNavigation from "@/lib/spatial_navigation";
import scrollIntoView from "scroll-into-view-if-needed";

export default function Select(props: {
	items: [string, any][];
	selected: any;
	onClose: (val: any) => void;
	title: string;
}) {
	let lastFocusedElement!: HTMLElement;

	const SN_ID = createUniqueId();

	onMount(() => {
		lastFocusedElement = document.activeElement as HTMLElement;
		// console.log("lastFocusedElement", lastFocusedElement);
		SpatialNavigation.add(SN_ID, {
			selector: "." + SN_ID,
			restrict: "self-only",
			defaultElement: "." + styles.selected,
		});

		SpatialNavigation.focus(SN_ID);
	});

	let clean = false;

	onCleanup(() => {
		clean = true;
		SpatialNavigation.remove(SN_ID);
		lastFocusedElement?.focus();
	});

	let shouldClose = false;

	return (
		<ModalContainer select>
			<ModalHeader>{props.title || "Select"}</ModalHeader>
			<div
				onKeyUp={() => {
					if (shouldClose) {
						props.onClose(null);
					}
				}}
				onKeyDown={(e) => {
					if (e.key == "Enter" || e.key.startsWith("Arrow")) return;

					e.stopImmediatePropagation();
					e.stopPropagation();

					if (e.key == "SoftLeft" || e.key == "Backspace" || e.key == "EndCall") {
						e.preventDefault();
						shouldClose = true;
					}
				}}
				class={styles.select}
				on:sn-willfocus={(e) => {
					scrollIntoView(e.target, {
						scrollMode: "if-needed",
						block: "nearest",
						inline: "nearest",
					});
				}}
				on:sn-navigatefailed={(e) => {
					const direction = e.detail.direction;

					if (direction == "up" || direction == "down") {
						const target = e.target as HTMLElement;
						const elements = target.parentElement!.children;

						let nextFocus: HTMLElement;
						if (direction == "up") {
							nextFocus = elements[elements.length - 1] as HTMLElement;
						} else {
							nextFocus = elements[0] as HTMLElement;
						}

						scrollIntoView(nextFocus, {
							scrollMode: "if-needed",
							block: "nearest",
							inline: "nearest",
						});

						nextFocus.focus();
					}
				}}
			>
				<For each={props.items}>
					{([text, value]) => (
						<div
							classList={{ [SN_ID]: true, [styles.selected]: value === props.selected, [styles.item]: true }}
							tabIndex={-1}
							on:sn-enter-up={() => {
								props.onClose(value);
							}}
							onBlur={(e) => {
								const target = e.currentTarget;
								if (!clean) {
									sleep().then(() => {
										if (!document.activeElement?.classList.contains(SN_ID)) target.focus();
									});
								}
							}}
						>
							{text}
						</div>
					)}
				</For>
			</div>
			<div classList={{ [softkeys.softkeys]: true, [styles.softkeys]: true }}>
				<div classList={{ [softkeys.current]: true, [softkeys.black]: true }}>
					<div>Cancel</div>
					<div>SELECT</div>
				</div>
			</div>
		</ModalContainer>
	);
}
