import { batch, createEffect, createSignal, createUniqueId, onCleanup, onMount, Show } from "solid-js";
import Content from "@components/Content";
import Header from "@components/Header";
import KaiButton from "@components/KaiButton";
import RadioInput from "@components/RadioInput";
import TextInput from "@components/TextInput";
import * as styles from "./ProxySettings.module.scss";
import { scrollIntoView, setSoftkeys } from "@/utils";
import SpatialNavigation from "@/lib/spatial_navigation";
import { Portal } from "solid-js/web";
import QRScanner from "../QRScanner";
import { $mtproxyConfig, $proxyMode, $socksConfig, type ProxyModes } from "@/stores";

const enum Proxies {
	NONE,
	MTPROTO,
	SOCKS5,
}

function getProxy(proxy: ProxyModes) {
	switch (proxy) {
		case "mtproto":
			return Proxies.MTPROTO;
		case "socks":
			return Proxies.SOCKS5;

		default:
			return Proxies.NONE;
	}
}

function isValidPort(port: string | number) {
	const num = Number(port);
	return Number.isInteger(num) && num >= 0 && num <= 65535;
}

function getProxyFromURL(host: string, path: string) {
	if (host == "socks") return Proxies.SOCKS5;
	if (host == "proxy") return Proxies.MTPROTO;

	if (host == "t.me") {
		if (path == "/proxy") return Proxies.MTPROTO;
		if (path == "/socks") return Proxies.SOCKS5;
	}

	return Proxies.NONE;
}

