import { EmojiCategory, getEmojiPage, getLastEmojiPage } from "@/lib/heavy-tasks";
import { createEffect, createSignal, JSXElement, onCleanup, onMount, Show } from "solid-js";
import Options from "./Options";
import styles from "./EmojiPicker.module.scss";
import scrollIntoView from "scroll-into-view-if-needed";
import { ModifyString } from "./Markdown";
import { setSoftkeys } from "@signals";
import SpatialNavigation from "@/lib/spatial_navigation";

const recent_icon = (
	<svg viewBox="0 0 22 22">
		<path d="M11 5.7a.7.7 0 00-.7.7V11c0 .216.098.409.251.537.046.048.099.09.16.125l3.983 2.3a.7.7 0 10.7-1.212L11.7 10.617V6.4a.7.7 0 00-.7-.7z"></path>
		<path
			clip-rule="evenodd"
			d="M11 2a9 9 0 100 18 9 9 0 000-18zm-7.6 9a7.6 7.6 0 1015.2 0 7.6 7.6 0 00-15.2 0z"
			fill-rule="evenodd"
		></path>
	</svg>
);

const icons = {
	[EmojiCategory.Smileys]: (
		<svg viewBox="0 0 24 24">
			<path d="M12 22.1C6.4 22.1 1.9 17.6 1.9 12S6.4 1.9 12 1.9 22.1 6.4 22.1 12 17.6 22.1 12 22.1zm0-18.6c-4.7 0-8.5 3.8-8.5 8.5s3.8 8.5 8.5 8.5 8.5-3.8 8.5-8.5-3.8-8.5-8.5-8.5z"></path>
			<path d="M8.9 11.6c.7 0 1.3-.7 1.3-1.5s-.6-1.5-1.3-1.5-1.3.7-1.3 1.5.6 1.5 1.3 1.5zm8.2 2c-1.1.1-3 .4-5 .4s-4-.3-5-.4c-.4 0-.6.3-.4.7 1.1 2 3.1 3.5 5.5 3.5 2.3 0 4.4-1.5 5.5-3.5.1-.3-.2-.7-.6-.7zM12.3 16c-2.6 0-4.1-1-4.2-1.6 0 0 4.4.9 8 0 0 0-.5 1.6-3.8 1.6zm2.8-4.4c.7 0 1.3-.7 1.3-1.5s-.6-1.5-1.3-1.5-1.3.7-1.3 1.5.6 1.5 1.3 1.5z"></path>
		</svg>
	),
	[EmojiCategory.People]: (
		<svg
			style={{
				transform: "scale(1.05)",
			}}
			viewBox="0 -960 960 960"
		>
			<path d="M360-390q-21 0-35.5-14.5T310-440q0-21 14.5-35.5T360-490q21 0 35.5 14.5T410-440q0 21-14.5 35.5T360-390Zm240 0q-21 0-35.5-14.5T550-440q0-21 14.5-35.5T600-490q21 0 35.5 14.5T650-440q0 21-14.5 35.5T600-390ZM480-160q134 0 227-93t93-227q0-24-3-46.5T786-570q-21 5-42 7.5t-44 2.5q-91 0-172-39T390-708q-32 78-91.5 135.5T160-486v6q0 134 93 227t227 93Zm.07 60q-78.84 0-148.21-29.92t-120.68-81.21q-51.31-51.29-81.25-120.63Q100-401.1 100-479.93q0-78.84 29.92-148.21t81.21-120.68q51.29-51.31 120.63-81.25Q401.1-860 479.93-860q78.84 0 148.21 29.92t120.68 81.21q51.31 51.29 81.25 120.63Q860-558.9 860-480.07q0 78.84-29.92 148.21t-81.21 120.68q-51.29 51.31-120.63 81.25Q558.9-100 480.07-100Zm-72.92-691.15q45.46 83.84 126.12 127.5Q613.92-620 700-620q16.31 0 31.81-1.69t31.42-4.85q-40.08-79.61-116.11-126.54Q571.08-800 480-800q-20.15 0-37.58 2.27-17.42 2.27-35.27 6.58ZM171.23-556.38q56.39-28.23 107.08-82.5Q329-693.15 343.77-769q-65.62 29.77-110.92 85.58-45.31 55.81-61.62 127.04Zm235.92-234.77ZM343.77-769Z" />
		</svg>
	),
	[EmojiCategory.Animals]: (
		<svg viewBox="0 0 24 24">
			<path d="M7.2 12.2c.608 0 1.1.627 1.1 1.4S7.808 15 7.2 15s-1.1-.627-1.1-1.4.492-1.4 1.1-1.4zm9.7 0c.608 0 1.1.627 1.1 1.4s-.492 1.4-1.1 1.4-1.1-.627-1.1-1.4.492-1.4 1.1-1.4zm4.6-1.1-1.2-2.4c.9-.4 1.7-1.3 2-2.2.3-.7.4-2.1-1-3.5-1-.9-2-1.2-2.9-1-1.1.3-1.9 1.2-2.3 1.9-1.4-.7-2.9-.8-4.1-.8-1.5 0-2.8.3-4 .9-.5-.9-1.2-1.8-2.3-2.1-1-.2-2 .1-2.9 1-1 1-1.4 2.2-1 3.4.4 1.1 1.2 1.9 2 2.3-.2.5-.4 1-.6 1.6l-.2.2c-.3.7-.5 1.3-.8 1.9-.4 1-.9 1.9-.9 3.1 0 1.6.8 6.7 10.5 6.7 3.8 0 6.6-.7 8.5-2.2s2.2-3.4 2.2-4.3c.2-2.1-.2-2.9-1-4.5zm-2.7-7.6c.4-.1.9.1 1.5.6.6.6.8 1.2.6 1.8-.2.6-.7 1.1-1.2 1.3-.6-1.2-1.3-2-2.1-2.6.2-.4.6-1 1.2-1.1zM3.3 5.9c-.2-.6 0-1.2.6-1.8.5-.5 1.1-.7 1.5-.6.5.1 1.1.7 1.3 1.2-.9.7-1.6 1.5-2.2 2.6C4 7 3.4 6.5 3.3 5.9zm17.8 9.7c0 .7-.2 2-1.6 3.1-1.5 1.2-4.1 1.8-7.5 1.8-8.3 0-8.9-3.9-8.9-5.1 0-.8.3-1.5.7-2.4.3-.6.6-1.2.8-2.1l.1-.2c.5-1.5 2-6.2 7.3-6.2 1.2 0 2.5.2 3.7.9.1.1.5.3.5.3.9.7 1.7 1.7 2.4 3.2.6 1.3 1 2.2 1.4 2.9.8 1.6 1.1 2.1 1.1 3.8zM14.6 17c-.1.1-.6.4-1.2.3-.4-.1-.7-.3-.9-.8 0-.1-.1-.1-.1-.2.8-.1 1.3-.6 1.3-1.3s-.7 0-1.7 0c-.9 0-1.7-.7-1.7 0 0 .6.6 1.2 1.4 1.3l-.1.1c-.3.4-.5.7-.9.8-.5.1-1.1-.1-1.3-.3-.2-.2-.5-.1-.7.1s-.1.5.1.7c.1.1.8.5 1.6.5.2 0 .4 0 .5-.1.4-.1.8-.3 1.1-.7.4.4.9.6 1.2.7.8.2 1.7-.2 2-.5.2-.2.2-.5 0-.7-.1 0-.4-.1-.6.1z"></path>
		</svg>
	),
	[EmojiCategory.Food]: (
		<svg viewBox="0 0 24 24">
			<path d="M7.4 11.4c-.4 0-.8.4-.8.8V14c0 .4.4.8.8.8s.8-.4.6-.8v-1.8c0-.6-.2-.8-.6-.8zm-2.8-1c-.4 0-.8.4-.8.8V15c0 .4.4.8.8.8s.8-.4.8-.8v-3.8c0-.6-.4-.8-.8-.8z"></path>
			<path d="M23 7.2c-.6-.6-1.6-.8-2.8-.6-.2 0-.4.2-.6.2V4.2c0-.6-.6-1.2-1.2-1.2h-17C.8 3 .2 3.6.2 4.2v7.4c0 5.4 3.2 9.6 8.4 9.6h2.2c4.2 0 7-2.6 8-6h.4c2.2-.4 4-2.6 4.4-4.8.4-1.4.2-2.4-.6-3.2zm-4.8-2.8v3H1.6v-3h16.6zM11 19.8H8.8c-5.2 0-7-4.4-7-8.2V8.8h16.6v2.8c-.2 4-2.4 8.2-7.4 8.2zm8.4-6.2c.2-.6.2-1.4.2-2V8.4c.4-.2.6-.4 1-.4.6-.2 1.2 0 1.4.4.4.4.6 1 .4 1.8-.2 1.4-1.6 3-3 3.4z"></path>
		</svg>
	),
	[EmojiCategory.Activities]: (
		<svg viewBox="0 0 24 24">
			<path d="m14.8 15.3 1.3-3.8c.1-.2 0-.5-.2-.6l-3.3-2.4c-.2-.1-.5-.1-.6 0l-3.3 2.4c-.2.1-.3.4-.2.6l1.3 3.8c.1.2.3.4.5.4h4c.2 0 .4-.2.5-.4z"></path>
			<path d="M12 1.9C6.4 1.9 1.9 6.4 1.9 12S6.4 22.1 12 22.1 22.1 17.6 22.1 12 17.6 1.9 12 1.9zM9.8 20.3c.1-.2.1-.4 0-.6l-1.4-2.3c-.1-.1-.2-.2-.4-.3l-2.5-.6c-.2-.1-.5.1-.6.2-.9-1.3-1.4-2.9-1.5-4.5.2 0 .4 0 .5-.2l1.7-2c.1 0 .2-.2.2-.3l-.3-2.6c0-.2-.1-.3-.3-.4C6.2 5.4 7.5 4.5 9 4c0 .1.2.3.3.3l2.5 1.1c.1.1.3.1.4 0l2.5-1.1.3-.3c1.5.6 2.7 1.5 3.7 2.7-.1.1-.2.2-.2.4l-.2 2.6c0 .2 0 .3.1.4l1.7 2c.1.1.3.2.4.2 0 1.6-.5 3.1-1.3 4.4-.1-.1-.2-.1-.4-.1l-2.5.6c-.1 0-.3.1-.4.3l-1.4 2.3c-.1.2-.1.3 0 .5-.8.2-1.6.4-2.5.4-.7-.1-1.5-.2-2.2-.4z"></path>
		</svg>
	),
	[EmojiCategory.Travel]: (
		<svg viewBox="0 0 24 24">
			<path d="M21.5 11.5c0-.7-.1-1.4-.3-2l-1.5-4.3C19.2 3.9 18 3 16.6 3H7.3c-1.4 0-2.6.9-3.1 2.2L2.6 9.9c-.1.4-.2.7-.2 1.1v8.6c0 .6.5 1.1 1.1 1.1h1.1c.6 0 1.1-.5 1.1-1.1v-1.1h12.7v1.1c0 .6.5 1.1 1.1 1.1h1.1c.6 0 1.1-.5 1.1-1.1v-7.4l-.2-.7zM4.1 10.4l1.6-4.7c.2-.7.9-1.2 1.7-1.2h9.2c.7 0 1.4.5 1.6 1.2l1.5 4.3c.1.3.2.6.2.8H4c-.1-.1 0-.3.1-.4zm1.4 5.7c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5c-.1.8-.7 1.5-1.5 1.5zm9.4-.6H9.3c-.5 0-1-.4-1-1 0-.5.4-1 1-1h5.6c.5 0 1 .4 1 1-.1.6-.5 1-1 1zm3.7.6c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"></path>
		</svg>
	),
	[EmojiCategory.Objects]: (
		<svg viewBox="0 0 24 24">
			<path d="M18.8 6.7c-.9-2.6-3.2-4.6-6-4.9h-1.6c-2.8.3-5.1 2.2-6 4.9-1 3 .1 6.2 2.7 8H8c.2.1.3.4.3.6v2c0 .8.6 1.4 1.4 1.4h4.6c.8 0 1.4-.6 1.4-1.4v-2c0-.2.1-.5.3-.6l.1-.1c2.5-1.8 3.6-5 2.7-7.9zm-3.5 6.9-.1.1c-.5.4-.9 1-.9 1.7v2s0 .1-.1.1H9.8s-.1 0-.1-.1v-2c0-.7-.3-1.3-.9-1.7l-.1-.1c-2-1.4-3-4-2.2-6.5.7-2.1 2.6-3.7 4.9-3.9h1.3c2.2.2 4.2 1.8 4.9 3.9.7 2.4-.2 5-2.3 6.5zm-6.1 7.6c0 .6.5 1 1 1h3.7c.6 0 1-.5 1-1v-1H9.2v1z"></path>
			<path d="M13.6 10.5c-.4 0-.8.3-.8.8 0 .1 0 .2.1.3-.2.3-.5.5-.8.5s-.6-.2-.8-.5c0-.1.1-.2.1-.3 0-.4-.3-.8-.8-.8-.4 0-.8.3-.8.8 0 .4.3.7.7.8.3.4.7.7 1.1.8V15c0 .2.2.4.4.4s.4-.2.4-.4v-2.1c.4-.1.8-.4 1.1-.8.4 0 .8-.3.8-.8s-.3-.8-.7-.8z"></path>
		</svg>
	),
	[EmojiCategory.Symbols]: (
		<svg viewBox="0 0 24 24">
			<path d="M14.5 12.9V11h2.2l-.2-1.3h-2V7.3H13v2.5h-2V7.4H9.5v2.4H7.2l.2 1.2h2.1v1.9H7.3l.2 1.3h2v2.4H11v-2.4h2v2.4h1.5v-2.4h2.3l-.2-1.3h-2.1zM11 11h2v1.9h-2V11z"></path>
			<path d="M16.1 2.6H7.9C5 2.6 2.6 5 2.6 7.9V16c0 3 2.4 5.3 5.3 5.3H16c3 0 5.3-2.4 5.3-5.3V7.9c.1-2.9-2.3-5.3-5.2-5.3zm3.7 13.5c0 2.1-1.6 3.8-3.7 3.8H7.9c-2.1 0-3.8-1.7-3.8-3.8V7.9c0-2.1 1.7-3.8 3.8-3.8H16c2.1 0 3.8 1.7 3.8 3.8v8.2z"></path>
		</svg>
	),
	[EmojiCategory.Flags]: (
		<svg viewBox="0 0 24 24">
			<path d="M5.5 3.8v-.2c0-.3-.2-.5-.5-.5h-.5c-.3 0-.5.2-.5.5V21c0 .3.2.5.5.5H5c.3 0 .5-.2.5-.5v-6.2c5 1.8 9.3-2.7 14.5.6V4.1C14.9 1 10.3 5.6 5.5 3.8zm10.3 8.8c-1.4 0-2.8.3-4.1.6-1.2.3-2.4.5-3.5.5-.9 0-1.8-.2-2.6-.5V5.4c.8.2 1.5.3 2.3.3 1.5 0 2.9-.4 4.3-.7 1.3-.3 2.5-.6 3.8-.6.9 0 1.7.2 2.5.5V13c-.9-.2-1.8-.4-2.7-.4z"></path>
		</svg>
	),
} as const;

