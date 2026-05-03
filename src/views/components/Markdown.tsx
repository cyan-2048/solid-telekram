import type { TextWithEntities } from "@mtcute/core";
import * as styles from "./Markdown.module.scss";
import { For, Match, Switch, Show, createRenderEffect, type Component, createSignal, type JSXElement } from "solid-js";
import { type ASTNodeLoose, type ASTNode, unparse } from "@/lib/unparse";
import { Dynamic } from "solid-js/web";
import { createStore } from "solid-js/store";
import { reconcile } from "solid-js/store";
import memoize from "lodash-es/memoize";
import { cloudphone } from "@/config";
// @ts-expect-error
import twemojiMatcher from "@twemoji/parser/dist/lib/regex";

type CustomRenderer = (
	node: ASTNode,
	_default: () => JSXElement,
	_children: () => JSXElement,
) => Component<ASTNode> | null | void;

function EntityChildren(props: { $: ASTNode | ASTNodeLoose[]; customRenderer?: CustomRenderer }) {
	return (
		<For each={Array.isArray(props.$) ? props.$ : props.$.children}>
			{(e) => <Entity $={e} customRenderer={props.customRenderer} />}
		</For>
	);
}

export const SPOILER_CLASS = styles.spoiler;
export const SPOILER_TOGGLE = styles.toggle;

function EntityNode(props: { $: ASTNode; customRenderer?: CustomRenderer }) {
	return (
		<Switch
			fallback={
				<Dynamic
					component={props.$.tag}
					class={props.$.entity._ == "messageEntityMention" ? styles.mention : undefined}
					{...props.$.props}
				>
					<EntityChildren {...props} />
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
							<EntityChildren {...props} />
						</Dynamic>
					),
					() => <EntityChildren {...props} />,
				)}
			>
				{(e) => <Dynamic {...props.$} component={e()!} />}
			</Match>
			<Match when={props.$.tag == "spoiler"}>
				<span class={styles.spoiler}>
					<EntityChildren {...props} />
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

const removeTrailingVs16 = Object.freeze(["2757", "1f21a", "1f22f", "26ea", "26bd", "26be", "26f3", "1f004"]);
const addTrailingVs16 = Object.freeze(["267e"]);

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

	if (points.length == 2 && removeTrailingVs16.indexOf(points[0]) != -1) {
		points.pop();
	}

	if (points.length == 1 && addTrailingVs16.indexOf(points[0]) != -1) {
		points.push("fe0f");
	}

	return points;
}

const toCodePoint = import.meta.env.DEV ? encodeEmoji : memoize(encodeEmoji);

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
				<Show
					when={typeof match == "string"}
					fallback={
						<Show
							when={
								// ignore single fe0f
								(match as EmojiMatch).match != "️"
							}
						>
							<Twemoji text={(match as EmojiMatch).match} />
						</Show>
					}
				>
					{match as string}
				</Show>
			)}
		</For>
	);
}

function Entity(props: { $: ASTNodeLoose; customRenderer?: CustomRenderer }) {
	return (
		<Show
			when={typeof props.$ == "string"}
			fallback={<EntityNode $={props.$ as ASTNode} customRenderer={props.customRenderer} />}
		>
			<MarkdownText text={props.$ as string} />
		</Show>
	);
}

export default function Markdown(props: { entities: TextWithEntities; customRenderer?: CustomRenderer }) {
	const [ast, setAst] = createStore([] as ASTNodeLoose[]);

	createRenderEffect(() => {
		setAst(
			reconcile(unparse(props.entities), {
				merge: true,
			}),
		);
	});
	return (
		<span class={styles.markdown}>
			<EntityChildren $={ast} customRenderer={props.customRenderer} />
		</span>
	);
}
