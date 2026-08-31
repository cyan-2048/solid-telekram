import * as volume from "@/lib/lib_wallace/audio_volume";

// @ts-ignore
if (navigator.mozAudioChannelManager) {
	// @ts-ignore
	navigator.mozAudioChannelManager.volumeControlChannel = "content";
}

// @ts-ignore
if (navigator.audioChannelManager) {
	// @ts-ignore
	navigator.b2g.audioChannelManager.volumeControlChannel = "content";
}

if (import.meta.env.KAIOS != 2) {
	volume.ready();
}

export function volumeUp() {
	if (navigator.b2g && import.meta.env.KAIOS != 2) {
		volume.requestVolumeUp();
		// @ts-ignore
	} else if (navigator.mozAudioChannelManager) {
		navigator.volumeManager.requestUp();
		// cloudphone
	} else if (navigator.volumeManager) {
		navigator.volumeManager.requestUp();
	}
}

export function volumeDown() {
	if (navigator.b2g && import.meta.env.KAIOS != 2) {
		volume.requestVolumeDown();
		// @ts-ignore
	} else if (navigator.mozAudioChannelManager) {
		navigator.volumeManager.requestDown();
		// cloudphone
	} else if (navigator.volumeManager) {
		navigator.volumeManager.requestDown();
	}
}
