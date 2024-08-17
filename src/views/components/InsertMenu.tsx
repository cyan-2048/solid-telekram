import { JSXElement, onCleanup, onMount } from "solid-js";
import styles from "./InsertMenu.module.scss";
import Options from "./Options";
import SpatialNavigation from "@/lib/spatial_navigation";
import TelegramIcon from "./TelegramIcon";
import { setSoftkeys } from "@signals";
import { sleep } from "@/lib/helpers";

export const enum InsertMenuSelected {
	EMOJI,
	PHOTO,
	VIDEO,
	GIF,
	CONTACTS,
	AUDIO,
	LOCATION,
	VOICE,
}

function GridItem(props: {
	value: InsertMenuSelected;
	onSelect: (e: InsertMenuSelected) => void;
	name: string;
	color: string;
	icon: JSXElement;
}) {
	return (
		<div
			tabIndex={-1}
			on:sn-enter-down={() => {
				sleep(10).then(() => props.onSelect(props.value));
			}}
			onFocus={() => {
				setSoftkeys("Cancel", props.name, "");
			}}
			class={styles.gridItem}
		>
			<div
				class={styles.icon}
				style={{
					"background-color": props.color,
				}}
			>
				<div class={styles.icon_container}>{props.icon}</div>
			</div>
			<div class={styles.iconText}>{props.name}</div>
		</div>
	);
}

export default function InsertMenu(props: { onSelect: (e: InsertMenuSelected | null) => void }) {
	onMount(() => {
		SpatialNavigation.add("insertMenu", {
			selector: `.${styles.gridItem}`,
			restrict: "self-only",
		});

		SpatialNavigation.focus("insertMenu");
	});

	onCleanup(() => {
		SpatialNavigation.remove("insertMenu");
	});

	return (
		<Options
			onClose={() => {
				sleep(10).then(() => props.onSelect(null));
			}}
			maxHeight={null}
		>
			<div
				onKeyDown={(e) => {
					if (e.key == "SoftLeft") {
						sleep(10).then(() => props.onSelect(null));
					}
				}}
				class={styles.grid}
			>
				<GridItem
					value={InsertMenuSelected.EMOJI}
					onSelect={props.onSelect}
					icon={<TelegramIcon name="smile" />}
					color="#f7aa21"
					name="Emoji"
				/>
				<GridItem
					value={InsertMenuSelected.PHOTO}
					onSelect={props.onSelect}
					icon={<TelegramIcon name="camera" />}
					color="#e62d73"
					name="Photo"
				/>
				<GridItem
					value={InsertMenuSelected.VIDEO}
					onSelect={props.onSelect}
					icon={<TelegramIcon name="videocamera" />}
					color="#5f33ea"
					name="Video"
				/>
				<GridItem
					value={InsertMenuSelected.GIF}
					onSelect={props.onSelect}
					icon={<TelegramIcon name="gifs" />}
					color="#4db9e8"
					name="GIF"
				/>
				<GridItem
					value={InsertMenuSelected.CONTACTS}
					onSelect={props.onSelect}
					icon={<TelegramIcon name="newprivate_filled" />}
					color="#00aa5a"
					name="Contacts"
				/>
				<GridItem
					value={InsertMenuSelected.AUDIO}
					onSelect={props.onSelect}
					icon={
						<svg
							xmlns="http://www.w3.org/2000/svg"
							height="24px"
							viewBox="0 -960 960 960"
							width="24px"
							fill="currentColor"
						>
							<path d="M401.15-143.85q-57.75 0-98.87-41.12-41.12-41.13-41.12-98.88 0-57.75 41.12-98.87 41.12-41.12 98.87-41.12 23 0 43.08 6.84 20.08 6.85 36.92 20.54v-419.69h217.69v130.76H541.15v401.54q0 57.75-41.12 98.88-41.13 41.12-98.88 41.12Z" />
						</svg>
					}
					color="#ff57d5"
					name="Audio"
				/>
				<GridItem
					value={InsertMenuSelected.VOICE}
					onSelect={props.onSelect}
					icon={<TelegramIcon name="microphone_filled" />}
					color="#ff57d5"
					name="Voice Message"
				/>
				<GridItem
					value={InsertMenuSelected.LOCATION}
					onSelect={props.onSelect}
					icon={<TelegramIcon name="location" />}
					color="#6a6a6a"
					name="Location"
				/>
			</div>
		</Options>
	);
}
