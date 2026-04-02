// plugin for asm.js to work properly

// why??
// asm.js syntax very strict
// using swc or any minifier will break asm.js syntax

//
// related links about asm.js
// https://blog.mozilla.org/luke/2014/01/14/asm-js-aot-compilation-and-startup-performance/
//  ↳ firefox support for AOT compilation of asm.js
// https://kaios.dev/2024/03/webassembly-wasm-on-kaios/#declaring-asmjs-code
//  ↳ FFOS/KaiOS supports precompile of asm.js code
// https://github.com/evanw/esbuild/issues/856#issuecomment-782757256
//  ↳ esbuild minifier converts 0.0 into 0
// https://github.com/emscripten-core/emscripten/issues/18013#issuecomment-2103266957
//  ↳ emscripten asm.js instructions (use old version of emscripten)
//

import type { RsbuildConfig, RsbuildPlugin } from "@rsbuild/core";
import fs from "fs";

// WARNING
// in order for this to work properly all asm.js files must be in this format
/*
var Module = ...
export default Module;
*/
// asm.js file MUST be imported dynamically

const isProd = process.env.NODE_ENV === "production";

export function pluginAsmJS(): RsbuildPlugin {
	const resources: string[] = [];

	return {
		name: "asmjs-plugin",

		setup(api) {
			api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
				const extra: RsbuildConfig = {
					performance: isProd
						? {}
						: {
								chunkSplit: {
									forceSplitting: {
										asmjs: /\.asm\.js$/,
									},
								},
							},

					source: {
						// disable swc/core-js
						exclude: [/\.asm\.js$/],
					},
				};

				return mergeRsbuildConfig(config, extra);
			});

			api.onCloseBuild(() => {
				resources.length = 0;
			});

			// whenever importing .asm.js files, replace it with this loader code
			api.transform({ test: /\.asm\.js$/ }, ({ resourcePath }) => {
				resources.push(resourcePath);

				return `var Module=__LOAD_ASM_("${resourcePath}");export default Module;`;
			});

			const asmAssetsFinal: string[] = [];

			// replace with original code when assets are being processed
			api.processAssets(
				{
					stage:
						// https://rspack.rs/api/plugin-api/compilation-hooks#process-assets-stages
						// PROCESS_ASSETS_STAGE_REPORT is the last stage
						"report",
				},
				({ assets, compiler, compilation }) => {
					if (resources.length === 0) return;

					const asmjsAssets = Object.getOwnPropertyNames(assets).filter((filename) => {
						if (!isProd) return filename.includes("asmjs") && filename.endsWith(".js");

						const asset = assets[filename];

						if (!filename.endsWith(".js")) return false;

						const buffer = asset.source();
						const code = Buffer.isBuffer(buffer) ? buffer.toString("utf-8") : buffer;

						return code.includes("__LOAD_ASM_(");
					});

					if (!asmjsAssets.length) {
						// throw new Error("asmjs chunk not found!");
						return;
					}

					asmjsAssets.forEach((asmjsAsset) => {
						const asset = assets[asmjsAsset];

						const { RawSource } = compiler.webpack.sources;
						const oldContentBuffer = asset.source();

						let mainBuffer = Buffer.isBuffer(oldContentBuffer)
							? oldContentBuffer
							: Buffer.from(oldContentBuffer, "utf-8");

						resources.forEach((resource) => {
							const text = fs
								.readFileSync(resource, "utf-8")
								.replace(/^var Module = /, "")
								.replace("export default Module;", "")
								.trim();

							// for some reason I needed to use Buffer
							// initial version I used string
							// but for some reason additional data will be added to original code
							// yes confusing, but it works with Buffer
							const insertBuffer = Buffer.from(text, "utf-8");

							const marker = `__LOAD_ASM_("${resource}")`;
							const markerBuffer = Buffer.from(marker, "utf-8");

							const markerIndex = mainBuffer.indexOf(markerBuffer);

							if (markerIndex === -1) {
								// console.error(`❌ Marker not found in bundle: ${marker}`);
								// throw new Error("Marker not found in bundle");
								return;
							}

							// Replace marker with text buffer
							const before = mainBuffer.subarray(0, markerIndex);
							const after = mainBuffer.subarray(markerIndex + markerBuffer.length);

							mainBuffer = Buffer.concat([before, insertBuffer, after]);
						});

						// resources.length = 0;

						// Update the asset using the new raw buffer
						const source = new RawSource(mainBuffer);
						compilation.updateAsset(asmjsAsset, source);
						asmAssetsFinal.push(asmjsAsset);
					});
				},
			);

			api.expose("GET_ASM_ASSETS", asmAssetsFinal);
		},
	};
}
