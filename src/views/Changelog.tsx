import { onCleanup, onMount, Show } from "solid-js";
import { ModifyString } from "./components/Markdown";
import styles from "./Changelog.module.scss";
import SpatialNavigation from "@/lib/spatial_navigation";
import { Portal } from "solid-js/web";
import Options from "./components/Options";
import { appIntegrity, setSoftkeys } from "@signals";

export const CHANGELOG_VERSION = "1";

export default function Changelog(props: { onClose: () => void }) {
	let divRef!: HTMLDivElement;

	onMount(() => {
		localStorage.setItem("CHANGELOG_VERSION", CHANGELOG_VERSION);
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
						class={styles.inner}
						ref={divRef}
						tabIndex={-1}
					>
						<Show when={!appIntegrity()}>
							<div
								style={{
									"font-size": "14px",
									"margin-bottom": "4px",
								}}
							>
								<ModifyString text="🚫"></ModifyString> Integrity Check failed!
							</div>
						</Show>
						<div
							style={{
								"text-align": "center",
								"font-size": "32px",
							}}
						>
							<ModifyString text="🎉" />
						</div>
						<div
							style={{
								"text-align": "center",
							}}
						>
							First Release
						</div>
						<div
							style={{
								"text-align": "center",
							}}
						>
							<span style={{ "font-size": "10px" }}>(expect missing features)</span>
						</div>
						<div
							style={{
								"font-size": "12px",
							}}
						>
							Source code available at: https://github.com/cyan-2048/solid-telekram
						</div>
					</div>
				</Options>
			</div>
		</Portal>
	);
}
