import { cloudphone } from "@/config";

const features = ["AudioCapture", "VideoUpload", "FileDownload", "FileUpload", "ImageUpload"] as const;
export class CloudphoneFeatures {
	AudioCapture = false;
	VideoUpload = false;
	FileDownload = false;
	FileUpload = false;
	ImageUpload = false;
	ready: Promise<true>;

	constructor() {
		this.ready = this.init();
	}

	async init(): Promise<true> {
		if (!cloudphone) return true;

		const results = await Promise.all(features.map((a) => this.detect(a)));

		features.forEach((a, i) => {
			this[a] = results[i];
		});

		return true;
	}

	private detect(name: string) {
		return navigator.hasFeature?.(name) || false;
	}
}
