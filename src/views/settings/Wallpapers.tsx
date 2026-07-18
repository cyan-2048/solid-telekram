import { createSignal, onCleanup, onMount } from "solid-js";
import * as styles from "./Wallpapers.module.scss";
import { setSoftkeys, WALLPAPER_AVERAGE_COLORS } from "@/utils";
import SpatialNavigation from "@/lib/spatial_navigation";
import scrollIntoView from "scroll-into-view-if-needed";
import { $wallpaper } from "@/stores";

const LINK = "/wallpapers/";

function Preview(props: { id: number; onFocus: () => void; onCancel: () => void; onSelect: () => void }) {
	let imgEl!: HTMLImageElement;

	onMount(() => {
		if ($wallpaper.get() === props.id) {
			scrollIntoView(imgEl, {
				behavior: "instant",
				scrollMode: "always",
				skipOverflowHiddenElements: false,
				inline: "center",
			});
			imgEl.focus();
		}
	});

	return (
		<img
			ref={imgEl}
			on:sn-willfocus={(e) => {
				scrollIntoView(e.currentTarget, {
					behavior: "smooth",
					scrollMode: "always",
					skipOverflowHiddenElements: false,
					inline: "center",
				});

				props.onFocus();
			}}
			onKeyDown={(e) => {
				if (e.key == "Backspace") e.preventDefault();

				if (e.key == "SoftLeft" || e.key == "Backspace") {
					setTimeout(() => {
						props.onCancel();
					}, 100);
				}

				if (e.key == "SoftRight") {
					props.onSelect();
				}
			}}
			tabIndex={0}
			style={{
				"background-color": WALLPAPER_AVERAGE_COLORS[props.id],
			}}
			classList={{ [styles.preview]: true, default: $wallpaper.get() === props.id }}
			src={LINK + props.id + ".jpg"}
		/>
	);
}

const updateSoftkeys = () => setSoftkeys("Cancel", "", "Set", false, true);

export default function Wallpapers(props: { onClose: () => void }) {
	const currentWallpaper = $wallpaper.get();

	const [preview, setPreview] = createSignal(typeof currentWallpaper == "number" ? currentWallpaper : 0);

	onMount(() => {
		SpatialNavigation.add("wallpapers", {
			selector: `.${styles.wallpapers} .${styles.preview}`,
			rememberSource: true,
			restrict: "self-only",
			enterTo: "last-focused",
		});

		if (typeof currentWallpaper != "number") SpatialNavigation.focus("wallpapers");
	});

	onCleanup(() => {
		SpatialNavigation.remove("wallpapers");
	});

	return (
		<div class={styles.wallpapers}>
			<div
				style={{
					"background-image": `url(${LINK + preview()}.jpg)`,
					"background-color": WALLPAPER_AVERAGE_COLORS[preview()],
				}}
				class={styles.wallpaper_preview}
			></div>
			<div class={styles.previews}>
				{
					/*@once*/
					Array.from({ length: 56 }, (_, idx) => (
						<Preview
							id={idx}
							onFocus={() => {
								updateSoftkeys();
								setPreview(idx);
							}}
							onCancel={props.onClose}
							onSelect={() => {
								$wallpaper.set(idx);
								props.onClose();
							}}
						></Preview>
					))
				}
			</div>
		</div>
	);
}
