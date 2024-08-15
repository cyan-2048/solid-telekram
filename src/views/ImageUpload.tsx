// yes i'm sorry, starting to get tired of making scss files bruh
import { createSignal } from "solid-js";
import styles from "./Room.module.scss";

export default function ImageUpload(props: {
	textBoxRef: (e: HTMLTextAreaElement | null) => void;
	image: Blob;
	onSend: (bool: false | string) => void;
}) {
	return (
		<div class={styles.upload_image}>
			<input class={styles.caption_textbox} placeholder="Add a caption..." onKeyDown={(e) => {}} contentEditable />
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
	);
}
