import { Match, Show, Switch, batch, createEffect, createSignal, lazy, onCleanup, onMount, untrack } from "solid-js";
import { useStore } from "@nanostores/solid";

import * as styles from "./Login.module.scss";

import type { Country } from "@components/CountryCodePicker";
import SpatialNavigation from "@/lib/spatial_navigation";
import { countries, setSoftkeys, sleep } from "@utils";
import Options from "@components/Options";
import OptionsItem from "@components/OptionsItem";

import { EE, startQr, tg } from "@globals";
import { $loginPhase, $qrLink, $cachedPhoneNumber, setStatusbarColor, $proxyMode } from "@stores";
import { cloudphone } from "@/config";
import TextInput from "@components/TextInput";
import { manuallyUnsubscribePushNotification } from "@/workers/pushNotifications";
import { Portal } from "solid-js/web";

const CountryCodePicker = lazy(() => import("@components/CountryCodePicker"));
const QRCodeSVG = lazy(() => import("@components/QRCodeSVG"));
const ProxySettings = lazy(() => import("./settings/ProxySettings"));

let countryCache: null | Country = null;

const SN_ID = "login";
const SN_ID_OPTIONS = "options";

const LoadingThing = () => <div style={{ padding: "1rem" }}>Please wait this may take a while...</div>;

function QRCode(props: { onCancel: () => void }) {
	onMount(() => {
		setSoftkeys("Cancel", "", "");
		blur();
		startQr();
	});

	const qrLink = useStore($qrLink);

	// createRenderEffect(() => {
	// 	const link = qrLink();
	// 	if (link === null) {
	// 		// telegram.requestQR();
	// 		return;
	// 	}
	// });

	function onKeyPress(e: KeyboardEvent) {
		if (e.key == "SoftLeft" || e.key == "Backspace") {
			e.preventDefault();
			props.onCancel();
			EE.emit("abortQR");
		}
	}

	window.addEventListener("keydown", onKeyPress, true);

	onCleanup(() => {
		window.removeEventListener("keydown", onKeyPress, true);
	});

	return (
		<Options maxHeight={null} title={qrLink() === null ? "Loading..." : "QRCode"}>
			<Show when={qrLink() === null}>
				<LoadingThing />
			</Show>
			<div
				style={{
					background: "white",
					display: qrLink() ? "flex" : "none",
					"align-content": "center",
					"justify-content": "center",
					padding: "1rem",
				}}
			>
				<Show when={qrLink()}>
					{(link) => (
						// @ts-ignore
						<QRCodeSVG width={200} height={200} value={link()} />
					)}
				</Show>
			</div>
		</Options>
	);
}

function LoadingScreen() {
	onMount(() => {
		setSoftkeys("", "", "");
	});

	return (
		<Options title="Loading...">
			<LoadingThing />
		</Options>
	);
}

function HomeOptions(props: { showQr: () => void; onClose: () => void; showProxy: () => void }) {
	onMount(() => {
		SpatialNavigation.add(SN_ID_OPTIONS, {
			selector: ".option",
			restrict: "self-only",
		});
		SpatialNavigation.focus(SN_ID_OPTIONS);
		setSoftkeys("", "OK", "");
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID_OPTIONS);
	});

	return (
		<Options onClose={props.onClose} title="Options">
			<OptionsItem
				classList={{ option: true, [styles.item]: true }}
				on:sn-enter-down={() => {
					props.showQr();
				}}
				on:sn-focused={() => {
					QRCodeSVG.preload();
				}}
				tabIndex={-1}
			>
				Log in by QR Code
			</OptionsItem>
			{/* <Show when={!localStorage.getItem("NO_ADS")}>
				<OptionsItem
					classList={{ option: true, [styles.item]: true }}
					tabIndex={-1}
					on:sn-enter-down={() => {
						// showKaiAd();
						props.onClose();
					}}
				>
					Show Ad
				</OptionsItem>
			</Show> */}

			<Show when={!cloudphone}>
				<OptionsItem
					classList={{ option: true, [styles.item]: true }}
					tabIndex={-1}
					on:sn-focused={() => {
						ProxySettings.preload();
					}}
					on:sn-enter-down={() => {
						props.showProxy();
					}}
				>
					Proxy Settings
				</OptionsItem>
			</Show>

			<OptionsItem
				classList={{ option: true, [styles.item]: true }}
				tabIndex={-1}
				on:sn-enter-down={() => {
					window.close();
				}}
			>
				Exit
			</OptionsItem>
		</Options>
	);
}

function blur() {
	(document.activeElement as HTMLElement)?.blur();
	SpatialNavigation.pause();
}

// should only be used for cloudphone
function getCountryCodeViaHTTP() {
	if (import.meta.env.CLOUDPHONE) {
		if (!cloudphone) return null;

		return fetch("https://geoip.cyan-2048.workers.dev/")
			.then((a) => a.text())
			.then((country) => {
				if (!country) return null;

				return {
					country,
				};
			})
			.catch(() => null);
	}
	return null;
}

