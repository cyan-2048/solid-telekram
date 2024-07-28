import fs from "fs";
import { resolve } from "path";
import crypto from "crypto";

// the plugin should only work if you're building for KaiOS
const production = process.env.NODE_ENV === "production";

/**
 *
 * @returns {import("vite").Plugin | undefined}
 */
export default function kaiManifest({ isKai3 = false, manifest = {} }) {
	let config;

	let integrityJS = "";
	let indexJS = "";

	if (production)
		return {
			name: "kai-manifest",

			configResolved(_config) {
				config = _config;
			},

			writeBundle() {
				const distFolder = resolve(config.root, config.build.outDir);

				fs.existsSync(distFolder) || fs.mkdirSync(distFolder);

				const filePath = resolve(
					config.root,
					config.build.outDir,
					isKai3 ? "manifest.webmanifest" : "manifest.webapp"
				);
				fs.writeFileSync(filePath, JSON.stringify(manifest));

				const buffer = fs.readFileSync(resolve(config.root, config.build.outDir, indexJS));
				const indexBuffer = fs.readFileSync(
					resolve(config.root, config.build.outDir, "index.html")
				);

				const file = resolve(config.root, config.build.outDir, integrityJS);
				const text = fs.readFileSync(file, "utf-8");
				fs.writeFileSync(
					file,
					text
						.replace("MAIN_HASH_GOES_HERE", crypto.hash("sha256", buffer))
						.replace("HTML_HASH_GOES_HERE", crypto.hash("sha256", indexBuffer))
				);
			},

			generateBundle(options, bundle) {
				for (const fileName in bundle) {
					if (fileName.endsWith(".js")) {
						if (fileName.includes("checkIntegrity")) integrityJS = fileName;
						if (fileName.includes("index")) indexJS = fileName;
					}
				}
			},
		};
}
