import SpatialNavigation from "@/lib/spatial_navigation";
import { $wallpaper, $wallpaper_color, DEFAULT_WALLPAPER, setStatusbarColor } from "@/stores";
import { onMount, onCleanup, Show, createSignal, batch, lazy } from "solid-js";
import Content from "@components/Content";
import Header from "@components/Header";
import KaiButton, { ButtonContainer } from "@components/KaiButton";
import * as styles from "./WallpaperSettings.module.scss";
import * as stylesMessage from "../room/MessageItem.module.scss";
import { setSoftkeys, sleep, WALLPAPER_AVERAGE_COLORS } from "@/utils";
import { useStore } from "@nanostores/solid";
import scrollIntoView from "scroll-into-view-if-needed";
import { Portal } from "solid-js/web";
import TextInput from "@components/TextInput";

const Wallpapers = lazy(() => import("./Wallpapers"));

//#region tweb k code

const rgbRegExp =
	/^(?:rgb)?\(?([01]?\d\d?|2[0-4]\d|25[0-5])(?:\W+)([01]?\d\d?|2[0-4]\d|25[0-5])\W+(?:([01]?\d\d?|2[0-4]\d|25[0-5])\)?)$/;

function componentToHex(c: number) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r: number, g: number, b: number) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

//#endregion

function hexToRgb(hex: string) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
}

function onFocus(e: { currentTarget: HTMLElement }, always = false) {
	scrollIntoView(e.currentTarget, {
		scrollMode: always ? "always" : "if-needed",
		block: "center",
		skipOverflowHiddenElements: false,
		behavior: "smooth",
	});
}

