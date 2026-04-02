import { lazy, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { $loginPhase, $previousView, $view, $wallpaper } from "@stores";
import { useStore } from "@nanostores/solid";

import SpatialNavigation from "./lib/spatial_navigation";
import Softkeys from "@components/Softkeys";

import Settings from "./views/settings";
import Toast from "@components/Toast";
import Modals from "./views/modals";
import { cloudphone } from "./config";
import { sleep } from "./helpers";
import { getNotificationClickData } from "./workers/pushNotifications";
import { handleNotificationClick } from "@globals";

import NewChat from "./views/LazyNewChat";
// import { toaster } from "./utils";

const DebugView = lazy(() => import("./views/DebugView"));
const Login = lazy(() => import("./views/Login"));
const Home = lazy(() => import("./views/Home"));
const Room = lazy(() => import("./views/room/Room"));
const ProxySettings = lazy(() => import("./views/settings/ProxySettings"));

function App() {
	onMount(() => {
		console.info("mount time:", performance.now());

		getNotificationClickData().then((data) => {
			if (data) {
				// console.log("NOTIFICATION CLICK DATA", notificationClickData);
				handleNotificationClick(data);
			}
		});

		async function onComplete() {
			Promise.resolve(document.fonts.load('16px "gaia-icons"')).catch(() => null);

			if (cloudphone) {
				await sleep(200);
				await Promise.race([document.fonts.load('16px "emoji"').catch(() => null), sleep(3000)]);
			}
			document.querySelector(".LOADING")?.remove();

			// toaster(navigator.userAgent);

			// preload wallpaper
			if (typeof $wallpaper.get() == "number") {
				const img = new Image();
				img.src = "https://cyan-2048.github.io/kaigram-assets/wallpapers/" + $wallpaper.get() + ".jpg";
			}

			await sleep(2000);
		}

		if (document.readyState === "complete") {
			onComplete();
		} else {
			document.addEventListener("readystatechange", async function handler() {
				if (document.readyState === "complete") {
					document.removeEventListener("readystatechange", handler);
					onComplete();
				}
			});
		}

		SpatialNavigation.init();

		//
		// window.addEventListener(
		// 	"keydown",
		// 	(e) => {
		// 		toaster(e.key, { latency: 200 });
		// 	},
		// 	true
		// );
	});

	onCleanup(() => {
		SpatialNavigation.uninit();
	});

	/*
	onMount(async () => {
		const result = await tg.call({
			_: "help.getCountriesList",
			langCode: "en-US",
			hash: 0,
		});

		const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

		const max = (a: string, b: string) => (a.length > b.length ? a : b);

		Object.assign(window, {
			COUNTRIES:
				result._ == "help.countriesList" &&
				result.countries
					.filter((a) => !a.hidden)
					.map((a) =>
						a.countryCodes.map((code) => ({
							a: code.countryCode,
							b: max(a.defaultName, regionNames.of(a.iso2) || a.defaultName),
							c: a.iso2,
						}))
					)
					.flat()
					.sort((a, b) => (a.b + " " + a.a).localeCompare(b.b + " " + b.a))
					.map((a, id) => ({
						...a,
						id,
					})),
		});
	});
	*/

	const loginPhase = useStore($loginPhase);

	const view = useStore($view);

	return (
		<>
			<Modals></Modals>
			<Toast></Toast>
			<Show when={loginPhase() == "done"} fallback={<Login></Login>}>
				<Switch>
					<Match when={view() == "new_chat"}>
						<NewChat
							onClose={() => {
								$view.set($previousView.get());
							}}
						></NewChat>
					</Match>
					<Match when={view() == "settings"}>
						<Settings
							onClose={() => {
								$view.set($previousView.get());
							}}
						></Settings>
					</Match>
					<Match when={view() == "proxy"}>
						<ProxySettings
							onCancel={() => {
								$view.set($previousView.get());
							}}
						></ProxySettings>
					</Match>
					<Match when={view() == "debug"}>
						<DebugView></DebugView>
					</Match>
				</Switch>
				<Home hidden={view() != "home"}></Home>
				<Room hidden={view() != "room"}></Room>
			</Show>

			<Softkeys></Softkeys>
		</>
	);
}

export default App;
