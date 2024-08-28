// this is entire thing is very temporary please get rid of it ASAP lmao

import { writable } from "@/lib/stores";
import { createSignal } from "solid-js";

let counter = 0;

export class TempFileUploading {
	progress = writable(0);
	error = writable(false);
	id = ++counter;
}

export const [temp_uploadingFiles, temp_setUploadingFiles] = createSignal<TempFileUploading[]>([]);

function UploadingIndicator(props: { done: () => void }) {}

export default function TemporaryUploadingIndicator() {
	return <div></div>;
}
