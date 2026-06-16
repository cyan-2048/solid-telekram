// my own custom plugin for kaios manifest files

import type { RsbuildPlugin } from "@rsbuild/core";
import fs from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const isKai2 = process.env.KAIOS != "3" && process.env.KAIOS != "4";
const isKai3 = process.env.KAIOS == "3";
const isKai4 = process.env.KAIOS == "4";

const isProd = process.env.NODE_ENV === "production";

function getManifestFileName() {
	return isKai3 || isKai4 ? "manifest.webmanifest" : "manifest.webapp";
}

function getAppVersion() {
	try {
		const manifest = JSON.parse(fs.readFileSync(resolve("src", "assets", "manifest.webapp"), "utf8"));
		return manifest.version as string;
	} catch {
		return null;
	}
}

function getManifest() {
	const manifest = JSON.parse(
		fs.readFileSync(resolve("src", "assets", isKai3 || isKai4 ? "manifest.webmanifest" : "manifest.webapp"), "utf8"),
	);
	return manifest;
}

export function pluginKaiOSManifest(): RsbuildPlugin {
	const appVersion = getAppVersion() ?? "1.0.0";

	process.env.APP_VERSION = appVersion;

	return {
		name: "kai-manifest-plugin",
		enforce: "post",
		setup(api) {
			api.onAfterBuild(() => {});

			api.processAssets(
				{
					stage:
						// https://rspack.rs/api/plugin-api/compilation-hooks#process-assets-stages
						// PROCESS_ASSETS_STAGE_REPORT is the last stage
						"report",
				},
				({ compiler, compilation }) => {
					const manifestFileName = getManifestFileName();

					const asmjsAssets = api.useExposed<string[]>("GET_ASM_ASSETS") || [];

					const manifest = getManifest();

					if (isKai2 && asmjsAssets.length) {
						manifest.precompile = asmjsAssets;
					}

					if (isKai3 || isKai4) {
						manifest.b2g_features.version = (isKai3 ? "3" : "4") + appVersion.slice(1);
					}

					const manifestJSON = JSON.stringify(manifest);

					compilation.emitAsset(
						manifestFileName,
						new compiler.webpack.sources.RawSource(Buffer.from(manifestJSON, "utf8")),
					);
				},
			);
		},
	};
}
