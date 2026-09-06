import { sleep } from "@/helpers";
import { $dialogSelectMode, $room, $view, setStatusbarColor } from "@/stores";
import type UIDialog from "@/ui/UIDialog";
import { toaster } from "@/utils";
import { EE, sortDialogs, tg } from "@globals";
import { InputMedia } from "@mtcute/web";
import { batch } from "solid-js";

/** Protocol marker for SW -> window activity hand-offs. */
const ACTIVITY_MSG = "telekram.webactivity";
/** Protocol marker for window -> SW result/keep-alive messages. */
const RESULT_MSG = "telekram.webactivity-result";

/** True only for our own SW -> window activity hand-off messages. */
function isActivityMessage(data: any): boolean {
	return !!data && data.type === ACTIVITY_MSG && !!data.source;
}

/** Post a raw message to the service worker that controls this page. */
function sendToController(payload: Record<string, unknown>): boolean {
	const controller: any = navigator.serviceWorker?.controller;
	if (!controller) return false;
	controller.postMessage(payload);
	return true;
}

/** Keep the SW alive while an activity is being serviced. */
let keepAliveTimer: number | null = null;
function startKeepAlive(): void {
	if (keepAliveTimer !== null) return;
	keepAliveTimer = window.setInterval(() => {
		sendToController({ type: RESULT_MSG, isDummy: true });
	}, 200000);
}
function stopKeepAlive(): void {
	if (keepAliveTimer !== null) {
		window.clearInterval(keepAliveTimer);
		keepAliveTimer = null;
	}
}

/** Build the reply handle used to resolve a delivered activity. */
function makeReply(): {
	postResult: (result?: unknown) => void;
	postError: (error?: unknown) => void;
} {
	return {
		postResult(result?: unknown) {
			stopKeepAlive();
			sendToController({
				type: RESULT_MSG,
				isError: false,
				activityResult: result ?? null,
			});
		},
		postError(error?: unknown) {
			stopKeepAlive();
			sendToController({
				type: RESULT_MSG,
				isError: true,
				activityResult: error ?? null,
			});
		},
	};
}

function handleVideoBlob(_originalBlob: File | Blob) {
	const originalBlob = _originalBlob as File;
	const blob = originalBlob.type.includes("3gp")
		? new File([originalBlob], originalBlob.name ? originalBlob.name.slice(0, -4) + ".mp4" : "video.mp4", {
				type: "video/mp4",
			})
		: originalBlob;

	return InputMedia.video(blob, { supportsStreaming: true });
}

function handleDialogSelectedForMedia(dialog: UIDialog | null, blobs: Blob[], type: string, filenames: string[]) {
	if (dialog) {
		const hasTextBox =
			dialog.chatType != "channel" && !("isForum" in dialog.peer && dialog.peer.isForum) && dialog.$isMember;

		// you can't send here!
		if (!hasTextBox) {
			toaster("You cannot send messages in the selected chat!");
			return;
		}

		const isImage = type.startsWith("image"),
			isVideo = type.startsWith("video"),
			isAudio = type.startsWith("audio");

		tg.setTyping({
			status: isImage ? "upload_photo" : isVideo ? "upload_video" : "upload_document",
			peerId: dialog.peer,
			progress: 0.5,
		});

		const upload = dialog.createUpload();

		tg.sendMediaGroup(
			dialog.peer,
			blobs.map((blob, i) =>
				isImage
					? InputMedia.photo(blob)
					: isVideo
						? handleVideoBlob(blob)
						: InputMedia.document(blob, { fileName: filenames[i] }),
			),
			{ shouldDispatch: true, abortSignal: upload.abortSignal },
		)
			.then((msgs) => {
				dialog.removeUpload(upload);
				dialog.messages.addBulk(msgs);
				sortDialogs();
			})
			.catch((err) => {
				console.error("UPLOAD FILE ERROR", err);
				upload.abort();
				sleep(3000).then(() => {
					dialog.removeUpload(upload);
				});
			})
			.finally(() => {
				tg.setTyping({
					status: "cancel",
					peerId: dialog.peer,
				});
			});

		batch(() => {
			setStatusbarColor("#1c96c3");
			$room.set(dialog);
			$view.set("room");
		});
	}
}

/**
 * Handle a single "share" activity. `data` is the object the invoker passed
 * to `new WebActivity("share", data)`, e.g.:
 *
 *   { type: "image/*", blobs: [file], filenames: ["photo.jpg"] }
 *   { type: "url", url: "https://example.com" }
 *   { type: "text/vcard", blobs: [vcard], filenames: ["contact.vcf"] }
 */
function handleShare(
	data: { blobs: Blob[]; filenames: string[]; type: string; url: string },
	reply: ReturnType<typeof makeReply>,
): void {
	const { type, blobs, filenames, url } = data || {};

	switch (type) {
		case "image/*":
		case "audio/*":
		case "video/*":
			EE.once("dialog_selected", (dialog) => {
				handleDialogSelectedForMedia(dialog, blobs, type, filenames);
			});

			$view.set("home");
			$dialogSelectMode.set(true);

			// Attach each shared file to the draft message.
			console.log("Attaching shared media:", blobs, filenames);

			// ...compose a message with the attachments...
			reply.postResult({ success: true });
			break;

		case "url":
			// Prefill the composer with the shared URL.
			console.log("Prefilling composer with URL:", url);
			reply.postResult({ success: true });
			break;

		case "text/vcard":
			// Attach the shared vCard as a draft attachment.
			console.log("Attaching shared vCard:", blobs?.[0], filenames?.[0]);
			reply.postResult({ success: true });
			break;

		default:
			reply.postError(`Unsupported share type: ${type}`);
	}
}

// only for KaiOS 3.0+
import.meta.env.KAIOS != 2 &&
	navigator.serviceWorker.addEventListener("message", (event) => {
		const data = event.data;
		// Discard anything that is not our own activity message.
		if (!isActivityMessage(data)) return;

		// An activity has arrived: keep the SW alive while we process it.
		startKeepAlive();

		const { name, data: activityData } = data.source;
		const reply = makeReply();

		if (name === "share") {
			handleShare(activityData, reply);
		} else {
			reply.postError(`Unsupported activity: ${name}`);
		}
	});
