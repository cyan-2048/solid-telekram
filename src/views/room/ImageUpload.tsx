import { createSignal, onCleanup, onMount, Show } from "solid-js";
import * as styles from "./ImageUpload.module.scss";
import { typeInTextbox, sleep, setSoftkeys, hideSoftkeys } from "@utils";
import { Dynamic, Portal } from "solid-js/web";
import Options from "@components/Options";
import OptionsMenuMaxHeight from "@components/OptionsMenuMaxHeight";
import OptionsItem from "@components/OptionsItem";
import LazyEmojiPicker from "./LazyEmojiPicker";

export default function ImageUpload(props: { src: Blob; isVideo?: boolean; onSend: (bool: false | string) => void }) {
	let inputRef!: HTMLInputElement;

	const [src, setSrc] = createSignal("");

	onMount(() => {
		setSoftkeys("", "", "");
		hideSoftkeys(true);
		inputRef.focus();

		let url!: string;

		setSrc((url = URL.createObjectURL(props.src)));

		onCleanup(() => {
			hideSoftkeys(false);
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
				<Show
					when={props.isVideo}
					fallback={
						<img
							src={src()}
							style={
								showEmojiPicker() || showOptions()
									? {
											top: "30px",
										}
									: undefined
							}
						/>
					}
				>
					<video
						src={src()}
						style={
							showEmojiPicker() || showOptions()
								? {
										top: "30px",
									}
								: undefined
						}
						preload="metadata"
						muted
						autoplay
						onLoadedData={async (e) => {
							if (!props.isVideo) return;
							const target = e.currentTarget;

							target.pause();

							await sleep(10);
							target.currentTime = 0.00000000001;

							if (typeof target.fastSeek == "function") {
								target.fastSeek(0);
							}
						}}
						onLoadedMetadata={async (e) => {
							console.error("VIDEO PREVIEW AVAILABLE");
							const target = e.currentTarget;
							target.pause();
							await sleep(10);

							target.currentTime = 0.00000000001;

							if (typeof target.fastSeek == "function") {
								target.fastSeek(0);
							}
						}}
					></video>
				</Show>
				<input
					ref={inputRef}
					class={styles.caption_textbox}
					placeholder="Add a caption..."
					onKeyUp={(e) => {
						if (e.key == "Backspace") {
							sleep(10).then(() => props.onSend(false));
						}
					}}
					onKeyDown={(e) => {
						const value = e.currentTarget.value;

						if (e.key == "Enter") {
							sleep(10).then(() => props.onSend(value));
						}
						if (e.key == "Backspace" && value === "") {
							e.preventDefault();
						}

						if (e.key == "SoftLeft") {
							setSoftkeys("", "", "");
							sleep(10).then(() => {
								hideSoftkeys(false);
								setShowEmojiPicker(true);
							});
						}

						if (e.key == "SoftRight") {
							setShowOptions(true);
							hideSoftkeys(false);
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
					<div>
						<span>Send</span>
					</div>
					<div>
						<svg viewBox="0 0 16 16" fill="currentColor" class={styles.options}>
							<path d="M9.5 13a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0-5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0-5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"></path>
						</svg>
					</div>
				</div>
			</div>
			<Show when={showEmojiPicker()}>
				<Portal>
					<LazyEmojiPicker
						onSelect={async (e) => {
							setSoftkeys("", "", "");
							hideSoftkeys(true);
							setShowEmojiPicker(false);
							await sleep(100);
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
							sleep(100).then(() => {
								inputRef.focus();
							});
							hideSoftkeys(true);
						}}
						title="Options"
					>
						<OptionsMenuMaxHeight>
							<OptionsItem
								ref={itemRef}
								classList={{ option: true, [styles.option_item]: true }}
								tabIndex={-1}
								onKeyUp={(e) => {
									if (e.key == "Enter") {
										setSoftkeys("", "", "");
										hideSoftkeys(true);
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
