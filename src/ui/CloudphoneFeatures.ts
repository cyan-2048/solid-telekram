import { cloudphone } from "@/config";

const features = ["AudioCapture", "VideoUpload", "FileDownload", "FileUpload", "ImageUpload"] as const;
type FeatureName = (typeof features)[number];
type FeatureFlags = Record<FeatureName, boolean>;

export class CloudphoneFeatures {
	ready: Promise<true>;

	constructor() {
		for (let i = 0; i < features.length; i++) {
			this[features[i]] = false;
		}
		this.ready = this.init();
	}

	async init(): Promise<true> {
		if (!cloudphone) return true;

		const results = await Promise.all(features.map((a) => this.detect(a)));

		for (let i = 0; i < features.length; i++) {
			this[features[i]] = results[i];
		}

		return true;
	}

	private detect(name: FeatureName) {
		return navigator.hasFeature?.(name) || false;
	}
}

export interface CloudphoneFeatures extends FeatureFlags {}
