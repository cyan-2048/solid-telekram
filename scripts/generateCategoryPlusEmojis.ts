import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

type EmojiDataItem = {
	emoji?: string;
	hexcode?: string;
	group?: number;
	order?: number;
};

type EmojiGroupMeta = {
	groups: Record<string, string>;
};

const ROW_SIZE = 12;
const categoryPlusEmojis: Record<string, string[][]> = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, "..", "src", "workers", "categoryPlusEmojis.json");
const require = createRequire(import.meta.url);

const emojiDataPath = require.resolve("emojibase-data/en/data.json");
const emojiGroupsPath = require.resolve("emojibase-data/meta/groups.json");

const emojiData = JSON.parse(fs.readFileSync(emojiDataPath, "utf8")) as EmojiDataItem[];
const groupMeta = JSON.parse(fs.readFileSync(emojiGroupsPath, "utf8")) as EmojiGroupMeta;

const CATEGORY_LABELS: Record<string, string> = {
	"smileys-emotion": "Smileys & Emotion",
	"people-body": "People & Body",
	component: "Component",
	"animals-nature": "Animals & Nature",
	"food-drink": "Food & Drink",
	"travel-places": "Travel & Places",
	activities: "Activities",
	objects: "Objects",
	symbols: "Symbols",
	flags: "Flags",
};

function serializeCategoryPlusEmojis(data: Record<string, string[][]>): string {
	const categories = Object.entries(data);
	const lines: string[] = ["{"];

	for (const [index, [category, rows]] of categories.entries()) {
		lines.push(`\t${JSON.stringify(category)}: [`);

		for (const row of rows) {
			const serializedRow = `[${row.map((emoji) => JSON.stringify(emoji)).join(", ")}]`;
			lines.push(`\t\t${serializedRow},`);
		}

		const lastRowIndex = lines.length - 1;
		if (rows.length > 0) {
			lines[lastRowIndex] = lines[lastRowIndex].slice(0, -1);
		}

		lines.push(index === categories.length - 1 ? "\t]" : "\t],");
	}

	lines.push("}");
	return `${lines.join("\n")}\n`;
}

function getCategoryName(group: number): string | null {
	const slug = groupMeta.groups[String(group)];
	if (!slug) return null;

	return CATEGORY_LABELS[slug] ?? slug;
}

const removeTrailing = [
	"267f",
	"26d4",
	"2651",
	"2652",
	"2653",
	"264a",
	"2649",
	"2648",
	"264c",
	"264b",
	"2650",
	"264f",
	"264e",
	"264d",
	"2757",
	"2b55",
	"1f22f",
	"1f21a",
	"26aa",
	"26ab",
	"2b1b",
	"2b1c",
	"25fd",
	"25fe",
	"26fa",
	"26f2",
	"2693",
	"26f5",
	"26fd",
	"231b",
	"231a",
	"2b50",
	"2615",
	"26c4",
	"26a1",
	"2614",
	"26c5",
	"1f22f",
];

const addTrailing = ["267e"];

function normalizeEmoji(emoji: EmojiDataItem): string | null {
	if (!emoji.emoji) return null;

	const emojiString = emoji.emoji;
	const codepoints = emojiString.split("").map((a) => a.codePointAt(0)!.toString(16));

	const firstCodePoint = codepoints[0];

	const codepoint = codepoints.join("-");

	if (addTrailing.includes(firstCodePoint) && !codepoint.endsWith("fe0f")) {
		return emojiString + "\uFE0F";
	}

	// Some asset paths only exist for 2615 and not 2615-fe0f.
	if (codepoint.endsWith("fe0f") && removeTrailing.includes(firstCodePoint)) {
		return emojiString.replace(/\uFE0F$/u, "");
	}

	return emoji.emoji;
}

([...emojiData] as EmojiDataItem[])
	.sort((a, b) => {
		return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
	})
	.filter((a) => a.emoji && typeof a.group === "number" && typeof a.order === "number")
	.forEach((emoji) => {
		const categoryName = getCategoryName(emoji.group!);
		if (!categoryName) return;

		const normalizedEmoji = normalizeEmoji(emoji);
		if (!normalizedEmoji) return;

		const category = (categoryPlusEmojis[categoryName] ||= []);

		if (!category.length || category[category.length - 1].length === ROW_SIZE) {
			category.push([]);
		}

		const emojis = category[category.length - 1];

		emojis.push(normalizedEmoji);
	});

fs.writeFileSync(outputPath, serializeCategoryPlusEmojis(categoryPlusEmojis), "utf8");
console.log(`Updated ${path.relative(process.cwd(), outputPath)}`);
