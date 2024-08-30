// this is entire thing is very temporary please get rid of it ASAP lmao

import { writable } from "@/lib/stores";
import { useStore } from "@/lib/utils";
import { without } from "lodash-es";
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import styles from "./TemporaryUploadingIndicator.module.scss";

let counter = 0;

export class TempFileUploading {
	progress = writable(0);
	error = writable(false);
	id = ++counter;
}

export const [temp_uploadingFiles, temp_setUploadingFiles] = createSignal<TempFileUploading[]>([]);

function UploadingIndicator(props: { done: () => void; fileUpload: TempFileUploading }) {
	const progress = useStore(() => props.fileUpload.progress);
	const error = useStore(() => props.fileUpload.error);

	createEffect(() => {
		const errored = error();

		let timeout: any;

		if (errored) {
			timeout = setTimeout(() => {
				props.done();
			}, 2000);
		}

		onCleanup(() => {
			clearTimeout(timeout);
		});
	});

	createEffect(() => {
		if (progress() >= 100) {
			props.done();
		}
	});

	return (
		<div>
			<Show
				when={error()}
				fallback={
					<>
						Uploading {props.fileUpload.id}: {progress()}%
					</>
				}
			>
				Error!
			</Show>
		</div>
	);
}

export default function TemporaryUploadingIndicator() {
	return (
		<div class={styles.container}>
			<For each={temp_uploadingFiles()}>
				{(e) => (
					<UploadingIndicator
						done={() => {
							temp_setUploadingFiles((a) => without(a, e));
						}}
						fileUpload={e}
					/>
				)}
			</For>
		</div>
	);
}
