import fs from "fs";
import path from "path";
// @ts-ignore
import { spawnSync } from "bun";

const packageJsonPath = path.resolve(__dirname, "..", "package.json");

// Read the package.json file
const data = fs.readFileSync(packageJsonPath, "utf8");
const packageJson = JSON.parse(data);

const mtcuteDependencies = [
	"@fuman/io",
	"@fuman/net",
	"@fuman/utils",
	"@mtcute/file-id",
	// "@mtcute/tl",
	"@mtcute/tl-runtime",
	"@mtcute/markdown-parser",
];

let hasUpdates = false;

// add concurrency
const promises = mtcuteDependencies.map((dependency) =>
	fetch(`https://registry.npmjs.org/${dependency}/latest`)
		.then((a) => a.json())
		.then((info) => {
			const currentVersion = packageJson.dependencies[dependency];
			const latestVersion = info.version;

			if (latestVersion != currentVersion) {
				hasUpdates = true;
				console.log(`updating ${dependency}: ${currentVersion} -> ${latestVersion}`);
				packageJson.dependencies[dependency] = latestVersion;
			}
		}),
);

// @ts-ignore
await Promise.all(promises);

if (hasUpdates) {
	// Write the changes back to the file
	fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson), "utf8");

	spawnSync(["bunx", "prettier", "--write", "package.json"], {
		cwd: path.resolve(__dirname, ".."),
	});

	// console.log("package.json updated successfully!");

	console.log("");

	// Run another command (e.g., `bun install`)
	spawnSync(["bun", "i"], {
		stdout: "inherit",
		stderr: "inherit",
	});
}

// ChatGPT generated
/**
 * Recursively copies and merges a folder from source to destination.
 * Replaces files and merges subfolders.
 * @param {string} src - Source folder
 * @param {string} dest - Destination folder
 */
function copyAndMergeFolder(src: string, dest: string) {
	// Ensure destination folder exists
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isFile() && entry.name.endsWith(".test.ts")) {
			continue;
		}

		if (srcPath === path.resolve(upstreamCore, "tl", ".gitignore")) {
			continue;
		}

		if (entry.isDirectory()) {
			// Recurse into subdirectory
			copyAndMergeFolder(srcPath, destPath);
		} else {
			// Copy and overwrite file
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

const mtcuteFolder = path.resolve(__dirname, "..", "@mtcute");
const coreFolder = path.resolve(mtcuteFolder, "core");
const webFolder = path.resolve(mtcuteFolder, "web");

const mtcuteUpstream = path.resolve(__dirname, "..", "..", "mtcute");

const upstreamPackages = path.resolve(mtcuteUpstream, "packages");
const upstreamCore = path.resolve(upstreamPackages, "core", "src");
const upstreamWeb = path.resolve(upstreamPackages, "web", "src");

spawnSync(["git", "pull"], {
	cwd: mtcuteUpstream,
	stdout: "inherit",
	stderr: "inherit",
});

spawnSync(["pnpm", "i"], {
	cwd: mtcuteUpstream,
	stdout: "inherit",
	stderr: "inherit",
});

spawnSync(["npm", "run", "gen-tl"], {
	cwd: path.resolve(upstreamPackages, "core"),
	stdout: "inherit",
	stderr: "inherit",
});

fs.rmSync(mtcuteFolder, { recursive: true, force: true });

// console.error({ mtcuteFolder, coreFolder, webFolder, upstreamCore, upstreamWeb });

copyAndMergeFolder(upstreamCore, coreFolder);
copyAndMergeFolder(upstreamWeb, webFolder);