function EmojiCategoryItem(props: {
	selected: EmojiCategory | null;
	category: EmojiCategory | null;
	setSelected: (e: EmojiCategory | null) => void;
}) {
	let divRef!: HTMLDivElement;

	createEffect(() => {
		if (props.selected === props.category) {
			scrollIntoView(divRef, {
				inline: "center",
				block: "center",
			});
		}
	});

	return (
		<div
			ref={divRef}
			tabIndex={-1}
			onFocus={(e) => {
				props.setSelected(props.category);

				setSoftkeys("tg:up", "", "tg:down");
			}}
			on:sn-navigatefailed={(e) => {
				const direction = e.detail.direction;

				if (direction == "down") {
					SpatialNavigation.focus("emojis");
				}
			}}
			classList={{ [styles.category]: true, [styles.selected]: props.selected === props.category }}
		>
			<Show when={props.category !== null} fallback={recent_icon}>
				{icons[props.category as keyof typeof icons]}
			</Show>
		</div>
	);
}

function EmojiItem(props: { onSelect: (e: string) => void; emoji: string; num: string }) {
	return (
		<div
			tabIndex={-1}
			on:sn-navigatefailed={(e) => {
				const direction = e.detail.direction;
				if (direction == "up") {
					SpatialNavigation.focus("emoji_categories");
				}
			}}
			onFocus={() => {
				setSoftkeys("tg:up", props.emoji ? "SELECT" : "", "tg:down");
			}}
			on:sn-enter-down={() => {
				props.onSelect(props.emoji);
			}}
			class={styles.emojiItem}
		>
			<div class={styles.emoji}>
				<Show when={props.emoji}>{(str) => <ModifyString text={str()} />}</Show>
			</div>
			<div class={styles.num}>{props.num}</div>
		</div>
	);
}

