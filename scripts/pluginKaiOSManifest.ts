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

function readManifest() {
	const manifestFileName = getManifestFileName();
	const manifest = JSON.parse(fs.readFileSync(resolve("src", "assets", manifestFileName), "utf8"));

	if (isKai4) {
		const version = manifest.b2g_features.version;
		manifest.b2g_features.version = version.replace(/^3\./, "4.");
	}

	return manifest;
}

function resolveManifestVersion(manifest: any) {
	return isKai3 || isKai4 ? manifest.b2g_features.version : manifest.version;
}

function getCommitMessage() {
	try {
		const message = execSync("git log -1 --pretty=%B", { stdio: "ignore" }).toString().trim();
		return message;
	} catch (err) {}
	return null;
}

function getCommitHash() {
	try {
		return execSync('git log -1 --pretty=format:"%H"', { stdio: "ignore" }).toString().trim();
	} catch {}

	return null;
}

export function pluginKaiOSManifest(): RsbuildPlugin {
	try {
		const manifest = readManifest();
		process.env.APP_VERSION = resolveManifestVersion(manifest);
	} catch {
		// Keep existing APP_VERSION fallback if manifest read fails during config evaluation.
	}

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

					const manifest = readManifest();

					if (isKai2 && asmjsAssets.length) {
						// I should probably split up the asm.js files hmmm
						// (actually did do that already lol)
						manifest.precompile = asmjsAssets;
					}

					const manifestJSON = JSON.stringify(manifest);

					compilation.emitAsset(
						manifestFileName,
						new compiler.webpack.sources.RawSource(Buffer.from(manifestJSON, "utf8")),
					);

					if (!isProd) return;
					if (!fs.existsSync(resolve("builds"))) fs.mkdirSync(resolve("builds"));

					const buildsManifestPath = resolve("builds", manifestFileName);
					const buildsVersionPath = resolve(
						"builds",
						isKai3 ? "version3.json" : isKai4 ? "version4.json" : "version.json",
					);

					fs.writeFileSync(buildsManifestPath, manifestJSON);
					fs.writeFileSync(
						buildsVersionPath,
						JSON.stringify({
							version: resolveManifestVersion(manifest),
							build: Date.now(),
							description: getCommitMessage(),
							hash: getCommitHash(),
						}),
					);
				},
			);
		},
	};
}
