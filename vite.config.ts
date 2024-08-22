import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import fs from "fs";

import { fileURLToPath, URL } from "url";

import solidSvg from "vite-plugin-solid-svg";
import zipPack from "vite-plugin-zip-pack";
import commonjs from "vite-plugin-commonjs";
import tsconfigPaths from "vite-tsconfig-paths";
import polyfillKaiOS, { polyfillKaiOSWorker } from "./scripts/vite";
import kaiManifest from "./scripts/manifest";

import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: `.env.local`, override: true });

const isKai3 = process.env.VITE_KAIOS == "3";
const production = process.env.NODE_ENV === "production";

const manifest = JSON.parse(
	fs.readFileSync("./src/assets/" + (isKai3 ? "manifest.webmanifest" : "manifest.webapp"), "utf8")
);

const fixTelegram = () => ({
	name: "add-window-worker",

	transform(src: string) {
		const codeToReplace = `input > 2n ** 32n || input < -(2n ** 32n)`;

		const codeToReplace2 = `...[_unused, type]`;

		const codeToReplace3 = `...[store, options]`;

		// seems to only be needed if not production, production build works fine
		if (!production && src.includes(".isBrowser")) {
			return {
				code: `var window=self;` + src,
				map: null,
			};
		}

		if (src.includes(codeToReplace2)) {
			return {
				code: src.replace(codeToReplace2, `_unused, type`),
				map: null,
			};
		}

		if (src.includes(codeToReplace3)) {
			return {
				code: src.replace(codeToReplace3, `store, options`),
				map: null,
			};
		}

		if (src.includes(codeToReplace))
			return {
				code: src.replace(codeToReplace, `input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))`),
				map: null,
			};
	},
});

export default defineConfig({
	plugins: [
		solid(),
		solidSvg({
			defaultAsComponent: true,
			svgo: {
				enabled: false,
			},
		}),
		commonjs(),
		tsconfigPaths(),
		polyfillKaiOS(),
		kaiManifest({
			isKai3,
			manifest,
		}),
		zipPack({
			inDir: isKai3 ? "dist-v3" : "dist",
			outDir: "builds",
			outFileName: isKai3 ? "kaigram4kai3.zip" : "kaigram4kai2.zip",
		}),
		fixTelegram(),
	],
	server: {
		port: 5173,
	},

	esbuild: {
		treeShaking: true,
		minifySyntax: true,
		minifyWhitespace: false,
		minifyIdentifiers: false,

		supported: {
			"object-rest-spread": false,
		},
	},

	resolve: {
		alias: [
			{ find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
			{
				find: "@mtcute/core",
				replacement: fileURLToPath(new URL("./@mtcute/core/", import.meta.url)),
			},
			{
				find: "@mtcute/web",
				replacement: fileURLToPath(new URL("./@mtcute/web/", import.meta.url)),
			},

			{
				find: "events",
				replacement: "eventemitter3",
			},
			{
				find: "node:events",
				replacement: "eventemitter3",
			},
			{
				find: "safe-buffer",
				replacement: "buffer",
			},
		],
	},

	build: {
		outDir: isKai3 ? "dist-v3" : "dist",
		target: isKai3 ? "es2020" : "es6",
		cssTarget: isKai3 ? "firefox84" : "firefox48",
		cssCodeSplit: false,
		modulePreload: false,
		assetsInlineLimit: 0,
		minify: "esbuild",
		ssr: false,
		sourcemap: false,
		rollupOptions: {
			output: {
				format: isKai3 ? "esm" : "systemjs",
			},
		},
	},

	define: {
		"import.meta.env.VITE_KAIOS": isKai3 ? 3 : 2,
		"import.meta.env.DEV": !production,
		"import.meta.env.PROD": production,
		"import.meta.env.VITE_APP_ID": process.env.VITE_APP_ID || 0,
		"import.meta.env.VITE_APP_HASH": JSON.stringify(process.env.VITE_APP_HASH || ""),
		"import.meta.env.VITE_DEBUG_URL": JSON.stringify(process.env.VITE_DEBUG_URL || ""),
		"import.meta.env.MANIFEST": JSON.stringify(manifest),
	},

	worker: {
		rollupOptions: {
			output: {
				inlineDynamicImports: true,
			},
		},
		plugins: () => [polyfillKaiOSWorker(), fixTelegram()],
	},
});
