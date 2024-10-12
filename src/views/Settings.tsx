import { JSXElement, onCleanup, onMount } from "solid-js";
import Content from "./components/Content";
import Header from "./components/Header";
import styles from "./Settings.module.scss";
import SpatialNavigation from "@/lib/spatial_navigation";
import { sleep } from "@/lib/utils";
import { client } from "@signals";
import scrollIntoView from "scroll-into-view-if-needed";
import { manuallySubscribePushNotification } from "@/lib/pushNotifications";

function SettingsItem(props: { children: JSXElement; onEnterDown?: () => void }) {
	return (
		<div
			on:sn-enter-down={props.onEnterDown}
			on:sn-willfocus={(e) => {
				scrollIntoView(e.currentTarget, {
					scrollMode: "if-needed",
					block: "nearest",
					inline: "nearest",
				});
			}}
			tabIndex={-1}
			class={styles.item}
		>
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
				{/* <SettingsItem>Proxy</SettingsItem> */}
				<SettingsItem
					onEnterDown={async () => {
						const tg = client()!;

						await sleep(100);

						const sure = confirm("Are you sure you want to logout?");

						if (!sure) return;

						const success = await tg.logOut();
						if (!success) {
							alert("Logout was not successful!");
							await tg.storage.clear(true);
						}
						location.reload();
					}}
				>
					Logout
				</SettingsItem>
				<SettingsItem
					onEnterDown={async () => {
						const result = await manuallySubscribePushNotification(client()!);
						alert(result ? "Sucessfully toggled Push Notifications." : "Something went wrong. :(");
					}}
				>
					Toggle Push Notifications
				</SettingsItem>
				{/* <SettingsItem>About</SettingsItem> */}
			</div>
		</Content>
	);
}
