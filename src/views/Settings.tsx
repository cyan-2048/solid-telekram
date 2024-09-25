import { JSXElement, onCleanup, onMount } from "solid-js";
import Content from "./components/Content";
import Header from "./components/Header";
import styles from "./Settings.module.scss";
import SpatialNavigation from "@/lib/spatial_navigation";

function SettingsItem(props: { children: JSXElement }) {
	return (
		<div tabIndex={-1} class={styles.item}>
			{props.children}
		</div>
	);
}

export default function Settings(props: { onClose: () => void }) {
	onMount(() => {
		SpatialNavigation.add("settings", {
			selector: "." + styles.item,
			restrict: "self-only",
		});

		SpatialNavigation.focus("settings");
	});

	onCleanup(() => {
		SpatialNavigation.remove("settings");
	});

	return (
		<Content before={<Header>Settings</Header>}>
			<div
				onKeyDown={(e) => {
					if (e.key == "Backspace") {
						e.preventDefault();
						props.onClose();
					}
				}}
				style={{ "background-color": "white", height: "100%" }}
			>
				<SettingsItem>Proxy</SettingsItem>
				<SettingsItem>Logout</SettingsItem>
				<SettingsItem>About</SettingsItem>
			</div>
		</Content>
	);
}
