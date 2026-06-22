import path from "path";
import fs from "fs";

import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginSolid } from "@rsbuild/plugin-solid";
import { pluginSass } from "@rsbuild/plugin-sass";
import { pluginTypedCSSModules } from "@rsbuild/plugin-typed-css-modules";
import { pluginKaiOS } from "./scripts/pluginKaiOS";
import { pluginAsmJS } from "./scripts/pluginAsmJS";
import { pluginServiceWorker } from "./scripts/pluginServiceWorker";
import { pluginKaiOSManifest } from "./scripts/pluginKaiOSManifest";

import { pluginZipPack } from "./scripts/pluginZipPack";

const isKai4 = process.env.KAIOS == "4";
const isKai3 = process.env.KAIOS == "3";
const isCloudphone = process.env.CLOUDPHONE == "1";
const isProd = process.env.NODE_ENV === "production";

// replace BigInteger.ts with NativeBigInteger.ts on KaiOS 3.0
const bigintFolder = path.resolve(__dirname, "@mtcute", "core", "utils", "bigint");
const kai3Alias = {
	[path.resolve(bigintFolder, "BigInteger.ts")]: path.resolve(bigintFolder, "NativeBigInteger.ts"),
};

function generateIncludedFolders() {
	const source = path.resolve(__dirname, "node_modules");

	const devDeps = new Set(
		Object.keys(
			JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json")).toString("utf-8")).devDependencies,
		).map((a) => a.split("/")[0]),
	);

	// console.log(devDeps);

	const folderNames = fs
		.readdirSync(source, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name)
		.filter((a) => !a.includes(".") && !devDeps.has(a) && !a.includes("babel") && !a.includes("swc"));

	return folderNames.map((a) => new RegExp(`node_modules[\\\\/]${a}[\\\\/]`));
}

// console.log(generateIncludedFolders());

export default defineConfig({
	plugins: [
		pluginBabel({
			include: /\.(?:jsx|tsx)$/,
		}),
		pluginSolid(),
		pluginSass({
			sassLoaderOptions: {
				additionalData: `$cloudphone: ${isCloudphone};`,
			},
		}),
		pluginTypedCSSModules(),
		pluginKaiOS(),
		pluginAsmJS(),
		pluginServiceWorker(),
		pluginKaiOSManifest(),
		pluginZipPack({
			inDir: isKai3 ? "dist-v3" : isKai4 ? "dist-v4" : "dist",
			outDir: "builds",
			outFileName: isKai3 ? "telekram4kai3.zip" : isKai4 ? "telekram4kai4.zip" : "telekram4kai2.zip",
		}),
	],

	server: {
		// force no wasm on KaiOS 4
		headers: isKai4
			? {
					// default KaiOS 3.0 CSP rules
					"Content-Security-Policy": `default-src *; script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'`,
				}
			: undefined,
		port: 8082,
	},

	source: {
		// ehhh
		// include: [
		// 	/node_modules[\\/]solid-js[\\/]/,
		// 	/node_modules[\\/]nanostores[\\/]/,
		// 	/node_modules[\\/]@nanostores[\\/]/,
		// 	/node_modules[\\/]solid-transition-group[\\/]/,
		// 	/node_modules[\\/]@solid-primitives[\\/]/,
		// 	/node_modules[\\/]lru-cache[\\/]/,
		// 	/node_modules[\\/]date-fns[\\/]/,
		// 	/node_modules[\\/]solid-qr-code[\\/]/,
		// 	/node_modules[\\/]uuid[\\/]/,
		// 	/node_modules[\\/]@fuman[\\/]/,
		// 	/node_modules[\\/]@mtcute[\\/]/,
		// 	/node_modules[\\/]long[\\/]/,
		// 	/node_modules[\\/]idb[\\/]/,
		// 	/node_modules[\\/]minisearch[\\/]/,
		// 	/node_modules[\\/]moment-timezone[\\/]/,
		// 	/node_modules[\\/]moment[\\/]/,
		// 	/node_modules[\\/]countries-and-timezones[\\/]/,
		// ],

		include: generateIncludedFolders(),

		define: {
			"import.meta.env.KAIOS": isKai3 ? 3 : isKai4 ? 4 : 2,
			"import.meta.env.CLOUDPHONE": isCloudphone,
			"import.meta.env.VITE_APP_ID": process.env.VITE_APP_ID || 0,
			"import.meta.env.VITE_APP_HASH": JSON.stringify(process.env.VITE_APP_HASH || ""),
			"import.meta.env.APP_VERSION": JSON.stringify(process.env.APP_VERSION || "0.0.0"),
		},
	},

	html: {
		inject: "body",
		title: "TeleKram",
		meta: {
			"theme-color": {
				name: "theme-color",
				content: "#000",
			},
		},
		tags: [{ tag: "div", attrs: { class: "LOADING" }, append: false, head: false }],
	},

	resolve: {
		alias: {
			// very dirty workaround
			// might break in the future
			"core-js/modules/kaios_polyfills.js":
				isKai3 || isKai4
					? path.resolve(__dirname, "scripts", "polyfills", "kai3.ts")
					: path.resolve(__dirname, "scripts", "polyfills", "kai2.ts"),

			// force tseep to use non-eval version
			tseep: path.resolve(__dirname, "node_modules", "tseep", "lib", "ee-safe.js"),

			"@": path.resolve(__dirname, "src"),

			"@mtcute/web": path.resolve(__dirname, "@mtcute", "web"),
			"@mtcute/core": path.resolve(__dirname, "@mtcute", "core"),

			...(isKai3 || isKai4 ? kai3Alias : null),
		},
	},

	output: {
		overrideBrowserslist: [isKai3 ? "firefox 84" : isKai4 ? "firefox 123" : "firefox 48"],
		minify: {
			css: true,
			jsOptions: {
				minimizerOptions: {
					compress: {
						toplevel: true,
						arguments: true,
						ecma: 2015,
						keep_fargs: false,
						passes: 5,
						pure_getters: false,
						unsafe_symbols: true,
					},
					mangle: {
						toplevel: true,
					},
				},
			},
		},
		// minify: false,

		dataUriLimit: 0,

		distPath: {
			root: isKai3 ? "dist-v3" : isKai4 ? "dist-v4" : "dist",
		},

		cssModules: {
			localIdentName: isProd ? "[hash:base64:6]" : "[local]-[hash:base64:6]",
			namedExport: true,
		},
	},

	performance: {
		chunkSplit: {
			forceSplitting: {
				comlink: /node_modules[\\/]comlink/,
				polyfills:
					/(scripts[\\/]polyfills)|(node_modules[\\/]core-js)|(node_modules[\\/]web-streams-polyfill)|(node_modules[\\/]@swc[\\/]helpers)|(node_modules[\\/]tslib)/,
			},
			strategy: "split-by-experience",
		},
		printFileSize: {
			compressed: false,
		},

		removeConsole: isProd,
	},

	tools: {
		lightningcssLoader: {
			targets: [isKai3 ? "firefox 84" : isKai4 ? "firefox 123" : "firefox 48"],
		},

		cssLoader: {
			url: {
				filter: (url) => {
					if (url.startsWith("/")) {
						return false;
					}
					return true;
				},
			},
		},

		swc: {
			env: {
				include: ["kaios_polyfills"],
				exclude: [
					// babel/swc
					"transform-destructuring",
					"transform-regenerator",
					"transform-block-scoping",
					"transform-for-of",
					"transform-function-name",
				],

				// debug: true,
			},

			jsc: {
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
		},

		bundlerChain(chain) {
			chain.output.uniqueName("telekram_app");
		},
	},
});
