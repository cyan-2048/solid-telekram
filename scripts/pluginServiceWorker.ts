// I tried vibecoding this, gemini and chatgpt failed!!!
// everything here is made by hands and eyes, no robots

import type { RsbuildPlugin } from "@rsbuild/core";
import { createHash } from "crypto";
// I really-really attempted to use a no extra dependency solution for this
// but this is what the rspack docs says
// weeeirrrddd
import { createFsFromVolume, Volume } from "memfs";
import { rspack } from "@rspack/core";

const fs = createFsFromVolume(new Volume());

function md5(input: string | Buffer) {
	return createHash("md5").update(input).digest("hex");
}

const isKai3 = process.env.KAIOS == "3";
const isKai4 = process.env.KAIOS == "4";

const isProd = process.env.NODE_ENV === "production";

const swcConfig = {
	loader: "builtin:swc-loader",
	options: {
		// this is copied from the config, customize if you want

		jsc: {
			externalHelpers: true,

			assumptions: {
				// internet explorer is not supported
				noDocumentAll: true,

				// don't think these are actually being used
				ignoreFunctionLength: true,
				ignoreToPrimitiveHint: true,

				// js class related
				setPublicClassFields: true,

				// use symbols when it is available in swc
				privateFieldsAsProperties: true,
				// privateFieldsAsSymbols: true,
			},
		},

		env: {
			targets: isKai3 ? "firefox 84" : isKai4 ? "firefox 123" : "firefox 48",

			// with service worker, we should avoid using polyfills
			exclude: [
				// babel/swc
				"transform-destructuring",
				"transform-regenerator",
				"transform-block-scoping",
				"transform-for-of",
				"transform-function-name",
			],
		},
	},
};

export function pluginServiceWorker(): RsbuildPlugin {
	return {
		name: "kai-service-worker",
		setup(api) {
			let swBuffer: Buffer | null = null;

			api.transform({ test: /\.(ts|js)$/ }, async ({ code, resourcePath, resourceQuery }) => {
				if (resourceQuery === "?serviceworker") {
					if (swBuffer) {
						api.logger.warn("Duplicate Service Worker import!");
						return `export default "/sw.js"`;
					}

					const compiler = rspack({
						optimization: {
							minimize: isProd,
							runtimeChunk: false,
							splitChunks: false,
							avoidEntryIife: false,
						},

						resolve: {
							extensions: [".ts", ".js", ".json"],
						},

						entry: {
							import: resourcePath,
						},

						output: {
							filename: `sw.js`,
							path: "/",
							asyncChunks: false,

							//iife: false,

							library: {
								type: "iife",
							},
						},

						target: ["es2015", "webworker"],

						module: {
							rules: [
								{
									test: /\.[jt]sx?$/,
									use: [swcConfig],
								},
							],
						},
					});

					// @ts-ignore
					compiler.outputFileSystem = fs;

					await new Promise((res) => compiler.run(res));

					const buffer = fs.readFileSync("/sw.js");

					// console.error(buffer.toString("utf-8"));

					swBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer, "utf8");

					const hash = md5(buffer).slice(0, 8);

					return `export default "/sw.js?v=${hash}"`;
				}

				return code;
			});

			api.processAssets({ stage: "report" }, ({ compiler, compilation }) => {
				if (swBuffer) {
					compilation.emitAsset("sw.js", new compiler.webpack.sources.RawSource(swBuffer));
					// service worker is consumed
					swBuffer = null;
				}
			});
		},
	};
}
