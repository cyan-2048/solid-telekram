// taken from K-Music

function startVolumeManager() {
	// @ts-ignore
	const session = new lib_session.Session();
	const sessionstate = {};
	// @ts-ignore
	navigator.volumeManager = null;
	// @ts-ignore
	sessionstate.onsessionconnected = function () {
		// console.log(`AudioVolumeManager onsessionconnected`);
		// @ts-ignore
		lib_audiovolume.AudioVolumeManager.get(session)
			// @ts-ignore
			.then((AudioVolumeManagerService) => {
				// console.log(`Got AudioVolumeManager : #AudioVolumeManagerService.service_id}`);
				navigator.volumeManager = AudioVolumeManagerService;
			})
			// @ts-ignore
			.catch((e) => {
				// console.log(`Error calling AudioVolumeManager service${JSON.stringify(e)}`);
				// @ts-ignore
				navigator.volumeManager = null;
			});
	};
	// @ts-ignore
	sessionstate.onsessiondisconnected = function () {
		startVolumeManager();
	};
	session.open("websocket", "localhost:8081", "secrettoken", sessionstate, true);
}

const loadScripts = (() => {
	if (navigator.b2g) {
		const head = document.head;
		const scripts = [
			"http://127.0.0.1:8081/api/v1/shared/core.js",
			"http://127.0.0.1:8081/api/v1/shared/session.js",
			"http://127.0.0.1:8081/api/v1/audiovolumemanager/service.js",
		];
		const promises = scripts.map((path) => {
			var script = document.createElement("script");
			script.type = "text/javascript";
			script.src = path;

			const promise = new Promise((res) => {
				script.onload = () => {
					res(true);
					script.remove();
				};
			});

			head.appendChild(script);
			return promise;
		});

		return Promise.all(promises).then(() => true);
	}

	return Promise.resolve(false);
})();

loadScripts.then((polyfill) => {
	if (polyfill) startVolumeManager();
});

export function volumeUp() {
	// @ts-ignore
	if (navigator.b2g && navigator.b2g.audioChannelManager && navigator.volumeManager) {
		// @ts-ignore
		navigator.volumeManager.requestVolumeUp();
		// @ts-ignore
	} else if (navigator.mozAudioChannelManager) {
		// @ts-ignore
		navigator.volumeManager.requestUp();
	}
}

export function volumeDown() {
	// @ts-ignore
	if (navigator.b2g && navigator.b2g.audioChannelManager && navigator.volumeManager) {
		// @ts-ignore
		navigator.volumeManager.requestVolumeDown();
		// @ts-ignore
	} else if (navigator.mozAudioChannelManager) {
		navigator.volumeManager.requestDown();
	}
}
