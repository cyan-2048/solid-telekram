import * as styles from "./Settings.module.scss";

import { createMemo, createSignal, createUniqueId, lazy, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { useStore } from "@nanostores/solid";

import { logOut } from "@globals";
import { confirm, select } from "../modals";
import { setSoftkeys, toaster, sleep } from "@/utils";
import { cloudphone } from "@/config";
import { clearCache } from "@/lib/storage";
import { $proxyMode, $sendByEnter, $storage, $view, setStatusbarColor } from "@/stores";

import Content from "@components/Content";
import Header from "@components/Header";
import KaiButton from "@components/KaiButton";
import CheckboxInput from "@components/CheckboxInput";
import ListItem from "@components/ListItem";

import SpatialNavigation from "@/lib/spatial_navigation";
import scrollIntoView from "scroll-into-view-if-needed";
import { isDeviceStorageSupportedAsync } from "@/lib/storage/device";

const WallpaperSettings = lazy(() => import("./WallpaperSettings"));
const ProxySettings = lazy(() => import("./ProxySettings"));
const NotificationsSettings = lazy(() => import("./NotificationsSettings"));

function updateSoftkeys() {
	setSoftkeys("", "SELECT", "");
}

function switchStorage(_storage: ReturnType<typeof $storage.get>) {
	switch (_storage) {
		case "caches":
			return "Cache Storage";
		case "localforage":
			return "Indexed DB";
		case "device":
			return "Device Storage";
	}
}

function DataSettings(props: { onClose: () => void }) {
	const SN_ID = createUniqueId();

	const storage = useStore($storage);

	const appStorage = createMemo(() => {
		return switchStorage(storage());
	});

	onMount(() => {
		SpatialNavigation.add(SN_ID, {
			selector: "." + SN_ID,
			restrict: "self-only",
		});

		SpatialNavigation.focus(SN_ID);
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
	});

	return (
		<Content before={<Header>Application data</Header>}>
			<div
				onKeyDown={(e) => {
					if (e.key == "Backspace" || (e.key == "SoftLeft" && cloudphone)) {
						e.preventDefault();
						props.onClose();
					}
				}}
				style={{ "background-color": "white", height: "100%" }}
			>
				<ListItem
					classList={{
						[SN_ID]: true,
					}}
					tabIndex={0}
					on:sn-enter-down={async () => {
						const supported = await isDeviceStorageSupportedAsync();
						const result = await select(
							(["caches", "localforage", supported ? "device" : null] as const)
								.filter((a) => a != null)
								.map((a) => [switchStorage(a), a]),
							$storage.get(),
						);

						if (result) {
							$storage.set(result);
						}
					}}
					subtext={appStorage()}
				>
					Storage location
				</ListItem>
				<KaiButton
					classList={{
						[styles.item]: true,
						[SN_ID]: true,
					}}
					tabIndex={0}
					on:sn-enter-down={() => {
						clearCache().then(() => {
							toaster("Cache cleared successfully!");
						});
					}}
				>
					Clear Cache
				</KaiButton>
			</div>
		</Content>
	);
}

export default function Settings(props: { onClose: () => void }) {
	const items = createUniqueId();

	onMount(() => {
		SpatialNavigation.add("settings", {
			selector: "." + items,
			restrict: "self-only",
			rememberSource: true,
		});

		SpatialNavigation.focus("settings");

		updateSoftkeys();

		setStatusbarColor("#0a323f");
	});

	onCleanup(() => {
		SpatialNavigation.remove("settings");
	});

	const [showProxySettings, setShowProxySettings] = createSignal(false);
	const [showWallpaperSettings, setShowWallpaperSettings] = createSignal(false);
	const [showDataSettings, setShowDataSettings] = createSignal(false);
	const [showNotificationsSettings, setShowNotificationsSettings] = createSignal(false);

	const sendByEnter = useStore($sendByEnter);
	const proxyMode = useStore($proxyMode);

	return (
		<>
			<Content before={<Header>Settings</Header>}>
				<div
					onKeyDown={(e) => {
						if (e.key == "Backspace" || (e.key == "SoftLeft" && cloudphone)) {
							e.preventDefault();
							props.onClose();
						}
					}}
					on:sn-willfocus={(e) => {
						scrollIntoView(e.target.tagName == "BUTTON" ? e.target.parentElement! : e.target, {
							scrollMode: "if-needed",
							block: "nearest",
							inline: "nearest",
						});
					}}
					style={{ "background-color": "white", height: "100%" }}
				>
					<Show when={!cloudphone}>
						{/* send by enter isn't possible on cloudphone */}
						<CheckboxInput
							on:sn-enter-down={() => {
								$sendByEnter.set(!$sendByEnter.get());
							}}
							tabIndex={0}
							classList={{ [styles.item]: true, [items]: true }}
							checked={sendByEnter()}
						>
							Send by Enter
						</CheckboxInput>
						<ListItem
							on:sn-enter-down={() => {
								setShowNotificationsSettings(true);
							}}
							on:sn-focused={() => {
								NotificationsSettings.preload();
							}}
							focusable
							classList={{ [styles.item]: true, [items]: true }}
							indicator
						>
							Notifications
						</ListItem>
						{/* proxy is only available on KaiOS */}
						<ListItem
							focusable
							on:sn-enter-down={() => {
								setShowProxySettings(true);
							}}
							on:sn-focused={() => {
								NotificationsSettings.preload();
							}}
							classList={{ [styles.item]: true, [items]: true }}
							subtext={proxyMode() == "none" ? "Disabled" : "Enabled"}
							indicator
						>
							Proxy Settings
						</ListItem>
					</Show>
					<ListItem
						on:sn-enter-down={() => {
							setShowWallpaperSettings(true);
						}}
						on:sn-focused={() => {
							WallpaperSettings.preload();
						}}
						focusable
						classList={{ [styles.item]: true, [items]: true }}
						indicator
					>
						Chat Wallpaper
					</ListItem>
					<ListItem
						on:sn-enter-down={() => {
							setShowDataSettings(true);
						}}
						focusable
						classList={{ [styles.item]: true, [items]: true }}
						indicator
					>
						Data and Storage
					</ListItem>
					<KaiButton
						classList={{
							[styles.item]: true,
							[items]: true,
						}}
						tabIndex={0}
						on:sn-enter-down={async () => {
							await sleep(100);

							const sure = await confirm("Are you sure you want to log out?");

							if (!sure) return;

							logOut();
						}}
						onKeyDown={async (e) => {
							await sleep(10);
							if (e.key == "*") {
								$view.set("debug");
							}
						}}
					>
						Log Out
					</KaiButton>
				</div>
			</Content>
			<Show when={showProxySettings()}>
				<Portal>
					<ProxySettings
						onCancel={() => {
							setShowProxySettings(false);
							SpatialNavigation.focus("settings");
							updateSoftkeys();
						}}
					></ProxySettings>
				</Portal>
			</Show>
			<Show when={showWallpaperSettings()}>
				<Portal>
					<WallpaperSettings
						onClose={() => {
							setShowWallpaperSettings(false);
							SpatialNavigation.focus("settings");
							updateSoftkeys();
						}}
					></WallpaperSettings>
				</Portal>
			</Show>
			<Show when={showDataSettings()}>
				<Portal>
					<DataSettings
						onClose={() => {
							setShowDataSettings(false);
							SpatialNavigation.focus("settings");
							updateSoftkeys();
						}}
					></DataSettings>
				</Portal>
			</Show>
			<Show when={showNotificationsSettings()}>
				<Portal>
					<NotificationsSettings
						onClose={() => {
							setShowNotificationsSettings(false);
							SpatialNavigation.focus("settings");
							updateSoftkeys();
						}}
					></NotificationsSettings>
				</Portal>
			</Show>
		</>
	);
}
