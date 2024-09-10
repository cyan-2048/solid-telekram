// yes i'm sorry, starting to get tired of making scss files bruh
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import styles from "./Room.module.scss";
import { sleep } from "@/lib/helpers";
import EmojiPicker from "./components/EmojiPicker";
import { typeInTextbox } from "@/lib/utils";
import { Dynamic, Portal } from "solid-js/web";
import Options from "./components/Options";
import OptionsMenuMaxHeight from "./components/OptionsMenuMaxHeight";
import OptionsItem from "./components/OptionsItem";
import { setSoftkeys } from "@signals";

export default function ImageUpload(props: { image: Blob; isVideo?: boolean; onSend: (bool: false | string) => void }) {
	let inputRef!: HTMLInputElement;

	const [src, setSrc] = createSignal("");

	onMount(() => {
		setSoftkeys("", "", "");
		inputRef.focus();

		let url!: string;

		setSrc((url = URL.createObjectURL(props.image)));

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	const [showEmojiPicker, setShowEmojiPicker] = createSignal(false);

	// the options menu is so useless though, but i guess it's a good confirmation to cancel?
	const [showOptions, setShowOptions] = createSignal(false);

	let itemRef!: HTMLDivElement;

	return (
		<>
			<div
				style={
					showEmojiPicker() || showOptions()
						? {
								bottom: "30px",
						  }
						: undefined
				}
				class={styles.upload_image}
			>
				<Dynamic
					component={props.isVideo ? "video" : "img"}
					style={
						showEmojiPicker() || showOptions()
							? {
									top: "30px",
							  }
							: undefined
					}
					preload="metadata"
					src={src()}
					onLoadedMetadata={async (e: Event & { currentTarget: HTMLVideoElement }) => {
						if (!props.isVideo) return;
						console.error("VIDEO PREVIEW AVAILABLE");
						const target = e.currentTarget;
						await sleep(0);
						target.currentTime = 0.00000000001;
					}}
				></Dynamic>
				<input
					ref={inputRef}
					class={styles.caption_textbox}
					placeholder="Add a caption..."
					onKeyDown={(e) => {
						const value = e.currentTarget.value;

						if (e.key == "Enter") {
							sleep(10).then(() => props.onSend(value));
						}
						if (e.key == "Backspace" && value === "") {
							e.preventDefault();
							sleep(10).then(() => props.onSend(false));
						}

						if (e.key == "SoftLeft") {
							setSoftkeys("", "", "");
							sleep(10).then(() => {
								setShowEmojiPicker(true);
							});
						}

						if (e.key == "SoftRight") {
							setShowOptions(true);
							sleep(0).then(() => {
								itemRef.focus();
							});
							setSoftkeys("", "OK", "");
						}
					}}
				/>
				<div class={styles.caption_softkeys}>
					<div>
						<svg viewBox="0 0 24 24" class={styles.emoji}>
							<path d="M12 22.1C6.4 22.1 1.9 17.6 1.9 12S6.4 1.9 12 1.9 22.1 6.4 22.1 12 17.6 22.1 12 22.1zm0-18.6c-4.7 0-8.5 3.8-8.5 8.5s3.8 8.5 8.5 8.5 8.5-3.8 8.5-8.5-3.8-8.5-8.5-8.5z"></path>
							<path d="M8.9 11.6c.7 0 1.3-.7 1.3-1.5s-.6-1.5-1.3-1.5-1.3.7-1.3 1.5.6 1.5 1.3 1.5zm8.2 2c-1.1.1-3 .4-5 .4s-4-.3-5-.4c-.4 0-.6.3-.4.7 1.1 2 3.1 3.5 5.5 3.5 2.3 0 4.4-1.5 5.5-3.5.1-.3-.2-.7-.6-.7zM12.3 16c-2.6 0-4.1-1-4.2-1.6 0 0 4.4.9 8 0 0 0-.5 1.6-3.8 1.6zm2.8-4.4c.7 0 1.3-.7 1.3-1.5s-.6-1.5-1.3-1.5-1.3.7-1.3 1.5.6 1.5 1.3 1.5z"></path>
						</svg>
					</div>
					<div class="p n">
						<span class="s">Send</span>
					</div>
					<div class="q n">
						<svg viewBox="0 0 16 16" fill="currentColor" class={styles.options}>
							<path d="M9.5 13a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0-5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0-5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"></path>
						</svg>
					</div>
				</div>
			</div>
			<Show when={showEmojiPicker()}>
				<Portal>
					<EmojiPicker
						onSelect={async (e) => {
							setSoftkeys("", "", "");
							setShowEmojiPicker(false);
							await sleep(10);
							if (e) {
								typeInTextbox(e, inputRef);
							}
							inputRef.focus();
						}}
					/>
				</Portal>
			</Show>
			<Show when={showOptions()}>
				<Portal>
					<Options
						onClose={() => {
							setShowOptions(false);
							sleep(10).then(() => {
								inputRef.focus();
							});
						}}
						title="Options"
					>
						<OptionsMenuMaxHeight>
							<OptionsItem
								ref={itemRef}
								classList={{ option: true, [styles.option_item]: true }}
								tabIndex={-1}
								onKeyDown={(e) => {
									if (e.key == "Enter") {
										setSoftkeys("", "", "");
										sleep(10).then(() => {
											props.onSend(false);
										});
									}
								}}
							>
								Cancel
							</OptionsItem>
						</OptionsMenuMaxHeight>
					</Options>
				</Portal>
			</Show>
		</>
	);
}
