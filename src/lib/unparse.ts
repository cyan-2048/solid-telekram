import type { InputText, tl } from "@mtcute/core";

/** Options passed to `html.unparse` */
export interface HtmlUnparseOptions {
	/**
	 * Syntax highlighter to use when un-parsing `pre` tags with language
	 */
	syntaxHighlighter?: (code: string, language: string) => Node[];
}

type Tags = keyof HTMLElementTagNameMap | "spoiler";

interface _Node<T extends Tags = Tags, R extends tl.TypeMessageEntity = tl.TypeMessageEntity> {
	type: R["_"];
	tag: T;
	entity: R;
	children: (Node | string)[];
	props: Record<string, any>;
	source: string;
}

export type ObjectNode = _Node;

export type Node = _Node | string;

// internal function that uses recursion to correctly process nested & overlapping entities
function _unparse(
	text: string,
	entities: ReadonlyArray<tl.TypeMessageEntity>,
	params: HtmlUnparseOptions,
	entitiesOffset = 0,
	offset = 0,
	length = text.length
): Node[] {
	if (!text) return [text];

	if (!entities.length || entities.length === entitiesOffset) {
		return [text];
	}

	const end = offset + length;

	const html: Node[] = [];
	let lastOffset = 0;

	for (let i = entitiesOffset; i < entities.length; i++) {
		const entity = entities[i];
		if (entity.offset >= end) break;

		let entOffset = entity.offset;
		let length = entity.length;

		if (entOffset < 0) {
			length += entOffset;
			entOffset = 0;
		}

		let relativeOffset = entOffset - offset;

		if (relativeOffset > lastOffset) {
			// add missing plain text
			html.push(text.substring(lastOffset, relativeOffset));
		} else if (relativeOffset < lastOffset) {
			length -= lastOffset - relativeOffset;
			relativeOffset = lastOffset;
		}

		if (length <= 0 || relativeOffset >= end || relativeOffset < 0) {
			continue;
		}

		let skip = false;

		const substr = text.substr(relativeOffset, length);
		if (!substr) continue;

		const type = entity._;

		let entityText: Node[];

		if (type === "messageEntityPre") {
			entityText = [substr];
		} else {
			entityText = _unparse(substr, entities, params, i + 1, offset + relativeOffset, length);
		}

		switch (type) {
			case "messageEntityBold":
			case "messageEntityItalic":
			case "messageEntityUnderline":
			case "messageEntityStrike":
			case "messageEntityCode":
			case "messageEntitySpoiler":
				{
					const tag = (
						{
							messageEntityBold: "b",
							messageEntityItalic: "i",
							messageEntityUnderline: "u",
							messageEntityStrike: "s",
							messageEntityCode: "code",
							messageEntitySpoiler: "spoiler",
						} as const
					)[type];
					html.push({ type, entity, tag, children: entityText, props: {}, source: substr });
				}
				break;
			case "messageEntityBlockquote":
				html.push({
					type,
					tag: "blockquote",
					props: { collapsible: entity.collapsed ? true : undefined },
					children: entityText,
					entity,
					source: substr,
				});
				break;
			case "messageEntityPre":
				html.push({
					type,
					tag: "pre",
					props: { lang: entity.language },
					children:
						params.syntaxHighlighter && entity.language
							? params.syntaxHighlighter(entityText[0] as string, entity.language)
							: entityText,
					entity,
					source: substr,
				});
				break;
			case "messageEntityEmail":
				html.push({
					type,
					entity,
					tag: "a",
					props: { href: `mailto:${entityText[0]}` },
					children: entityText,
					source: substr,
				});
				break;
			case "messageEntityUrl":
				html.push(
					{
						type,
						entity,
						tag: "a",
						props: { href: entityText[0] },
						children: entityText,
						source: substr,
					}
					//  `<a href="${entityText}">${entityText}</a>`
				);
				break;
			case "messageEntityTextUrl":
				html.push(
					{
						type,
						entity,
						tag: "a",
						props: { href: entity.url },
						children: entityText,
						source: substr,
					}
					// `<a href="${escape(entity.url, true)}">${entityText}</a>`
				);
				break;
			case "messageEntityMentionName":
				html.push(
					{
						type,
						entity,
						tag: "a",
						props: { href: `tg://user?id=${entity.userId}` },
						children: entityText,
						source: substr,
					}
					//  `<a href="tg://user?id=${entity.userId}">${entityText}</a>`
				);
				break;
			case "messageEntityMention":
				html.push(
					{
						type,
						entity,
						tag: "a",
						props: { href: `javascript:void(0)` },
						children: entityText,
						source: substr,
					}
					//  `<a href="tg://user?id=${entity.userId}">${entityText}</a>`
				);
				break;
			default:
				skip = true;
				break;
		}

		lastOffset = relativeOffset + (skip ? 0 : length);
	}

	html.push(text.substr(lastOffset));

	return html;
}

/**
 * Add HTML formatting to the text given the plain text and entities contained in it.
 */
export function unparse(input: InputText, options?: HtmlUnparseOptions): Node[] {
	if (typeof input === "string") {
		return _unparse(input, [], options ?? {});
	}

	return _unparse(input.text, input.entities ?? [], options ?? {});
}