export default function ProxySettings(props: {
	onCancel: () => void;
	initialMtproto?: {
		host: string;
		port: string;
		secret: string;
	} | null;
	initialSocks?: {
		host: string;
		port: string;
		user: string;
		password: string;
	} | null;
}) {
	const SN_ID = createUniqueId();

	onMount(() => {
		setSoftkeys("Cancel", "", "");

		SpatialNavigation.add(SN_ID, {
			selector: `.${styles.proxy_settings} input, .${styles.proxy_settings} [tabindex]`,
			restrict: "self-only",
		});

		SpatialNavigation.focus(SN_ID);
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
	});

	const [showQRScanner, setShowQRScanner] = createSignal(false);

	const [proxy, setProxy] = createSignal(
		props.initialMtproto ? Proxies.MTPROTO : props.initialSocks ? Proxies.SOCKS5 : getProxy($proxyMode.get()),
	);

	// init values
	const { host: _mtServer, port: _mtPort, secret: _mtSecret } = props.initialMtproto || $mtproxyConfig.get();

	const [server, setServer] = createSignal(_mtServer);
	const [port, setPort] = createSignal(_mtPort);
	const [secret, setSecret] = createSignal(_mtSecret);

	// init values
	const {
		host: _socksServer,
		port: _socksPort,
		user: _socksUser,
		password: _socksPassword,
	} = props.initialSocks || $socksConfig.get();

	const [socksServer, setSocksServer] = createSignal(_socksServer);
	const [socksPort, setSocksPort] = createSignal(_socksPort);
	const [socksPassword, setSocksPassword] = createSignal(_socksPassword);
	const [socksUser, setSocksUser] = createSignal(_socksUser);

	function getOldConfig() {
		const proxyMode = $proxyMode.get();
		if (proxyMode == "none" || proxyMode == "sync") return "";

		if (proxyMode == "mtproto") {
			const { host, port, secret } = $mtproxyConfig.get();
			return ["mtproto", host, port, secret].join("\n");
		}

		const { host, port, user, password } = $socksConfig.get();
		return ["socks", host, port, user, password].join("\n");
	}

	const oldConfig = getOldConfig();

	function getNewConfig() {
		const cfg = ["mtproto", server(), port(), secret()].join("\n");
		const socksCfg = ["socks", socksServer(), socksPort(), socksUser(), socksPassword()].join("\n");

		if (!proxy()) return "";
		return proxy() == Proxies.MTPROTO ? cfg : socksCfg;
	}

	function validateNewConfig() {
		if (!proxy()) return true;

		const hasEverything = server() && port() && secret();
		const hasEverythingSocks = socksServer() && socksPort();

		if (proxy() == Proxies.MTPROTO) {
			if (!hasEverything) return false;
			return isValidPort(port());
		} else {
			if (!hasEverythingSocks) return false;
			return isValidPort(socksPort());
		}
	}

	function updateSoftkeys() {
		if (oldConfig != getNewConfig() && validateNewConfig()) {
			setSoftkeys("Cancel", null, "Save");
		} else {
			setSoftkeys("Cancel", null, "");
		}
	}

	function saveChanges() {
		// KaiOS only, does not require custom modal
		if (confirm("Are you sure you want to save changes?")) {
			if (proxy()) {
				if (proxy() == Proxies.MTPROTO) {
					$proxyMode.set("mtproto");
					$mtproxyConfig.set({
						host: server(),
						port: port(),
						secret: secret(),
					});
				} else {
					$proxyMode.set("socks");
					$socksConfig.set({
						host: socksServer(),
						password: socksPassword(),
						user: socksUser(),
						port: socksPort(),
					});
				}
			} else {
				$proxyMode.set("none");
			}

			location.reload();
		}
	}

	createEffect(() => {
		updateSoftkeys();
	});

	return (
		<>
			<Content
				mainStyle={{
					background: "#fff",
				}}
				before={<Header>Proxy Settings</Header>}
			>
				<div
					class={styles.proxy_settings}
					on:sn-willfocus={(e) => {
						const isInput = e.target.tagName == "INPUT";
						scrollIntoView(isInput || e.target.tagName == "BUTTON" ? e.target.parentElement! : e.target);
						setSoftkeys(null, isInput ? "" : "SELECT", null);
					}}
					onKeyDown={(e) => {
						if (e.key == "SoftLeft" || e.key == "Backspace") {
							if (e.key == "Backspace" && "value" in e.target && e.target.value !== "") return;
							e.preventDefault();
							// console.log("CANCELLED!!!");
							props.onCancel();
						}

						if (e.key == "SoftRight") {
							if (oldConfig != getNewConfig() && validateNewConfig()) {
								// console.log("SAVE CHANGES???");
								saveChanges();
							}
						}
					}}
				>
					<RadioInput checked={!proxy()} on:sn-enter-down={() => setProxy(Proxies.NONE)} tabIndex={0}>
						Disabled
					</RadioInput>
					<RadioInput
						checked={proxy() == Proxies.MTPROTO}
						on:sn-enter-down={() => setProxy(Proxies.MTPROTO)}
						tabIndex={0}
					>
						MTProto Proxy
					</RadioInput>
					<RadioInput
						checked={proxy() == Proxies.SOCKS5}
						on:sn-enter-down={() => setProxy(Proxies.SOCKS5)}
						tabIndex={0}
					>
						SOCKS5 Proxy
					</RadioInput>
					<div
						style={
							// so that SpatialNav works properly
							proxy() ? undefined : { display: "none" }
						}
					>
						<div style={proxy() == Proxies.MTPROTO ? undefined : { display: "none" }}>
							<TextInput onInput={(e) => setServer(e.target.value)} value={server()} label="Server"></TextInput>
							<TextInput onInput={(e) => setPort(e.target.value)} value={port()} type="tel" label="Port"></TextInput>
							<TextInput onInput={(e) => setSecret(e.target.value)} value={secret()} label="Secret"></TextInput>
						</div>
						<div style={proxy() == Proxies.SOCKS5 ? undefined : { display: "none" }}>
							<TextInput
								onInput={(e) => setSocksServer(e.target.value)}
								value={socksServer()}
								label="Server"
							></TextInput>
							<TextInput
								onInput={(e) => setSocksPort(e.target.value)}
								value={socksPort()}
								type="tel"
								label="Port"
							></TextInput>
							<TextInput onInput={(e) => setSocksUser(e.target.value)} value={socksUser()} label="Username"></TextInput>
							<TextInput
								onInput={(e) => setSocksPassword(e.target.value)}
								value={socksPassword()}
								type="password"
								label="Password"
							></TextInput>
						</div>
					</div>
					<KaiButton
						on:sn-enter-down={() => {
							setShowQRScanner(true);
							(document.activeElement as HTMLElement).blur();
						}}
						tabIndex={0}
					>
						Scan QR Code
					</KaiButton>
				</div>
			</Content>
			<Show when={showQRScanner()}>
				<Portal>
					<QRScanner
						onResult={(result) => {
							// console.log("QR SCAN RESULT:", result);
							setShowQRScanner(false);

							if (result) {
								// might error if the result is not a valid URL
								try {
									const { searchParams, pathname, host } = new URL(result);

									const proxy = getProxyFromURL(host, pathname);

									const port = searchParams.get("port") || "";
									const server = searchParams.get("server") || "";

									batch(() => {
										if (proxy == Proxies.MTPROTO) {
											setProxy(Proxies.MTPROTO);
											setServer(server);
											setPort(port);
											setSecret(searchParams.get("secret") || "");
										} else if (proxy == Proxies.SOCKS5) {
											setProxy(Proxies.SOCKS5);
											setSocksServer(server);
											setSocksPort(port);
											setSocksPassword(searchParams.get("pass") || "");
											setSocksUser(searchParams.get("user") || "");
										}
									});
								} catch {}
							}

							updateSoftkeys();
							SpatialNavigation.focus(SN_ID);
						}}
					></QRScanner>
				</Portal>
			</Show>
		</>
	);
}
