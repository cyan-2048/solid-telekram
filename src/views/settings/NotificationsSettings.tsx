import SpatialNavigation from "@/lib/spatial_navigation";
import { setSoftkeys, sleep } from "@/utils";
import { onMount, onCleanup, createSignal, createEffect } from "solid-js";
import CheckboxInput from "@components/CheckboxInput";
import Content from "@components/Content";
import Header from "@components/Header";
import KaiDescriptionItem from "@components/KaiDescriptionItem";
import {
	checkState,
	manuallyUnsubscribePushNotification,
	manuallySubscribePushNotification,
	setNotoColorEmojiFix,
} from "@/workers/pushNotifications";

const SN_ID = "settings-notif";

let cachedIsEnabled = false;

let promise: Promise<any> = Promise.resolve();

async function forceDisable() {
	manuallyUnsubscribePushNotification().catch(() => null);
}

async function forceEnable() {
	let enabled = false;
	let attempts = 0;
	while (!enabled) {
		if (attempts > 10) break;
		enabled = await manuallySubscribePushNotification();
		if (!enabled) await sleep(500);
		attempts++;
	}
	return enabled;
}

export default function NotificationsSettings(props: { onClose: () => void }) {
	const [loading, setLoading] = createSignal(true);
	const [enabled, setEnabled] = createSignal(cachedIsEnabled);

	let spanRef!: HTMLSpanElement;

	let canUseKeyboard = false;

	onMount(() => {
		SpatialNavigation.add(SN_ID, {
			selector: `.notif-settings [tabindex]`,
			restrict: "self-only",
		});

		SpatialNavigation.focus(SN_ID);

		promise.then(() =>
			checkState().then((enabled) => {
				setLoading(false);
				setEnabled((cachedIsEnabled = enabled));
			}),
		);

		setTimeout(() => {
			canUseKeyboard = true;
		}, 100);
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
	});

	createEffect(() => {
		setSoftkeys("Cancel", loading() ? "" : "SELECT", "");
	});

	return (
		<>
			<Content
				mainStyle={{
					background: "#fff",
				}}
				before={<Header>Notifications</Header>}
			>
				<div
					style={{
						"pointer-events": "none",
						position: "fixed",
						top: 0,
						left: 0,
						opacity: 0,
					}}
				>
					<span ref={spanRef} style={{ "font-family": "KaiOS Emoji" }}>
						💎
					</span>
				</div>
				<div
					class="notif-settings"
					onKeyDown={(e) => {
						e.preventDefault();

						if (!canUseKeyboard) return;

						if (e.key == "ArrowUp" || e.key == "ArrowDown") {
							const parent = e.currentTarget.parentElement!;

							parent.scrollTop += e.key == "ArrowUp" ? -50 : 50;
						}

						if (e.key == "Backspace" || e.key == "SoftLeft") {
							props.onClose();
						}
					}}
				>
					<CheckboxInput
						on:sn-enter-down={async () => {
							if (!canUseKeyboard) return;

							if (loading()) return;

							setLoading(true);

							// on KaiOS 2.5.4+ Noto Color Emoji is broken
							// not sure if needed for KaiOS 3.0+
							spanRef.style.fontFamily = "KaiOS Emoji";
							const fontSizeA = spanRef.offsetHeight;
							// globalThis.console.log("[1]", fontSizeA);
							spanRef.style.fontFamily = "Noto Color Emoji";
							const fontSizeB = spanRef.offsetHeight;
							// globalThis.console.log("[2]", fontSizeB);
							const notoColorEmojiDetected = fontSizeB != fontSizeA;
							// globalThis.console.log("[3] Noto Color Emoji detected?", notoColorEmojiDetected);
							spanRef.style.fontFamily = "KaiOS Emoji";

							await setNotoColorEmojiFix(notoColorEmojiDetected);

							if (import.meta.env.DEV) {
								promise = sleep(2000);
								await promise;
								setEnabled((a) => (cachedIsEnabled = !a));
								setLoading(false);
								return;
							}

							if (enabled()) {
								promise = forceDisable();
								await promise;
								setEnabled(false);
								setLoading(false);
							} else {
								const result = forceEnable();
								promise = result;
								setEnabled(await result);
								setLoading(false);
							}
						}}
						aria-readonly={loading()}
						checked={enabled()}
						tabIndex={0}
					>
						Push Notifications
					</CheckboxInput>
					<KaiDescriptionItem>
						If notifications stop working or the app updates, you must toggle notifications off and on. This forces the
						app to re-register for push notifications.
					</KaiDescriptionItem>
				</div>
			</Content>
		</>
	);
}
