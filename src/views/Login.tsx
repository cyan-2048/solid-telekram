import {
	Match,
	Show,
	Switch,
	batch,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
	untrack,
} from "solid-js";
import styles from "./Login.module.scss";
import {
	EE,
	LoginState,
	loginState,
	qrLink,
	setSoftkeys,
	setStatusbarColor,
	telegram,
} from "@signals";
import CountryCodePicker, { Country } from "./components/CountryCodePicker";
import SpatialNavigation from "@/lib/spatial_navigation";
import { sleep, useKeypress } from "@/lib/utils";
import Options from "./components/Options";
import OptionsItem from "./components/OptionsItem";
import { QRCodeSVG } from "solid-qr-code";

let countryCache: null | Country = null;

const SN_ID = "login";
const SN_ID_OPTIONS = "options";

const LoadingThing = () => (
	<div style={{ padding: "1rem" }}>Please wait this may take a while...</div>
);

function QRCode(props: { onCancel: () => void }) {
	onMount(() => {
		setSoftkeys("Cancel", "", "");
		blur();
	});

	createEffect(() => {
		const link = qrLink();
		if (link === null) {
			telegram.requestQR();
			return;
		}
	});

	useKeypress(["Backspace", "SoftLeft"], (e) => {
		e.preventDefault();
		props.onCancel();
	});

	return (
		<Options maxHeight={null} title={qrLink() === null ? "Loading" : "QRCode"}>
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
		<Options title="Loading">
			<LoadingThing />
		</Options>
	);
}

function HomeOptions(props: { showQr: () => void; onClose: () => void }) {
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
				tabIndex={-1}
			>
				Log in by QR Code
			</OptionsItem>
		</Options>
	);
}

function blur() {
	(document.activeElement as HTMLElement)?.blur();
	SpatialNavigation.pause();
}

export default function Login() {
	let inputRef!: HTMLInputElement;

	const [country, setCountry] = createSignal<Country | null>(countryCache);

	const [value, setValue] = createSignal("");

	onMount(async () => {
		if (countryCache) return setCountry(countryCache);

		const nearest = await telegram.getNearestDC();
		if (nearest && nearest.dial_code != "?") {
			countryCache = nearest;
			setCountry(nearest);
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

	function resetLoading() {
		SpatialNavigation.resume();
		setLoading(false);
		SpatialNavigation.focus(SN_ID);
		untrack(updateSoftkeys);
	}

	EE.on("loginError", resetLoading);
	onCleanup(() => {
		EE.off("loginError", resetLoading);
	});

	createEffect(() => {
		const state = loginState();
		batch(() => {
			setValue("");
			setShowPicker(false);
			setShowOptions(false);
			setShowQR(false);
			resetLoading();

			switch (state) {
				case LoginState.Phone:
					setPlaceholder("Phone number");
					setInputType("tel");
					break;
				case LoginState.Code:
					setInputType("tel");
					setPlaceholder("Code");
					break;
				case LoginState.Password:
					setInputType("password");
					setPlaceholder("Password");
					break;
			}
		});
	});

	const [inputFocused, setInputFocused] = createSignal(false);

	function updateSoftkeys() {
		setStatusbarColor("#3b90bc");
		switch (loginState()) {
			case LoginState.Phone:
				setSoftkeys("Options", inputFocused() ? "" : "Select", value() ? "Next" : "");
				break;
			case LoginState.Code:
				setSoftkeys("", "", "Next");
				break;
			case LoginState.Password:
				setSoftkeys(inputType() == "password" ? "Show" : "Hide", "", "Next");
				break;
		}
	}

	const [showPicker, setShowPicker] = createSignal(false);

	onMount(() => {
		SpatialNavigation.add(SN_ID, {
			selector: `.${styles.login} :-moz-any(.${styles.select}, input)`,
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
		const passwordThing = loginState() == LoginState.Password && inputType() != "tel";

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
							switch (loginState()) {
								case LoginState.Phone:
									setShowOptions(true);
									break;
								case LoginState.Password:
									setInputType((e) => (e == "text" ? "password" : "text"));
									break;
							}
							break;
						case "SoftRight":
							switch (loginState()) {
								case LoginState.Phone:
									const $country = country();
									if (!showPicker() && $country && value()) {
										const phone = $country.dial_code + value();
										setPhone(phone);
										EE.emit("phone", phone);
										blur();

										setLoading(true);
									}
									break;
								case LoginState.Code:
									EE.emit("code", value());
									blur();
									setLoading(true);
									break;
								case LoginState.Password:
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
							<Match when={loginState() == LoginState.Phone}>Sign in to Telegram</Match>
							<Match when={loginState() == LoginState.Code}>{phone()}</Match>
							<Match when={loginState() == LoginState.Password}>Enter Your Password</Match>
						</Switch>
					</div>
					<div class={styles.text}>
						<Switch>
							<Match when={loginState() == LoginState.Phone}>
								Please confirm your country code and enter your phone number.
							</Match>
							<Match when={loginState() == LoginState.Code}>
								We've sent the code to the Telegram app on your other device.
							</Match>
							<Match when={loginState() == LoginState.Password}>
								Your account is protected with an additional password
							</Match>
						</Switch>
					</div>
				</div>
				<Show when={loginState() == LoginState.Phone}>
					<div
						onFocus={() => {
							setInputFocused(false);
							updateSoftkeys();
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
										{country().dial_code} {country().name}
									</>
								)}
							</Show>
						</div>
						<svg viewBox="0 0 18 18">
							<path d="M7.142 4 6 5.175 9.709 9 6 12.825 7.142 14 12 9z"></path>
						</svg>
					</div>
				</Show>
				<Show when={loginState() != LoginState.Password}>
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
				<Show when={loginState() == LoginState.Password && inputType() != "tel"}>
					<div classList={{ [styles.input_wrap]: true, [styles.focus]: inputFocused() }}>
						<input
							onFocus={() => {
								setInputFocused(true);
								updateSoftkeys();
							}}
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
						setCountry(e);
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
				/>
			</Show>
			<Show when={loading()}>
				<LoadingScreen />
			</Show>
			<Show when={showQR()}>
				<QRCode
					onCancel={() => {
						setShowQR(false);
						telegram.abortQR();
						resetLoading();
					}}
				/>
			</Show>
		</>
	);
}
