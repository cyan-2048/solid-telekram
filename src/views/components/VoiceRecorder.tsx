// taken from vencord uwu

// @ts-ignore
import clamp from "lodash-es/clamp";

import styles from "./VoiceRecorder.module.scss";
import { formatTime, pauseKeypress, resumeKeypress, useKeypress } from "@/lib/utils";
import { Show, createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from "solid-js";
import SpatialNavigation from "@/lib/spatial_navigation";
import { setSoftkeys } from "@signals";

function blobToArrayBuffer(blob: Blob | File): Promise<ArrayBuffer> {
	if ("arrayBuffer" in blob) {
		return blob.arrayBuffer();
	}

	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			resolve(reader.result as ArrayBuffer);
		};
		reader.onerror = reject;
		reader.readAsArrayBuffer(blob);
	});
}

export const VoiceRecorderWeb = (props: {
	setAudioBlob: (blob: Blob, waveform: number[], duration: number) => void;
	onComplete: (shouldSend: boolean) => void;
}) => {
	const [recording, setRecording] = createSignal(false);
	const [paused, setPaused] = createSignal(false);
	const [time, setTime] = createSignal(0);
	const [audioPreview, setAudioPreview] = createSignal<HTMLAudioElement | null>(null);

	let divRef!: HTMLDivElement;
	let recorder: MediaRecorder;
	let chunks = [] as Blob[];
	let currentStream: MediaStream;

	let audioRef!: HTMLAudioElement;

	onMount(() => {
		SpatialNavigation.pause();
		divRef.focus();
	});

	onCleanup(() => {
		audioRef.pause();
		URL.revokeObjectURL(audioRef.src);

		divRef.blur();
		SpatialNavigation.resume();
	});

	const changeRecording = (recording: boolean) => {
		setRecording(recording);
	};

	let shouldSendImmediately = false;

	function toggleRecording() {
		const nowRecording = !recording();

		if (nowRecording) {
			setTime(0);
			navigator.mediaDevices
				.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
					},
				})
				.then((stream) => {
					currentStream = stream;
					const _chunks = [] as Blob[];
					chunks = _chunks;

					const _recorder = new MediaRecorder(stream);
					recorder = _recorder;
					_recorder.addEventListener("dataavailable", (e) => {
						_chunks.push(e.data);
					});
					_recorder.start();

					changeRecording(true);
				});
		} else {
			if (recorder) {
				recorder.addEventListener("stop", async () => {
					const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });

					const audioContext = new AudioContext();
					const audioBuffer = await audioContext.decodeAudioData(await blobToArrayBuffer(blob));
					const rawData = audioBuffer.getChannelData(0);

					const samples = 100; // Number of samples we want to have in our final data set
					const blockSize = Math.floor(rawData.length / samples); // the number of samples in each subdivision
					const filteredData = [];
					for (let i = 0; i < samples; i++) {
						let blockStart = blockSize * i; // the location of the first sample in the block
						let sum = 0;
						for (let j = 0; j < blockSize; j++) {
							sum = sum + Math.abs(rawData[blockStart + j]); // find the sum of all the samples in the block
						}
						filteredData.push(sum / blockSize); // divide the sum by the block size to get the average
					}

					const multiplier = Math.pow(Math.max(...filteredData), -1);

					// props.setAudioBlob(blob, btoa(String.fromCharCode(...bins)), audioBuffer.duration);
					props.setAudioBlob(
						blob,
						filteredData.map((n) => Math.floor(n * multiplier * 31)),
						audioBuffer.duration
					);
					changeRecording(false);

					if (shouldSendImmediately) {
						props.onComplete(true);
					}
				});

				recorder.stop();
				currentStream?.getTracks().forEach((track) => track.stop());
			}
		}
	}

	createEffect(() => {
		let interval: any;

		const _recording = recording();
		const _paused = paused();

		if (_recording && _paused === false) {
			interval = setInterval(() => {
				setTime((time) => time + 1);
			}, 1000);
		} else {
			clearInterval(interval);
		}

		onCleanup(() => {
			clearInterval(interval);
		});
	});

	createEffect(() => {
		let left = "",
			center = "",
			right = "";
		if (!audioPreview() && !recording() && !!time()) left = "Preview";
		if (audioPreview()) left = "Stop";

		if (recording()) {
			left = "Send";
			center = paused() ? "Resume" : "Pause";
			right = "Stop";
		} else {
			center = "Record";
			if (time()) {
				right = "Send";
			}
		}

		setSoftkeys(left, center, right);
	});

	const [previewTime, setPreviewTime] = createSignal(0);

	const previewWidth = createMemo(() => Math.min((previewTime() / time()) * 100, 100) + "px");

	return (
		<div
			class={styles.recorder}
			onKeyDown={(e) => {
				if (e.currentTarget !== divRef) return;
				if (e.currentTarget !== document.activeElement) return;

				switch (e.key) {
					case "Backspace":
						e.preventDefault();
						props.onComplete(false);
						break;
					case "SoftRight":
						{
							if (recording()) {
								toggleRecording();
							}
							if (!recording() && !!time()) {
								props.onComplete(true);
							}
						}
						break;
					case "Enter": {
						if (recording()) {
							if (untrack(paused)) recorder?.resume();
							else recorder?.pause();
							setPaused((a) => !a);
						} else {
							toggleRecording();
						}
						break;
					}
					case "SoftLeft": {
						if (recording()) {
							shouldSendImmediately = true;
							toggleRecording();
						}

						if (!recording() && !!time()) {
							const _audioPreview = audioPreview();
							if (_audioPreview) {
								_audioPreview.pause();
								_audioPreview.currentTime = 0;
								setAudioPreview(null);
							} else {
								const audio = audioRef;

								if (!audio.src) {
									const src = URL.createObjectURL(new Blob(chunks, { type: "audio/ogg; codecs=opus" }));
									audio.src = src;
								}

								audio.play();
								audio.onended = () => {
									// URL.revokeObjectURL(audio.src);
									setAudioPreview(null);
									setPreviewTime(0);
								};
								setAudioPreview(audio);
							}
						}
						break;
					}
				}
			}}
			ref={divRef}
			tabIndex={-1}
		>
			<audio
				onTimeUpdate={(e) => {
					setPreviewTime(e.currentTarget.currentTime);
				}}
				ref={audioRef}
			></audio>

			<Show
				when={!recording() && !!time()}
				fallback={
					<div
						style={{
							background: recording() ? "rgb(229, 57, 53)" : undefined,
						}}
						class={styles.recording}
					>
						<svg
							viewBox="0 0 14 20"
							style={{
								fill: "#fff",
								"margin-right": "9px",
								height: "20px",
							}}
							class={recording() && !paused() ? styles.animateMicrophone : undefined}
						>
							<path d="M7.979 15.462v3.131a.652.652 0 01-.643.657h-.657a.652.652 0 01-.642-.657v-3.131a6.667 6.667 0 01-2.694-1.031 6.97 6.97 0 01-3.029-4.7 4.96 4.96 0 01-.063-.476.633.633 0 01.17-.463.607.607 0 01.446-.193h.652a.742.742 0 01.713.652c.058.474.178.939.357 1.38a4.929 4.929 0 002.602 2.56 4.766 4.766 0 003.58.03 4.927 4.927 0 002.602-2.437 5.639 5.639 0 00.421-1.534.753.753 0 01.72-.65h.652a.577.577 0 01.433.194.6.6 0 01.148.459 8.296 8.296 0 01-.357 1.735c-.87 2.41-2.96 4.113-5.411 4.474zM9.165.913c.574.586.896 1.38.896 2.207v5.462a3.135 3.135 0 01-1.514 2.745 3.003 3.003 0 01-3.086 0 3.135 3.135 0 01-1.513-2.745V3.12C3.948 1.397 5.316 0 7.004 0c.81 0 1.588.328 2.161.913z"></path>
						</svg>
						<Show when={!recording()} fallback={<>{formatTime(time())}</>}>
							<div>Press again to record</div>
						</Show>
					</div>
				}
			>
				<div class={styles.preview}>
					<svg viewBox="0 0 14 20" class={styles.microphone}>
						<path d="M7.979 15.462v3.131a.652.652 0 01-.643.657h-.657a.652.652 0 01-.642-.657v-3.131a6.667 6.667 0 01-2.694-1.031 6.97 6.97 0 01-3.029-4.7 4.96 4.96 0 01-.063-.476.633.633 0 01.17-.463.607.607 0 01.446-.193h.652a.742.742 0 01.713.652c.058.474.178.939.357 1.38a4.929 4.929 0 002.602 2.56 4.766 4.766 0 003.58.03 4.927 4.927 0 002.602-2.437 5.639 5.639 0 00.421-1.534.753.753 0 01.72-.65h.652a.577.577 0 01.433.194.6.6 0 01.148.459 8.296 8.296 0 01-.357 1.735c-.87 2.41-2.96 4.113-5.411 4.474zM9.165.913c.574.586.896 1.38.896 2.207v5.462a3.135 3.135 0 01-1.514 2.745 3.003 3.003 0 01-3.086 0 3.135 3.135 0 01-1.513-2.745V3.12C3.948 1.397 5.316 0 7.004 0c.81 0 1.588.328 2.161.913z"></path>
					</svg>
					<svg viewBox="0 0 20 20" class={styles.icon}>
						<path d="M4 3.1v13.8c0 .9 1 1.5 1.8 1 3.1-1.7 9.4-5.2 12.5-6.9.8-.5.8-1.6 0-2.1L5.8 2C5 1.6 4 2.2 4 3.1z"></path>
						{
							// paused icon
							// <path d="M6.7 2.1H4.4c-.7 0-1.2.5-1.2 1.2v13.5c0 .7.5 1.2 1.2 1.2h2.3c.7 0 1.2-.5 1.2-1.2V3.3c0-.7-.5-1.2-1.2-1.2zm8.9 0h-2.3c-.7 0-1.2.5-1.2 1.2v13.5c0 .7.5 1.2 1.2 1.2h2.3c.7 0 1.2-.5 1.2-1.2V3.3c0-.7-.5-1.2-1.2-1.2z"></path>
						}
					</svg>
					<div class={styles.progress}>
						<div class={styles.bar}>
							<div class={styles.drinks}>
								<div style={{ left: previewWidth() }} class={styles.meat}></div>
								<div style={{ width: previewWidth() }} class={styles.balls}></div>
							</div>
						</div>
						<div class={styles.time}>{audioPreview() ? formatTime(previewTime()) : formatTime(time())}</div>
					</div>
				</div>
			</Show>
		</div>
	);
};
