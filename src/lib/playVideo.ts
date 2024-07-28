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

function supportsActivity() {
	// @ts-ignore
	return typeof MozActivity !== "undefined" || typeof WebActivity !== "undefined";
}

function startActivity<Result = any, Data = {}>(name: string, data: Data) {
	// @ts-ignore:  KaiOS 2.5 uses MozActivity
	if (typeof MozActivity !== "undefined") {
		return new Promise<Result>((resolve, reject) => {
			// @ts-ignore
			new MozActivity<Result>({ name, data }).then(resolve, reject);
		});

		// KaiOS 3.0 uses WebActivity
		// @ts-ignore
	} else if (typeof WebActivity !== "undefined") {
		// @ts-ignore
		let activity = new WebActivity(name, data);

		return activity.start() as Promise<Result>;
	}

	// Not KaiOS?

	return Promise.resolve(null);
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
