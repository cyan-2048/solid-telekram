import { onCleanup, onMount } from "solid-js";
import Content from "@components/Content";
import Header from "@components/Header";
import * as styles from "./QRScanner.module.scss";
import { setSoftkeys, sleep } from "@/utils";
import once from "lodash-es/once";

let jsQR!: typeof import("jsqr")["default"];

let _init: null | Promise<void> = null;

async function _initQR() {
	jsQR = (await import("jsqr")).default;
}

function initQR() {
	return _init || (_init = _initQR());
}

export default function QRScanner(props: { onResult: (result: string | null) => void; title?: string }) {
	let stream!: MediaStream;
	let status: "idle" | "scanning" | "cancelled" = "idle";
	let videoEl!: HTMLVideoElement;
	let divEl!: HTMLDivElement;

	// should only be called once
	const onResult = once(props.onResult);

	function checkForQRCode(): Promise<string | null> {
		const stop = () => stream.getTracks().forEach((a) => a.stop());
		return new Promise((resolve, reject) => {
			const canvas = document.createElement("canvas");
			canvas.width = videoEl.videoWidth;
			canvas.height = videoEl.videoHeight;
			const context = canvas.getContext("2d") as CanvasRenderingContext2D;

			async function loop() {
				if (status === "cancelled") {
					stop();
					return resolve(null);
				}

				context.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
				const imageData = context.getImageData(0, 0, videoEl.videoWidth, videoEl.videoHeight);
				const code = jsQR(imageData.data, videoEl.videoWidth, videoEl.videoHeight);
				await sleep(5);

				if (code) {
					stop();
					resolve(code.data);
					return;
				}

				loop();
			}

			loop();
		});
	}

	function startVideo() {
		return new Promise<void>((resolve, reject) => {
			navigator.mediaDevices
				.getUserMedia({
					audio: false,
					video: {
						width: 240,
						height: 240,
					},
				})
				.then((_stream) => {
					videoEl.srcObject = _stream;

					stream = _stream;

					videoEl.onloadedmetadata = () => {
						videoEl.play();
						resolve();
					};
				}, reject);
		});
	}

	let prevActiveElement!: HTMLElement;

	onMount(() => {
		prevActiveElement = document.activeElement as HTMLElement;
		divEl.focus();
	});

	onMount(async () => {
		setSoftkeys("Cancel", "", "", false, true);

		status = "scanning";
		try {
			await initQR();

			await startVideo();
			const result = await checkForQRCode();
			onResult(result);
		} catch {
			onResult(null);
		}
	});

	function handleKeypress(ev: KeyboardEvent) {
		ev.stopImmediatePropagation();
		ev.stopPropagation();
		ev.preventDefault();

		if (ev.key !== "SoftLeft" && ev.key !== "Backspace") {
			return;
		}

		status = "cancelled";

		onResult(null);
	}

	onCleanup(() => {
		status = "cancelled";
		prevActiveElement.focus();
	});

	return (
		<Content before={<Header>{props.title != null ? props.title : "Scan a QR Code"}</Header>}>
			<div
				onBlur={(e) => {
					if (status === "scanning") {
						const target = e.currentTarget;
						sleep().then(() => target.focus());
					}
				}}
				ref={divEl}
				onKeyDown={handleKeypress}
				tabIndex={0}
				class={styles.container}
			>
				<video class={styles.video} ref={videoEl}></video>
			</div>
		</Content>
	);
}
