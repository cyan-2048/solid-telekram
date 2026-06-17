// this view should have a bunch of tests for dev purposes

import SpatialNavigation from "@/lib/spatial_navigation";
import Content from "@components/Content";
import Header from "@components/Header";
import KaiButton, { ButtonContainer } from "@components/KaiButton";
import RadioInput from "@components/RadioInput";
import TextInput from "@components/TextInput";
import { createSignal, onCleanup, onMount } from "solid-js";
import ListItem from "@components/ListItem";
import { toaster } from "@/utils";
import { $previousView, $proxyMode, $view, setStatusbarColor } from "@/stores";
import * as modals from "./modals";
import Separator from "@components/Separator";
import CheckboxInput from "@components/CheckboxInput";
import TelegramIcon, { TelegramAllIcons } from "@components/TelegramIcon";
import * as styles from "./DebugView.module.scss";
import scrollIntoView from "scroll-into-view-if-needed";

function TestAllIcons() {
	return (
		<div>
			{
				/*@once*/ TelegramAllIcons.map((key) => (
					<div class={/*@once*/ `debug ${styles.icon_item}`} tabIndex={1}>
						<div>{key}:</div>
						<div>
							<TelegramIcon name={key as any} />
						</div>
					</div>
				))
			}
		</div>
	);
}

export default function DebugView() {
	let toastNum = 0;

	onMount(() => {
		SpatialNavigation.add("debug-view", {
			selector: ".debug",
			restrict: "self-only",
		});

		SpatialNavigation.focus("debug-view");

		setStatusbarColor("#0a323f");
	});

	onCleanup(() => {
		SpatialNavigation.remove("debug-view");
	});

	const [radioChecked, setRadioChecked] = createSignal(false);
	const [checkboxChecked, setCheckboxChecked] = createSignal(false);

	return (
		<Content before={<Header>DebugView</Header>}>
			<div
				on:sn-willfocus={(e) => {
					scrollIntoView(e.target, {
						behavior: "smooth",
						scrollMode: "always",
						inline: "center",
					});
				}}
				onKeyDown={(e) => {
					if (e.key == "Backspace") {
						if ("value" in e.target && e.target.value != "") return;
						e.preventDefault();
						$view.set($previousView.get());
					}
				}}
			>
				<Separator>Inputs</Separator>
				<TextInput tabIndex={0} classList={{ debug: true }}></TextInput>
				<RadioInput
					tabIndex={0}
					on:sn-enter-down={() => setRadioChecked(false)}
					classList={{ debug: true }}
					checked={!radioChecked()}
				>
					Radio Input #1
				</RadioInput>
				<RadioInput
					tabIndex={0}
					on:sn-enter-down={() => setRadioChecked(true)}
					classList={{ debug: true }}
					checked={radioChecked()}
				>
					Radio Input #2
				</RadioInput>
				<CheckboxInput
					tabIndex={0}
					on:sn-enter-down={() => setCheckboxChecked((val) => !val)}
					classList={{ debug: true }}
					checked={checkboxChecked()}
					aria-readonly
				>
					Checkbox
				</CheckboxInput>
				<CheckboxInput
					tabIndex={0}
					on:sn-enter-down={() => setCheckboxChecked((val) => !val)}
					classList={{ debug: true }}
					checked={checkboxChecked()}
				>
					Checkbox
				</CheckboxInput>
				<Separator>Disabled Items</Separator>
				<KaiButton tabIndex={0} classList={{ debug: true }} aria-readonly>
					Disabled Button
				</KaiButton>
				<ListItem tabIndex={0} classList={{ debug: true }} aria-readonly indicator>
					Disabled List Item
				</ListItem>
				<ListItem tabIndex={0} classList={{ debug: true }} indicator>
					Normal List Item
				</ListItem>
				<Separator>Buttons</Separator>
				<ButtonContainer>
					<KaiButton
						on:sn-enter-down={() => {
							toaster("Toast #" + ++toastNum);
						}}
						tabIndex={0}
						classList={{ debug: true }}
					>
						Test ++Toast
					</KaiButton>
					<KaiButton
						on:sn-enter-down={async () => {
							const result = await modals.prompt("Text", "Default Value");
							toaster("" + result);
						}}
						tabIndex={0}
						classList={{ debug: true }}
					>
						Test Prompt!
					</KaiButton>
					<KaiButton
						on:sn-enter-down={() => {
							const result = window.prompt("Text", "Default Value");
							toaster("" + result);
						}}
						tabIndex={0}
						classList={{ debug: true }}
					>
						Test System Prompt
					</KaiButton>
					<KaiButton
						on:sn-enter-down={async () => {
							const result = await modals.alert("Text");
							toaster("" + result);
						}}
						tabIndex={0}
						classList={{ debug: true }}
					>
						Test Alert
					</KaiButton>
					<KaiButton
						on:sn-enter-down={() => {
							const result = window.alert("Text");
							toaster("" + result);
						}}
						tabIndex={0}
						classList={{ debug: true }}
					>
						Test System Alert
					</KaiButton>
					<KaiButton
						on:sn-enter-down={async () => {
							const result = await modals.confirm("Text");
							toaster("" + result);
						}}
						tabIndex={0}
						classList={{ debug: true }}
					>
						Test Confirm
					</KaiButton>
					<KaiButton
						on:sn-enter-down={() => {
							const result = window.confirm("Text");
							toaster("" + result);
						}}
						tabIndex={0}
						classList={{ debug: true }}
					>
						Test System Confirm
					</KaiButton>
					<KaiButton
						on:sn-enter-down={() => {
							location.reload();
						}}
						tabIndex={0}
						classList={{ debug: true }}
					>
						Reload App
					</KaiButton>
				</ButtonContainer>
				<Separator>Debug</Separator>
				<CheckboxInput
					tabIndex={0}
					on:sn-enter-down={() => {
						if ($proxyMode.get() == "sync") {
							$proxyMode.set("none");
						} else {
							$proxyMode.set("sync");
						}

						location.reload();
					}}
					checked={$proxyMode.get() == "sync"}
					classList={{ debug: true }}
				>
					Use sync transport
				</CheckboxInput>
				<CheckboxInput
					tabIndex={0}
					on:sn-enter-down={() => {
						if (localStorage.getItem("CLOUDPHONE_MODE") === "true") {
							localStorage.removeItem("CLOUDPHONE_MODE");
						} else {
							localStorage.setItem("CLOUDPHONE_MODE", "true");
						}

						location.reload();
					}}
					checked={localStorage.getItem("CLOUDPHONE_MODE") === "true"}
					classList={{ debug: true }}
				>
					Cloudphone Mode
				</CheckboxInput>
				<Separator>Telegram Icons</Separator>
				<TestAllIcons></TestAllIcons>
			</div>
		</Content>
	);
}
