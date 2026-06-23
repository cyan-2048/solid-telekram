import { resolve } from "path";
import fs from "fs/promises";

const local = resolve(__dirname, "..", ".env.local");

let localFileContent = "";

// if a local env file is present copy the contents and put it back later
if (await Bun.file(local).exists()) {
	localFileContent = await Bun.file(local).text();
}

// Number.MAX_SAFE_INTEGER - Math.floor(Number.MAX_SAFE_INTEGER / 2)
const SAFE_INTEGER = 4503599627370496;
// (BigInt(Math.PI.toFixed(40).replace(".","")) * 4n).toString(16)
const RANDOM_STRING = "1714add755dc69de3dd72c7aaee15e5aa88";

const TEXT = `VITE_APP_ID=${SAFE_INTEGER}
VITE_APP_HASH="${RANDOM_STRING}"`;

const IS_PREVIEW = Bun.argv[2] === "--preview";

try {
	await Bun.write(local, TEXT);

	await Bun.$`git switch main`;

	// build files
	await Bun.$`bun run build`;
	await Bun.$`bun run build:v3`;
	await Bun.$`bun run build:v4`;

	let appVersion = "";

	if (IS_PREVIEW) {
		await Bun.$`git switch gh-pages`;

		for (let i = 2; i < 5; i++) {
			const zipFile = resolve(__dirname, "..", "builds", `telekram4kai${i}.zip`);
			const destination = resolve(__dirname, "..", "preview", `telekram4kai${i}.zip`);

			await Bun.write(destination, Bun.file(zipFile));
		}
	} else {
		const manifestFile = resolve(__dirname, "..", "src", "assets", "manifest.webapp");
		appVersion = (await Bun.file(manifestFile).json()).version as string;

		await Bun.$`git switch gh-pages`;

		for (let i = 2; i < 5; i++) {
			const zipFile = resolve(__dirname, "..", "builds", `telekram4kai${i}.zip`);
			const destination = resolve(__dirname, "..", "v", appVersion, `telekram4kai${i}.zip`);

			await Bun.write(destination, Bun.file(zipFile));
		}

		const source = resolve(__dirname, "..", "v");
		const folderNames = (await fs.readdir(source, { withFileTypes: true }))
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name);
		folderNames.sort(new Intl.Collator(undefined, { numeric: true }).compare);
		const versionsJSON = JSON.stringify(folderNames);

		await Bun.write(resolve(__dirname, "..", "v", "versions.json"), versionsJSON);
	}

	await Bun.$`git add .`;

	// Check if there is anything staged
	const { exitCode } = await Bun.$`git diff --cached --quiet`.nothrow();

	if (exitCode !== 0) {
		if (appVersion) {
			await Bun.$`git commit -m "Publish v${appVersion}"`;
		} else {
			await Bun.$`git commit -m "update preview build"`;
		}

		await Bun.$`git push origin gh-pages`;
	} else {
		console.log("No changes to publish");
	}
} finally {
	await Bun.$`git switch main`;

	if (localFileContent) {
		await Bun.write(local, localFileContent);
	}
}
