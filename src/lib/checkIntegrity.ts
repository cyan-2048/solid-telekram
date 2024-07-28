import { isEqual } from "lodash-es";

async function hash(buffer: ArrayBuffer) {
	return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)), (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
}

/**
 * this checks the integrity of the app, I don't like it when people mess with my code 😡
 * @param fileURL
 */
export default async function checkIntegrity(fileURL: string) {
	if (import.meta.env.DEV) {
		console.log("skipping integrity check in dev mode");
		return true;
	}

	const isKai3 = import.meta.env.VITE_KAIOS == 3;
	const manifest = import.meta.env.MANIFEST;

	const manifestURL = isKai3 ? "/manifest.webmanifest" : "/manifest.webapp";

	const response = await fetch(manifestURL);
	const fetchedManifest = await response.json();
	const manifestCheck = isEqual(manifest, fetchedManifest);

	if (!manifestCheck) {
		console.error("Integrity check failed for manifest");
		return false;
	}

	const response2 = await fetch(fileURL);
	const buffer = await response2.arrayBuffer();

	const hashOfBuffer = await hash(buffer);

	const originalHash = "MAIN_HASH_GOES_HERE";
	const originalHashHTML = "HTML_HASH_GOES_HERE";

	if (hashOfBuffer !== originalHash) {
		console.error("Integrity check failed for main bundle", originalHash, hashOfBuffer);
		return false;
	}

	const response3 = await fetch("/index.html");
	const buffer2 = await response3.arrayBuffer();

	const hashOfBuffer2 = await hash(buffer2);

	if (hashOfBuffer2 !== originalHashHTML) {
		console.error("Integrity check failed for index.html", originalHashHTML, hashOfBuffer2);
		return false;
	}

	return true;
}
