import { Match, Show, Switch, onCleanup, onMount } from "solid-js";
import Softkeys from "./views/components/Softkeys";
import {
	client,
	currentView,
	room,
	softcenter,
	softkeysBlack,
	softkeysLoading,
	softleft,
	softright,
} from "@signals";
import SpatialNavigation from "./lib/spatial_navigation";
import Login from "./views/Login";
import Loading from "./views/Loading";
import Home from "./views/Home";
import Room from "./views/Room";

function App() {
	document.querySelector(".LOADING")?.remove();

	onMount(() => {
		SpatialNavigation.init();
	});

	onCleanup(() => {
		SpatialNavigation.uninit();
	});

	return (
		<>
			<Switch>
				<Match when={currentView() == "login"}>
					<Login />
				</Match>
				<Match when={currentView() == "loading"}>
					<Loading />
				</Match>
			</Switch>
			<Show when={client()}>
				<Home hidden={currentView() != "home"}></Home>
			</Show>
			<Show when={client()}>
				<Room hidden={currentView() != "room"} />
			</Show>
			<Softkeys
				left={softleft()}
				center={softcenter()}
				right={softright()}
				loading={softkeysLoading()}
				black={softkeysBlack()}
			/>
		</>
	);
}

export default App;