import { JSXElement, onMount } from "solid-js";
import Content from "./components/Content";
import Header from "./components/Header";
import styles from "./Settings.module.scss";

function SettingsItem(props: { children: JSXElement }) {
	return (
		<div tabIndex={-1} class={styles.item}>
			{props.children}
		</div>
	);
}

export default function Settings(props: { onClose: () => void }) {
	onMount(() => {});

	return (
		<Content before={<Header>Settings</Header>}>
			<div style={{ "background-color": "white", height: "100%" }}>
				<SettingsItem>Proxy</SettingsItem>
				<SettingsItem>Logout</SettingsItem>
				<SettingsItem>About</SettingsItem>
			</div>
		</Content>
	);
}
