import type { TextWithEntities } from "@mtcute/core";
import * as styles from "./Markdown.module.scss";
import { For, Match, Switch, Show, createRenderEffect, Component, createSignal, JSXElement } from "solid-js";
import { ASTNode, ASTObjectNode, unparse } from "@/lib/unparse";
import { Dynamic } from "solid-js/web";
import { createStore } from "solid-js/store";
import { reconcile } from "solid-js/store";
import memoize from "lodash-es/memoize";
import { cloudphone } from "@/config";
// @ts-ignore
import twemojiMatcher from "@twemoji/parser/dist/lib/regex";

type CustomRenderer = (
	e: ASTObjectNode,
	_default: () => JSXElement,
	_children: () => JSXElement
) => Component<ASTObjectNode> | null | void;

function EntityChildren(props: { $: ASTNode[]; customRenderer?: CustomRenderer }) {
	return <For each={props.$}>{(e) => <Entity $={e} customRenderer={props.customRenderer} />}</For>;
}

export const SPOILER_CLASS = styles.spoiler;
export const SPOILER_TOGGLE = styles.toggle;

function EntityNode(props: { $: ASTObjectNode; customRenderer?: CustomRenderer }) {
	return (
		<Switch
			fallback={
				<Dynamic
					component={props.$.tag}
					class={props.$.entity._ == "messageEntityMention" ? styles.mention : undefined}
					{...props.$.props}
				>
					<EntityChildren $={props.$.children} customRenderer={props.customRenderer} />
				</Dynamic>
			}
		>
			<Match
				when={props.customRenderer?.(
					props.$,
					() => (
						<Dynamic
							component={props.$.tag}
							class={props.$.entity._ == "messageEntityMention" ? styles.mention : undefined}
							{...props.$.props}
						>
							<EntityChildren $={props.$.children} customRenderer={props.customRenderer} />
						</Dynamic>
					),
					() => (
						<EntityChildren $={props.$.children} customRenderer={props.customRenderer} />
					)
				)}
			>
				{(e) => <Dynamic {...props.$} component={e()!} />}
			</Match>
			<Match when={props.$.tag == "spoiler"}>
				<span class={styles.spoiler}>
					<EntityChildren $={props.$.children} customRenderer={props.customRenderer} />
				</span>
			</Match>
		</Switch>
	);
}

interface EmojiMatch {
	match: string;
}

function extractMatchesAndUnmatched(input: string, globalRegex: RegExp): (string | EmojiMatch)[] {
	const result = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = globalRegex.exec(input)) !== null) {
		if (match.index > lastIndex) {
			result.push(input.slice(lastIndex, match.index)); // Add the unmatched segment
		}
		result.push({
			match: match[0],
			// index: match.index
		}); // Add the match as an object
		lastIndex = globalRegex.lastIndex;
	}

	if (lastIndex < input.length) {
		result.push(input.slice(lastIndex)); // Add any remaining unmatched segment
	}

	return result;
}

// const vs16RegExp = /\uFE0F/g;
// avoid using a string literal like '\u200D' here because minifiers expand it inline
// const zeroWidthJoiner = String.fromCharCode(0x200d);

// const removeVS16s = (rawEmoji: string) => rawEmoji.replace(vs16RegExp, "");

function encodeEmoji(emojiText: string) {
	const codepoints = toCodePoints(emojiText).join("-");
	return codepoints;
}

function toCodePoints(unicodeSurrogates: string) {
	const points = [];
	let char = 0;
	let previous = 0;
	let i = 0;
	while (i < unicodeSurrogates.length) {
		char = unicodeSurrogates.charCodeAt(i++);
		if (previous) {
			points.push((0x10000 + ((previous - 0xd800) << 10) + (char - 0xdc00)).toString(16));
			previous = 0;
		} else if (char > 0xd800 && char <= 0xdbff) {
			previous = char;
		} else {
			points.push(char.toString(16));
		}
	}

	if (points.length && points[0].length == 2) {
		points[0] = "00" + points[0];
	}

	return points;
}

export const toCodePoint = memoize(function toCodePoint(unicodeSurrogates: string) {
	return encodeEmoji(unicodeSurrogates);
});

function emojiFromCodePoints(codePoints: string) {
	return codePoints.split("-").reduce((prev, curr) => prev + String.fromCodePoint(parseInt(curr, 16)), "");
}

export function unifiedString(str: string) {
	return emojiFromCodePoints(str);
}

function Twemoji(props: { text: string }) {
	const [show, setShow] = createSignal(false);

	return (
		<span class={cloudphone ? undefined : styles.emoji_wrap}>
			<Show
				when={cloudphone}
				fallback={
					// use custom emoji for KaiOS
					<img
						style={{
							opacity: show() ? undefined : 0,
						}}
						onError={() => {
							setTimeout(() => {
								setShow(true);
							}, 1000);
						}}
						onLoad={() => {
							setShow(true);
						}}
						class={styles.emoji}
						src={"https://cyan-2048.github.io/kaigram-assets/emoji2/" + toCodePoint(props.text) + ".png"}
						alt={props.text}
					/>
				}
			>
				{
					// use css ttf emoji for cloudphone
					props.text
				}
			</Show>
		</span>
	);
}

/**
 * convert String into JSX.Element with Twemoji
 */
export function MarkdownText(props: { text: string }) {
	// if (props.text.length < 6) console.error(props.text);
	const parsed = () => extractMatchesAndUnmatched(props.text, twemojiMatcher);

	return (
		<For each={parsed()}>
			{(match) => (
				<Show when={typeof match == "string"} fallback={<Twemoji text={(match as EmojiMatch).match} />}>
					{match as string}
				</Show>
			)}
		</For>
	);
}

function Entity(props: { $: ASTNode; customRenderer?: CustomRenderer }) {
	return (
		<Show
			when={typeof props.$ == "string"}
			fallback={<EntityNode $={props.$ as ASTObjectNode} customRenderer={props.customRenderer} />}
		>
			<MarkdownText text={props.$ as string} />
		</Show>
	);
}

export default function Markdown(props: { entities: TextWithEntities; customRenderer?: CustomRenderer }) {
	const [ast, setAst] = createStore([] as ASTNode[]);

	createRenderEffect(() => {
		setAst(
			reconcile(unparse(props.entities), {
				merge: true,
			})
		);
	});
	return (
		<span class={styles.markdown}>
			<EntityChildren $={ast} customRenderer={props.customRenderer} />
		</span>
	);
}
