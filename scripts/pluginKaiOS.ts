import type { RsbuildPlugin } from "@rsbuild/core";

const forConstRegex = /for((\s?)*)\(((\s?)*)(const)/g;

const solidJS_createElement = `document.createElement(tagName, {
    is
  });`;

const solidJS_createElement_replacement = `document.createElement(tagName   
      
   );`;

const isKai2 = process.env.KAIOS != "3" && process.env.KAIOS != "4";
const bigintLiteralRegex =
	/(?<![\w$])(0[xX][\da-fA-F](?:_?[\da-fA-F])*|0[bB][01](?:_?[01])*|0[oO][0-7](?:_?[0-7])*|\d(?:_?\d)*)n\b/g;

function transformBigIntLiterals(code: string) {
	return code.replace(bigintLiteralRegex, (_match, literal: string) => {
		// Keep exact integer value by passing a normalized string to BigInt(...).
		return `BigInt("${literal.replaceAll("_", "")}")`;
	});
}

const minisearchRegex = "/[\\n\\r\\p{Z}\\p{P}]+/u";
const minisearchRegexReplacement =
	"/[\\n\\r -#%-*,-/:;?@[-\\]_{}\\u00A0\\u00A1\\u00A7\\u00AB\\u00B6\\u00B7\\u00BB\\u00BF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061E\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u09FD\\u0A76\\u0AF0\\u0C77\\u0C84\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166E\\u1680\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B5A-\\u1B60\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2000-\\u200A\\u2010-\\u2029\\u202F-\\u2043\\u2045-\\u2051\\u2053-\\u205F\\u207D\\u207E\\u208D\\u208E\\u2308-\\u230B\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E4F\\u3000-\\u3003\\u3008-\\u3011\\u3014-\\u301F\\u3030\\u303D\\u30A0\\u30FB\\uA4FE\\uA4FF\\uA60D-\\uA60F\\uA673\\uA67E\\uA6F2-\\uA6F7\\uA874-\\uA877\\uA8CE\\uA8CF\\uA8F8-\\uA8FA\\uA8FC\\uA92E\\uA92F\\uA95F\\uA9C1-\\uA9CD\\uA9DE\\uA9DF\\uAA5C-\\uAA5F\\uAADE\\uAADF\\uAAF0\\uAAF1\\uABEB\\uFD3E\\uFD3F\\uFE10-\\uFE19\\uFE30-\\uFE52\\uFE54-\\uFE61\\uFE63\\uFE68\\uFE6A\\uFE6B\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF3F\\uFF5B\\uFF5D\\uFF5F-\\uFF65]+/u";

/**
 * use this plugin to customize polyfills for KaiOS
 */
export function pluginKaiOS(): RsbuildPlugin {
	function replacer(resource: string, original: string, arr: [string, string][]) {
		for (const [file, replace] of arr) {
			if (resource.endsWith(file)) {
				// console.log(file);
				return replace;
			}
		}

		return original;
	}

	return {
		name: "kai-plugin",
		setup(api) {
			api.transform(
				{
					// change this when necessary
					test: [/.js$/, /.ts$/, /.tsx$/],
				},
				({ code, resourcePath }) => {
					// uncomment to debug core-js usage
					// if (resourcePath.includes("core-js/modules")) {
					// 	console.log(resourcePath);
					// }

					// replace for(const with for(let
					// avoids using for-of or block scope transforms
					// babel/swc runtime too bulky and we lose native for-of optimizations
					if (isKai2) code = code.replaceAll(forConstRegex, "for$1($2let  ");

					if (isKai2 && code.includes(solidJS_createElement)) {
						code = code.replace(solidJS_createElement, solidJS_createElement_replacement);
					}

					if (isKai2) {
						code = transformBigIntLiterals(code);
					}

					if (isKai2 && code.includes(minisearchRegex)) {
						code = code.replace(minisearchRegex, minisearchRegexReplacement);
					}

					return replacer(resourcePath, code, [
						// Reflect is fully supported on KaiOS 2.5
						[
							"core-js/internals/is-constructor.js",
							"var isCallable = require('../internals/is-callable');\n\nvar noop = function () { /* empty */ };\nvar construct = Reflect.construct;\n\nvar isConstructorModern = function isConstructor(argument) {\n  if (!isCallable(argument)) return false;\n  try {\n    construct(noop, [], argument);\n    return true;\n  } catch (error) {\n    return false;\n  }\n};\n\n// `IsConstructor` abstract operation\n// https://tc39.es/ecma262/#sec-isconstructor\nmodule.exports = isConstructorModern;\n",
						],
						["core-js/internals/own-keys.js", "module.exports = Reflect.ownKeys;"],

						// no need to test these static methods
						// more info: I manually checked this myself, it exports Object["..."] if it exists
						["core-js/internals/object-get-prototype-of.js", "module.exports = Object.getPrototypeOf;"],
						["core-js/internals/object-set-prototype-of.js", "module.exports = Object.setPrototypeOf"],
						["core-js/internals/object-define-property.js", "exports.f = Object.defineProperty;"],
						["core-js/internals/object-get-own-property-descriptor.js", "exports.f = Object.getOwnPropertyDescriptor;"],
						["core-js/internals/object-create.js", "module.exports = Object.create;"],

						// these are supported on KaiOS 2.5
						["core-js/modules/es.array.iterator.js", ""],
						["core-js/modules/es.string.from-code-point.js", ""],
						["core-js/modules/es.string.iterator.js", ""],

						[
							"core-js/internals/is-callable.js",
							"module.exports = function (argument) {\n  return typeof argument == 'function';\n};",
						],
					]);
				},
			);
		},
	};
}
