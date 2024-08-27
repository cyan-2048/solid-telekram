import { onCleanup, onMount } from "solid-js";
import { ModifyString } from "./components/Markdown";
import styles from "./Changelog.module.scss";
import SpatialNavigation from "@/lib/spatial_navigation";
import { Portal } from "solid-js/web";
import Options from "./components/Options";
import { setSoftkeys } from "@signals";

export const VERSION = "1";

export default function Changelog(props: { onClose: () => void }) {
	let divRef!: HTMLDivElement;

	onMount(() => {
		localStorage.setItem("Changelog", VERSION);
		SpatialNavigation.pause();
		divRef.focus();

		setSoftkeys("", "OK", "");
	});

	onCleanup(() => {
		SpatialNavigation.resume();
	});

	return (
		<Portal>
			<div class={styles.changelog}>
				<Options onClose={props.onClose} title="Changelog">
					<div
						onKeyDown={(e) => {
							if (e.key == "Enter") {
								props.onClose();
							}
						}}
						ref={divRef}
						tabIndex={-1}
					>
						<ModifyString text="🎉" />
						<div>First Release</div>
						<div>(expect missing features)</div>
						<div>Source code available at: https://github.com/cyan-2048/solid-telekram</div>
					</div>
				</Options>
			</div>
		</Portal>
	);
}
