import { CloudphoneFeatures } from "./ui/CloudphoneFeatures";

const params = new URLSearchParams(location.hash.slice(1));

export const apiId = params.get("api_id") || import.meta.env.VITE_APP_ID;
export const apiHash = params.get("api_hash") || import.meta.env.VITE_APP_HASH;
export const cloudphone: boolean =
	// if we are not in dev mode and we are built with the CloudPhone flag
	(!import.meta.env.DEV && import.meta.env.CLOUDPHONE) ||
	params.get("cloudphone") === "1" ||
	localStorage.getItem("CLOUDPHONE_MODE") === "true" ||
	navigator.userAgent.includes("Cloud Phone");

/**
 * this means that the user is on an actual cloudphone device!
 */
export const isCloudphone = params.get("cloudphone") === "1" || navigator.userAgent.includes("Cloud Phone");

export const cloudphone_features = new CloudphoneFeatures();
