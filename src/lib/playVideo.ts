import { startActivity, supportsActivity } from "./webActivities";

function playVideoUsingBrowser(videoUrl: string) {
	// play video using browser
	const win = window.open(
		"",
		"Video Player",
		"toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=240,height=320"
	);
	if (win)
		win.document.body.innerHTML = `<video autoplay controls mute style="width:100%; height: 100%" src="${videoUrl}"></video>`;
}

export default function playVideo(videoUrl: string) {
	if (supportsActivity()) {
		return startActivity("view", {
			type: ["video/webm", "video/mp4", "video/3gpp", "video/youtube"],
			url: videoUrl,
		});
	} else {
		playVideoUsingBrowser(videoUrl);
	}
}

Object.assign(window, { playVideo });