export default function Login() {
	let inputRef!: HTMLInputElement;

	const [country, setCountry] = createSignal<Country | null>(countryCache);
	let countrySetViaPicker = false;

	const [value, setValue] = createSignal("");

	const loginPhase = useStore($loginPhase);

	onMount(async () => {
		if (countryCache) return setCountry(countryCache);

		const cachedCountryFromLS = $cachedPhoneNumber.get().iso2;

		const USA_USA_USA = {
			a: "1",
			b: "USA",
			c: "US",
			id: 227,
		};

		// always prefer getting the value from LocalStorage
		if (cachedCountryFromLS) {
			const found = countries().find((a) => a.c == cachedCountryFromLS);
			found && setCountry((countryCache = found));
		} else {
			const { guess, getCountryForTimezone } = await import("@/lib/geoguessr");

			const guessed = getCountryForTimezone(guess());
			console.log("COUNTRY GUESSED FROM TIMEZONE", guessed?.id);
			if (guessed && !countrySetViaPicker) {
				const found = countries().find((a) => a.c == guessed.id);
				found && setCountry((countryCache = found || USA_USA_USA));
			}
		}

		// if there is no cached
		// or if there is no country set
		// we should ask telegram for the country
		//
		// if we are using a proxy,
		// most likely the country would be wrong
		if ((!cachedCountryFromLS || !country()) && ($proxyMode.get() == "none" || $proxyMode.get() == "sync")) {
			const nearest =
				(await getCountryCodeViaHTTP()) ||
				(await tg.call({
					_: "help.getNearestDc",
				}));

			// the user may have manually set the value before the tg.call resolves
			// remember, we no longer simulate a loading screen when doing the very slow authentication proccess
			if (!countrySetViaPicker) {
				setCountry((countryCache = countries().find((a) => a.c == nearest.country.toUpperCase()) || USA_USA_USA));

				console.log("cached country set!");
				$cachedPhoneNumber.setKey("iso2", countryCache.c);
			}
		}
	});

	const [loading, setLoading] = createSignal(false);

	const [placeholder, setPlaceholder] = createSignal("Phone number");
	const [inputType, setInputType] = createSignal("tel");

	createEffect(() => {
		inputType();
		untrack(updateSoftkeys);
	});

	const [showQR, setShowQR] = createSignal(false);
	const [showProxy, setShowProxy] = createSignal(false);

	function resetLoading() {
		batch(() => {
			setShowProxy(false);
			setShowQR(false);
			setLoading(false);
		});

		SpatialNavigation.resume();
		SpatialNavigation.focus(SN_ID);
		untrack(updateSoftkeys);
	}

	function requestHandler(e: string) {
		if (loading()) {
			if ($loginPhase.get() == "phone" && e == "phone") {
				EE.emit("phone", phone());
			}
			if ($loginPhase.get() == "password" && e == "password") {
				EE.emit("password", value());
			}
		}
	}

	EE.on("requestLogin", requestHandler);
	EE.on("loginError", resetLoading);

	onCleanup(() => {
		EE.off("loginError", resetLoading);
		EE.off("requestLogin", requestHandler);

		// once Login screen is unmounted, we should manually disable the push notifs
		manuallyUnsubscribePushNotification();
	});

	let hasRequestedPasswordHint = false;

	const [passwordHint, setPasswordHint] = createSignal("");

	createEffect(() => {
		const state = loginPhase();

		if (state == "password" && !hasRequestedPasswordHint) {
			hasRequestedPasswordHint = true;
			tg.getPasswordHint()
				.then(setPasswordHint)
				.catch(() => null);
		}

		batch(() => {
			setValue("");
			setShowPicker(false);
			setShowOptions(false);
			setShowQR(false);
			resetLoading();

			switch (state) {
				case "phone":
					setPlaceholder("Phone number");
					setInputType("tel");
					break;
				case "code":
					setInputType("tel");
					setPlaceholder("Code");
					break;
				case "password":
					setInputType("password");
					setPlaceholder("Password");
					break;
			}
		});
	});

	const [inputFocused, setInputFocused] = createSignal(false);

	function updateSoftkeys() {
		setStatusbarColor("#1c96c3");
		switch (loginPhase()) {
			case "phone":
				setSoftkeys("Options", inputFocused() ? "" : "Select", value() ? "Next" : "");
				break;
			case "code":
				setSoftkeys("", "", "Next");
				break;
			case "password":
				setSoftkeys(inputType() == "password" ? "Show" : "Hide", "", "Next");
				break;
		}
	}

	const [showPicker, setShowPicker] = createSignal(false);

	onMount(() => {
		SpatialNavigation.add(SN_ID, {
			selector: `.${styles.login} .${styles.select}, .${styles.login} input`,
			restrict: "self-only",
			defaultElement: `.${styles.login} input`,
		});

		SpatialNavigation.focus(SN_ID);
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
	});

	createEffect(() => {
		// this is required because on KaiOS something breaks??? idk
		const passwordThing = loginPhase() == "password" && inputType() != "tel";

		if (passwordThing) {
			sleep(0).then(() => {
				const e = document.activeElement as HTMLElement;
				e?.blur();
				SpatialNavigation.focus(SN_ID);
			});
		}
	});

	const [phone, setPhone] = createSignal("");

	const [showOptions, setShowOptions] = createSignal(false);

	return (
		<>
			<div
				onKeyDown={(e) => {
					switch (e.key) {
						case "SoftLeft":
							switch (loginPhase()) {
								case "phone":
									setShowOptions(true);
									break;
								case "password":
									setInputType((e) => (e == "text" ? "password" : "text"));
									break;
							}
							break;
						case "SoftRight":
							switch (loginPhase()) {
								case "phone":
									const $country = country();
									if (!showPicker() && $country && value()) {
										const phone = $country.a + value();
										setPhone(phone);
										EE.emit("phone", phone);
										blur();

										setLoading(true);
									}
									break;
								case "code":
									EE.emit("code", value());
									blur();
									setLoading(true);
									break;
								case "password":
									EE.emit("password", value());
									blur();
									setLoading(true);
									break;
							}
							break;
					}
				}}
				class={styles.login}
			>
				<div class={styles.header}>
					<div class={styles.heading}>
						<Switch>
							<Match when={loginPhase() == "phone"}>Sign in to Telegram</Match>
							<Match when={loginPhase() == "code"}>+{phone()}</Match>
							<Match when={loginPhase() == "password"}>Enter Your Password</Match>
						</Switch>
					</div>
					<div class={styles.text}>
						<Switch>
							<Match when={loginPhase() == "phone"}>
								Please confirm your country code and enter your phone number.
							</Match>
							<Match when={loginPhase() == "code"}>We've sent the code to the Telegram app on your other device.</Match>
							<Match when={loginPhase() == "password"}>Your account is protected with an additional password</Match>
						</Switch>
					</div>
				</div>
				<Show when={loginPhase() == "phone"}>
					<div
						onFocus={() => {
							setInputFocused(false);
							updateSoftkeys();
							CountryCodePicker.preload();
						}}
						tabIndex={-1}
						on:sn-enter-down={() => {
							setShowPicker(true);
						}}
						class={styles.select}
					>
						<div>
							<Show when={country()} fallback="Loading...">
								{(country) => (
									<>
										+{country().a} {country().b}
									</>
								)}
							</Show>
						</div>
						<svg viewBox="0 0 18 18">
							<path d="M7.142 4 6 5.175 9.709 9 6 12.825 7.142 14 12 9z"></path>
						</svg>
					</div>
				</Show>
				<Show when={loginPhase() != "password"}>
					<div classList={{ [styles.input_wrap]: true, [styles.focus]: inputFocused() }}>
						<input
							ref={inputRef}
							onFocus={() => {
								setInputFocused(true);
								updateSoftkeys();
							}}
							onKeyDown={(e) => {
								if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
									e.stopImmediatePropagation();
									e.stopPropagation();
								}
							}}
							value={value()}
							onInput={(e) => {
								setValue(e.currentTarget.value);
								updateSoftkeys();
							}}
							type={inputType()}
							placeholder={placeholder()}
						/>
					</div>
				</Show>
				<Show when={loginPhase() == "password" && inputType() != "tel"}>
					<div>
						<TextInput
							onFocus={() => {
								setInputFocused(true);
								updateSoftkeys();
							}}
							label={passwordHint()}
							style={{
								padding: "8px 10px",
								height: "40.7px",
							}}
							focused={inputFocused()}
							onKeyDown={(e) => {
								if (e.key.includes("Arrow")) {
									e.stopImmediatePropagation();
									e.stopPropagation();
								}
							}}
							value={value()}
							onInput={(e) => {
								setValue(e.currentTarget.value);
								updateSoftkeys();
							}}
							type={inputType()}
							placeholder={placeholder()}
						/>
					</div>
				</Show>
			</div>
			<Show when={showPicker()}>
				<CountryCodePicker
					onSelect={(e) => {
						countrySetViaPicker = true;
						setCountry((countryCache = e));
						$cachedPhoneNumber.setKey("iso2", countryCache.c);

						setShowPicker(false);
						inputRef.focus();
					}}
					onClose={() => {
						setShowPicker(false);
						inputRef.focus();
					}}
				/>
			</Show>
			<Show when={showOptions()}>
				<HomeOptions
					onClose={() => {
						SpatialNavigation.focus(SN_ID);
						setShowOptions(false);
						updateSoftkeys();
					}}
					showQr={() => {
						setShowOptions(false);
						setShowQR(true);
					}}
					showProxy={() => {
						setShowOptions(false);
						setStatusbarColor("#0a323f");
						setShowProxy(true);
					}}
				/>
			</Show>
			<Show when={loading()}>
				<LoadingScreen />
			</Show>
			<Show when={showQR()}>
				<QRCode onCancel={resetLoading} />
			</Show>
			<Show when={showProxy()}>
				<Portal>
					<ProxySettings onCancel={resetLoading} />
				</Portal>
			</Show>
		</>
	);
}
