import { createUniqueId, type JSXElement, onCleanup, onMount, Show } from "solid-js";
import * as styles from "./InsertMenu.module.scss";
import Options from "@components/Options";
import SpatialNavigation from "@/lib/spatial_navigation";
import TelegramIcon from "@components/TelegramIcon";
import { setSoftkeys, sleep } from "@utils";
import LazyGifPicker from "./LazyGifPicker";
import LazyEmojiPicker from "./LazyEmojiPicker";
import { cloudphone, cloudphone_features } from "@/config";
import { $view } from "@/stores";

export const enum InsertMenuSelected {
	EMOJI,
	PHOTO,
	VIDEO,
	GIF,
	CONTACTS,
	AUDIO,
	LOCATION,
	VOICE,
	FILE,
}

function GridItem(props: {
	value?: InsertMenuSelected;
	onSelect: (e: InsertMenuSelected | null) => void;
	name: string;
	color: string;
	icon: JSXElement;
}) {
	return (
		<div
			tabIndex={-1}
			on:sn-enter-down={() => {
				sleep(10).then(() => props.onSelect(props.value === undefined ? null : props.value));
			}}
			onFocus={() => {
				setSoftkeys("Cancel", props.name, "");

				switch (props.value) {
					case InsertMenuSelected.EMOJI:
					case InsertMenuSelected.PHOTO:
					case InsertMenuSelected.VIDEO:
						LazyEmojiPicker.preload();
						break;
					case InsertMenuSelected.GIF:
						LazyGifPicker.preload();
						break;
				}
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
	const SN_ID = createUniqueId();

	let canUseKeyboard = false;

	onMount(() => {
		SpatialNavigation.add(SN_ID, {
			selector: `.${styles.gridItem}`,
			restrict: "self-only",
		});

		SpatialNavigation.focus(SN_ID);

		setTimeout(() => {
			canUseKeyboard = true;
		}, 100);
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
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
					if (!canUseKeyboard) return;
					if (e.key == "SoftLeft") {
						sleep(10).then(() => props.onSelect(null));
					}
				}}
				class={styles.grid}
			>
				<Show when={cloudphone}>
					<GridItem
						onSelect={() => {
							sleep(10)
								.then(() => props.onSelect(null))
								.then(() => sleep().then(() => $view.set("home")));
						}}
						icon={/*@once*/ <TelegramIcon name="left" />}
						color="#5caffa"
						name="Go Back"
					/>
				</Show>
				<GridItem
					value={/*@once*/ InsertMenuSelected.EMOJI}
					onSelect={props.onSelect}
					icon={/*@once*/ <TelegramIcon name="smile" />}
					color="#f7aa21"
					name="Emoji"
				/>
				<Show when={!cloudphone || cloudphone_features.ImageUpload || cloudphone_features.FileUpload}>
					<GridItem
						value={/*@once*/ InsertMenuSelected.PHOTO}
						onSelect={props.onSelect}
						icon={/*@once*/ <TelegramIcon name="camera" />}
						color="#e62d73"
						name="Photo"
					/>
				</Show>
				<Show when={!cloudphone || cloudphone_features.VideoUpload || cloudphone_features.FileUpload}>
					<GridItem
						value={/*@once*/ InsertMenuSelected.VIDEO}
						onSelect={props.onSelect}
						icon={/*@once*/ <TelegramIcon name="videocamera" />}
						color="#5f33ea"
						name="Video"
					/>
				</Show>

				<Show when={!cloudphone || cloudphone_features.FileUpload}>
					<GridItem
						value={/*@once*/ InsertMenuSelected.FILE}
						onSelect={props.onSelect}
						icon={/*@once*/ <TelegramIcon name="document" />}
						color="#ff4f1a"
						name="File"
					/>
				</Show>

				<GridItem
					value={/*@once*/ InsertMenuSelected.GIF}
					onSelect={props.onSelect}
					icon={/*@once*/ <TelegramIcon name="gifs" />}
					color="#4db9e8"
					name="GIF"
				/>
				{/* <GridItem
					value={InsertMenuSelected.CONTACTS}
					onSelect={props.onSelect}
					icon={<TelegramIcon name="newprivate_filled" />}
					color="#00aa5a"
					name="Contacts"
				/> */}
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
				<Show when={!cloudphone || cloudphone_features.AudioCapture}>
					<GridItem
						value={/*@once*/ InsertMenuSelected.VOICE}
						onSelect={props.onSelect}
						icon={/*@once*/ <TelegramIcon name="microphone_filled" />}
						color="#ff57d5"
						name="Voice"
					/>
				</Show>

				{/* <GridItem
					value={InsertMenuSelected.LOCATION}
					onSelect={props.onSelect}
					icon={<TelegramIcon name="location" />}
					color="#6a6a6a"
					name="Location"
				/> */}
			</div>
		</Options>
	);
}
