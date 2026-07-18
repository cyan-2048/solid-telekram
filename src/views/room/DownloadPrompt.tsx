import { niceBytes, NOOP } from "@/helpers";
import { downloadFile } from "@/lib/storage";
import { downloadToFile, mediaFilename, setSoftkeys } from "@/utils";
import type { FileLocation, MessageMedia, Sticker } from "@mtcute/core";
import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import * as styles from "./DownloadPrompt.module.scss";

type DownloadableMedia = Extract<
	Exclude<MessageMedia, null | Sticker>,
	{ fileId: string; type: string } | FileLocation
>;

/**
 * Show this prompt if file has to be downloaded before actually being downloaded using input + click
 */
export default function DownloadPrompt(props: { file: FileLocation | DownloadableMedia; onClose: () => void }) {
	const [src, setSrc] = createSignal("");
	const [progress, onProgress] = createSignal(0);
	const [downloaded, setDownloaded] = createSignal(0);
	const [total, setTotal] = createSignal(0);

	let cancel = NOOP;

	let divRef!: HTMLDivElement;

	onMount(() => {
		divRef.focus();

		queueMicrotask(() => {
			setSoftkeys("Cancel", "", "", false, true);
		});

		let mounted = true;

		const download = downloadFile(props.file);

		let url!: string;

		const stateChange = () => {
			if (download.state == "done") {
				cancel = NOOP;
				if (mounted) {
					onProgress(100);
					setDownloaded(download.result.size);
					setTotal(download.result.size);

					setSrc((url = URL.createObjectURL(download.result)));
				}
			}
		};

		if (download.state == "done") {
			stateChange();
			onProgress(100);
			setDownloaded(download.result.size);
			setTotal(download.result.size);

			onCleanup(() => {
				mounted = false;
				URL.revokeObjectURL(url);
			});

			return;
		}

		cancel = () => {
			if (
				download.listenerCount("state") > 1 ||
				download.listenerCount("progress") > 1 ||
				download.listenerCount("done") > 1
			) {
				// if there are other places downloading this file
			} else {
				download.abort();
			}
		};

		download.on("state", stateChange);

		function progressChange() {
			onProgress(download.progress);
			if (typeof props.file.fileSize === "number") {
				setTotal(props.file.fileSize);
				setDownloaded(Math.round((download.progress / 100) * props.file.fileSize));
			}
		}

		download.on("progress", progressChange);

		onCleanup(() => {
			cancel();
			mounted = false;
			download.off("state", stateChange);
			download.off("progress", progressChange);
			URL.revokeObjectURL(url);
		});
	});

	createEffect(() => {
		setSoftkeys("Cancel", "", src() ? "Download" : "", false, true);
	});

	const fileName = createMemo(() => {
		const file = props.file;

		if ("fileName" in file && file.fileName) {
			return file.fileName;
		}
		if ("type" in file) {
			return mediaFilename(file);
		}
	});

	return (
		<div
			on:keydown={(e) => {
				if (e.key == "Backspace") {
					e.preventDefault();
				}

				if (e.key == "SoftRight") {
					downloadToFile(src(), fileName());
				}
			}}
			onKeyUp={(e) => {
				if (e.key == "SoftLeft" || e.key == "Backspace") {
					cancel();
					props.onClose();
				}
			}}
			tabIndex={-1}
			class={styles.download}
			ref={divRef}
		>
			<div class={styles.info}>
				<div class={styles.filename}>{fileName() || "Unknown File"}</div>
				<div class={styles.size}>{niceBytes(total())}</div>
			</div>
			<div class={styles.progressBarWrapper}>
				<div class={styles.progressBarBg}>
					<div class={styles.progressBar} style={{ width: progress() + "%" }}></div>
				</div>
			</div>
			<div class={styles.progressInfo}>
				<span>{niceBytes(downloaded())}</span>
				<span> / </span>
				<span>{niceBytes(total())}</span>
				<span> ({progress()}%)</span>
			</div>
		</div>
	);
}