export default function EmojiPicker(props: { onSelect: (e: null | string) => void }) {
	const [selected, setSelected] = createSignal<null | EmojiCategory>(null);
	const [page, setPage] = createSignal(0);
	const [emojis, setEmojis] = createSignal<string[]>([]);

	const [lastPage, setLastPage] = createSignal(0);

	function renderFirstPage() {
		const _selected = selected();

		if (_selected !== null) {
			getEmojiPage(_selected as any, 0).then((emojis) => {
				if (emojis) {
					setEmojis(emojis);
				}
			});
			getLastEmojiPage(_selected as any).then((num) => {
				setLastPage(num);
			});
		}
	}

	createEffect(() => {
		setPage(0);
		renderFirstPage();
	});

	function tryNextEmoji() {
		const category = selected();
		const nextPage = page() + 1;

		if (category !== null) {
			if (nextPage > lastPage()) {
				setPage(0);
				renderFirstPage();
			}
			getEmojiPage(category as any, nextPage).then((emojis) => {
				if (emojis) {
					setEmojis(emojis);
					setPage(nextPage);
				} else {
					setPage(0);
					renderFirstPage();
				}
			});
		}
	}

	function tryPreviousEmoji() {
		const category = selected();
		const previousPage = page() - 1;

		if (category !== null) {
			if (previousPage == -1) {
				getLastEmojiPage(category as any).then((num) => {
					setPage(num);
					getEmojiPage(category as any, num).then((emojis) => {
						setEmojis(emojis);
					});
				});
			} else {
				getEmojiPage(category as any, previousPage).then((emojis) => {
					setPage(previousPage);
					setEmojis(emojis);
				});
			}
		}
	}

	createEffect(() => {
		const category = selected();
		const _page = page();

		if (category === null) {
			setEmojis([]);
			setLastPage(0);
			return;
		}
	});

	onMount(() => {
		setSoftkeys("tg:up", "", "tg:down");

		SpatialNavigation.add("emoji_categories", {
			selector: `.${styles.category}`,
			restrict: "self-only",
			rememberSource: true,
			defaultElement: `.${styles.selected}`,
		});

		SpatialNavigation.add("emojis", {
			selector: `.${styles.emojiItem}`,
			restrict: "self-only",
			rememberSource: true,
		});

		SpatialNavigation.focus("emoji_categories");
	});

	onCleanup(() => {
		SpatialNavigation.remove("emoji_categories");
		SpatialNavigation.remove("emojis");
	});

	return (
		<Options
			onClose={() => {
				props.onSelect(null);
			}}
			title=""
			maxHeight={null}
		>
			<div
				style={{
					position: "fixed",
					bottom: "30px",
				}}
				onKeyDown={(e) => {
					if (e.key == "SoftRight") {
						tryNextEmoji();
					}
					if (e.key == "SoftLeft") {
						tryPreviousEmoji();
					}

					const map: Record<string, number> = {
						"1": 0,
						"2": 1,
						"3": 2,
						"4": 3,
						"5": 4,
						"6": 5,
						"7": 6,
						"8": 7,
						"9": 8,
						"*": 9,
						"0": 10,
						"#": 11,
					};

					if (typeof map[e.key] == "number") {
						const result = emojis()[map[e.key]];
						if (result) {
							props.onSelect(result);
						}
					}
				}}
			>
				<div
					class={styles.categories}
					on:sn-navigatefailed={(e) => {
						const direction = e.detail.direction;
						if (direction == "up") {
							tryPreviousEmoji();
						}
					}}
				>
					<EmojiCategoryItem setSelected={setSelected} selected={selected()} category={null} />
					<EmojiCategoryItem
						setSelected={setSelected}
						selected={selected()}
						category={EmojiCategory.Smileys}
					/>
					<EmojiCategoryItem
						setSelected={setSelected}
						selected={selected()}
						category={EmojiCategory.People}
					/>
					<EmojiCategoryItem
						setSelected={setSelected}
						selected={selected()}
						category={EmojiCategory.Animals}
					/>
					<EmojiCategoryItem
						setSelected={setSelected}
						selected={selected()}
						category={EmojiCategory.Food}
					/>
					<EmojiCategoryItem
						setSelected={setSelected}
						selected={selected()}
						category={EmojiCategory.Activities}
					/>
					<EmojiCategoryItem
						setSelected={setSelected}
						selected={selected()}
						category={EmojiCategory.Travel}
					/>
					<EmojiCategoryItem
						setSelected={setSelected}
						selected={selected()}
						category={EmojiCategory.Objects}
					/>
					<EmojiCategoryItem
						setSelected={setSelected}
						selected={selected()}
						category={EmojiCategory.Symbols}
					/>
					<EmojiCategoryItem
						setSelected={setSelected}
						selected={selected()}
						category={EmojiCategory.Flags}
					/>
				</div>
				<div
					class={styles.emojis}
					on:sn-navigatefailed={(e) => {
						const direction = e.detail.direction;

						if (direction == "down") {
							tryNextEmoji();
						}
						if (direction == "right") {
							setSelected((e) => {
								if (e == 8) return null;
								if (e === null) return 0;
								return Math.min(8, e + 1);
							});
						}

						if (direction == "left") {
							setSelected((e) => {
								if (e == 0) return null;
								if (e === null) return 8;
								return Math.max(0, e - 1);
							});
						}
					}}
				>
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[0]} num="1" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[1]} num="2" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[2]} num="3" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[3]} num="4" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[4]} num="5" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[5]} num="6" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[6]} num="7" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[7]} num="8" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[8]} num="9" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[9]} num="*" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[10]} num="0" />
					<EmojiItem onSelect={props.onSelect} emoji={emojis()[11]} num="#" />
				</div>
				<Show when={lastPage() != 0}>
					<div class={styles.scrollbar_container}>
						<div
							style={{
								height: (1 / (lastPage() + 1)) * 100 + "%",
								top: (page() / (lastPage() + 1)) * 100 + "%",
							}}
							class={styles.scrollbar}
						></div>
					</div>
				</Show>
			</div>
		</Options>
	);
}
