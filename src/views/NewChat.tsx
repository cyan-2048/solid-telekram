import styles from "./NewChat.module.scss";

import { JSXElement, onCleanup, onMount } from "solid-js";
import Content from "./components/Content";
import Header from "./components/Header";
import SpatialNavigation from "@/lib/spatial_navigation";
import { sleep } from "@/lib/utils";
import { cachedContacts, client, setCachedContacts, setSoftkeys, setStatusbarColor } from "@signals";
import scrollIntoView from "scroll-into-view-if-needed";
import Search from "./components/Search";

export default function NewChat(props: { onClose: () => void }) {
	onMount(async () => {
		SpatialNavigation.add("new_chat", {
			selector: "." + styles.item,
			restrict: "self-only",
		});

		SpatialNavigation.focus("new_chat");

		setStatusbarColor("#0a323f");

		if (!cachedContacts().length) {
			await sleep();
			setCachedContacts(await client()!.getContacts());
		}
	});

	onCleanup(() => {
		SpatialNavigation.remove("new_chat");
	});

	return (
		<Content before={<Header>New chat{cachedContacts().length ? ` (${cachedContacts().length})` : ""}</Header>}>
			<div
				onKeyDown={(e) => {
					if (e.key == "SoftLeft") {
						props.onClose();
					}

					if (e.key == "Backspace") {
						const actEl = document.activeElement as HTMLInputElement;

						if (actEl?.tagName == "INPUT" && actEl.value != "") {
							return;
						}

						e.preventDefault();
						props.onClose();
					}
				}}
				style={{ "background-color": "white", height: "100%" }}
			>
				{/* <SettingsItem>Proxy</SettingsItem> */}
				<Search
					class={styles.item}
					onFocus={() => {
						setSoftkeys("Cancel", "", "tg:more");
					}}
					placeholder="Search"
				></Search>
				{/* <SettingsItem>About</SettingsItem> */}
			</div>
		</Content>
	);
}