export default function WallpaperSettings(props: { onClose: () => void }) {
	onMount(() => {
		SpatialNavigation.add("wallpaper-settings", {
			selector: "." + styles.wallpaper_settings + " button[tabindex], " + "." + styles.wallpaper_settings + " input",
			restrict: "self-only",
			defaultElement: ".default",
		});

		SpatialNavigation.add("wallpaper-settings-1", {
			selector: "." + styles.preview_messages + " [tabindex]",
			restrict: "self-only",
		});

		SpatialNavigation.focus("wallpaper-settings");

		setSoftkeys("Cancel", "SELECT", "");

		setStatusbarColor("#0a323f");
	});

	onCleanup(() => {
		SpatialNavigation.remove("wallpaper-settings");
		SpatialNavigation.remove("wallpaper-settings-1");
	});

	const wallpaper = useStore($wallpaper);

	const [showWallpapers, setShowWallpapers] = createSignal(false);
	const [showColorPicker, setShowColorPicker] = createSignal(false);

	const [rgb, setRgb] = createSignal("");
	const [hex, setHex] = createSignal("");

	const [rgbInvalid, setRgbInvalid] = createSignal(false);
	const [hexInvalid, setHexInvalid] = createSignal(false);

	function initColors() {
		const color = $wallpaper_color.get();

		batch(() => {
			setHex(color);
			setRgb(hexToRgb(color)!.join(", "));
		});
	}

	function setDefaultSoftkeys() {
		setSoftkeys("Cancel", "SELECT", "");
	}

	return (
		<>
			<Content before={<Header>{showColorPicker() ? "Set a color" : "Chat Wallpaper"}</Header>}>
				<div
					class={styles.wallpaper_settings}
					on:sn-navigatefailed={(e) => {
						if (e.detail.direction == "up") {
							SpatialNavigation.focus("wallpaper-settings-1");
						}
					}}
					onKeyDown={(e) => {
						if (e.key == "Backspace" || e.key == "SoftLeft") {
							if (e.key == "Backspace" && "value" in e.target && e.target.value !== "") return;
							e.preventDefault();

							if (showColorPicker()) {
								setShowColorPicker(false);
								SpatialNavigation.focus("wallpaper-settings");

								setRgbInvalid(false);
								setHexInvalid(false);
								return;
							}
							props.onClose();
						}
					}}
				>
					<div class={styles.preview}>
						<Show
							when={showColorPicker()}
							fallback={
								<Show when={typeof wallpaper() == "number"}>
									<div
										class={styles.wallpaper_image}
										style={{
											"background-image": `var(--wallpaper)`,
											"background-color": WALLPAPER_AVERAGE_COLORS[wallpaper() as number],
										}}
									></div>
								</Show>
							}
						>
							<div
								class={styles.wallpaper_image}
								style={{
									"background-color": hex(),
								}}
							></div>
						</Show>

						<div
							class={styles.preview_messages}
							on:sn-willfocus={() => {
								setSoftkeys("Cancel", "", "");
							}}
						>
							<div class={stylesMessage.action_message}>
								<div class={stylesMessage.action_message_inner}>TODAY</div>
							</div>
							<div class={stylesMessage.message} on:sn-willfocus={(e) => onFocus(e, true)} tabIndex={0}>
								<div classList={{ [stylesMessage.message_inner]: true, [stylesMessage.tail]: true }}>
									<div class={stylesMessage.username}>
										<div class={stylesMessage.username_inner}>
											<span>Cyan</span>
										</div>
									</div>
									<div class={stylesMessage.text_container}>Hi there! found any bugs?</div>
								</div>
							</div>
							<div
								class={stylesMessage.message}
								on:sn-navigatefailed={(e) => {
									if (e.detail.direction == "down") {
										SpatialNavigation.focus("wallpaper-settings");
									}
								}}
								on:sn-willfocus={onFocus}
								tabIndex={0}
							>
								<div
									classList={{
										[stylesMessage.message_inner]: true,
										[stylesMessage.tail]: true,
										[stylesMessage.outgoing]: true,
									}}
								>
									<div class={stylesMessage.reply}>
										<div class={stylesMessage.reply_border}></div>
										<div class={stylesMessage.reply_details}>
											<div class={stylesMessage.reply_username}>
												<span>Cyan</span>
											</div>
											<div class={stylesMessage.reply_text}>
												<span>Hi there! found any bugs?</span>
											</div>
										</div>
									</div>
									<div class={stylesMessage.text_container}>Not yet...</div>
								</div>
							</div>
						</div>
					</div>
					<Show
						when={showColorPicker()}
						fallback={
							<ButtonContainer>
								<KaiButton
									on:sn-willfocus={onFocus}
									on:sn-focused={setDefaultSoftkeys}
									on:sn-enter-down={() => {
										setShowWallpapers(true);
									}}
									classList={{ default: true }}
									tabIndex={0}
								>
									Select Wallpaper
								</KaiButton>
								<Show
									when={
										// im too lazy to complete this feature lol!!!
										import.meta.env.DEV
									}
								>
									<KaiButton on:sn-willfocus={onFocus} on:sn-focused={setDefaultSoftkeys} tabIndex={0}>
										Upload Wallpaper
									</KaiButton>
									<KaiButton
										on:sn-focused={setDefaultSoftkeys}
										on:sn-enter-down={() => {
											initColors();
											setShowColorPicker(true);
											sleep(10).then(() => {
												SpatialNavigation.focus("wallpaper-settings");
											});
										}}
										on:sn-willfocus={onFocus}
										tabIndex={0}
									>
										Set a color
									</KaiButton>
								</Show>

								<KaiButton
									on:sn-focused={setDefaultSoftkeys}
									on:sn-enter-down={() => {
										$wallpaper.set(DEFAULT_WALLPAPER);
									}}
									on:sn-willfocus={onFocus}
									tabIndex={0}
								>
									Reset to Defaults
								</KaiButton>
							</ButtonContainer>
						}
					>
						<TextInput
							onFocus={(e) => {
								onFocus({ currentTarget: e.currentTarget.parentElement! });
								setSoftkeys("Cancel", "", "Set");
							}}
							onInput={(e) => {
								const value = e.currentTarget.value.replace("#", "");
								setHex(e.currentTarget.value);

								const match = value.match(/([a-fA-F\d]+)/);
								const valid = match && match[0].length === value.length && 6 === value.length;
								const rgb = hexToRgb(value);

								if (valid && rgb) {
									setRgb(rgb.join(", "));
									setHexInvalid(false);
									setRgbInvalid(false);
								} else {
									setHexInvalid(true);
								}
							}}
							value={hex()}
							invalid={hexInvalid()}
							label="HEX"
							caretEnd
						></TextInput>
						<TextInput
							onFocus={(e) => {
								onFocus({ currentTarget: e.currentTarget.parentElement! });
								setSoftkeys("Cancel", "", "Set");
							}}
							onInput={(e) => {
								const value = e.currentTarget.value;
								setRgb(value);

								const match = value.match(rgbRegExp);

								if (match) {
									const r = +match[1],
										g = +match[2],
										b = +match[3];

									setHex(rgbToHex(r, g, b));
									setHexInvalid(false);
									setRgbInvalid(false);
								} else {
									setRgbInvalid(true);
								}
							}}
							value={rgb()}
							invalid={rgbInvalid()}
							label="RGB"
							caretEnd
						></TextInput>
					</Show>
				</div>
			</Content>
			<Show when={showWallpapers()}>
				<Portal>
					<Wallpapers
						onClose={() => {
							setShowWallpapers(false);
							SpatialNavigation.focus("wallpaper-settings");
							setDefaultSoftkeys();
						}}
					></Wallpapers>
				</Portal>
			</Show>
		</>
	);
}
