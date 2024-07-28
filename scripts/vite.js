import esbuild from "esbuild";
import fs, { write } from "fs";
import { resolve } from "path";
import { JSDOM } from "jsdom";
import crypto from "crypto";

const isKai3 = process.env.VITE_KAIOS == "3";

// the plugin should only work if you're building for KaiOS
const production = process.env.NODE_ENV === "production";

const polyfillScript =
	esbuild.buildSync({
		entryPoints: [`${__dirname}/polyfills.mjs`],
		bundle: true,
		minify: true,
		target: isKai3 ? "es2020" : "es6",
		format: "iife",
		sourcemap: false,
		treeShaking: true,
		write: false,
		define: {
			"import.meta.env.VITE_KAIOS": isKai3 ? "3" : "2",
			"import.meta.env.DEV": JSON.stringify(!production),
			"import.meta.env.PROD": JSON.stringify(production),
		},
	}).outputFiles[0].text || "";

/**
 *
 * @returns {import("vite").Plugin | undefined}
 */
export default function polyfillKaiOS() {
	let config;
	const jsFiles = [];

	if (production)
		return {
			name: "polyfill-kai",

			configResolved(_config) {
				config = _config;
			},

			transformIndexHtml(html) {
				const dom = new JSDOM(html);
				/**
				 * @type {Document}
				 */
				const document = dom.window.document;
				document.querySelectorAll("script").forEach((script) => {
					jsFiles.push(script.getAttribute("src"));
					if (!isKai3) script.setAttribute("type", "systemjs-module");
					script.removeAttribute("crossorigin");
					script.setAttribute("defer", "");
				});

				// document.head.prepend(
				// 	Object.assign(document.createElement("script"), {
				// 		src: "/index.js",
				// 		defer: true,
				// 	})
				// );

				document.head.prepend(
					Object.assign(document.createElement("script"), {
						src: "polyfills.js",
						defer: true,
					})
				);

				return dom.serialize();
			},

			writeBundle() {
				const filePath = resolve(config.root, config.build.outDir, "polyfills.js");
				// console.log(filePath);
				fs.writeFileSync(filePath, polyfillScript);

				// const opus = resolve(config.root, config.build.outDir, "opusscript_native_nasm.js");
				// console.log(opus);
				// fs.writeFileSync(opus, opusNativeScript);

				// const indexJS = resolve(config.root, config.build.outDir, "index.js");
				// // console.log(indexJS);
				// fs.writeFileSync(
				// 	indexJS,
				// 	jsFiles
				// 		.map((file, i) => {
				// 			return `var script${i} = document.createElement("script");script${i}.src = "${file}";document.head.appendChild(script${i});`;
				// 		})
				// 		.join("")
				// );
			},

			generateBundle(options, bundle) {
				const regexp = /for((\s?)*)\(((\s?)*)const/g;
				for (const fileName in bundle) {
					if (fileName.endsWith(".js")) {
						const output = bundle[fileName];
						if (output && "code" in output) {
							const code = output.code.replace(regexp, "for(let  ");
							if (!code) continue;
							output.code = code;
						}
					}
				}
			},
		};
}

/**
 *
 * @returns {import("vite").Plugin | undefined}
 */
export function polyfillKaiOSWorker(options) {
	let config;

	if (production)
		return {
			name: "polyfill-kai",

			configResolved(_config) {
				config = _config;
			},

			generateBundle(options, bundle) {
				const regexp = /for((\s?)*)\(((\s?)*)const/g;
				for (const fileName in bundle) {
					if (fileName.endsWith(".js")) {
						const output = bundle[fileName];
						if (output && "code" in output) {
							const code = output.code.replace(regexp, "for(let  ");
							if (!code) continue;
							// add import for polyfills for workers
							output.code = 'importScripts("/polyfills.js");' + code;
						}
					}
				}
			},
		};
}
