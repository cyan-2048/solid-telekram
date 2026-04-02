import {
	batch,
	createEffect,
	createMemo,
	createRenderEffect,
	createSignal,
	createUniqueId,
	For,
	Index,
	onCleanup,
	onMount,
	Show,
	untrack,
} from "solid-js";
import * as styles from "./Home.module.scss";
import SpatialNavigation from "@/lib/spatial_navigation";
import scrollIntoView from "scroll-into-view-if-needed";

import {
	$currentTab,
	$dialogFilters,
	$dialogs,
	$handledDialogRefocus,
	$previousView,
	$room,
	$view,
	setStatusbarColor,
} from "@/stores";
import type UIDialog from "@/ui/UIDialog";
import type UIDialogFilter from "@/ui/UIDialogFilter";
import { isToday, last, setSoftkeys, sleep, toaster, useMessageChecks, useStore } from "@/utils";
import Tabs, { Tab } from "@components/Tabs";
import Content from "@components/Content";
import PeerPhotoIcon from "@components/PeerPhotoIcon";
import Search from "@components/Search";
import MarqueeOrNot from "@components/MarqueeOrNot";
import TelegramIcon, { VerifiedIcon } from "@components/TelegramIcon";
import { unparse } from "@/lib/unparse";
import { MarkdownText } from "@components/Markdown";
import DialogsJar from "@/ui/DialogJar";
import debounce from "lodash-es/debounce";
import { dialogsJar } from "@globals";
import Options from "@components/Options";
import OptionsItem from "@components/OptionsItem";
import { Portal } from "solid-js/web";
import Settings from "./settings";
import LazyNewChat from "./LazyNewChat";
import { useStore as useStore_ } from "@nanostores/solid";

// to do more shit
const enum DialogOptionsSelected {
	PIN,
	UNPIN,

	MUTE,
	UNMUTE,

	SETTINGS,
	EXIT,
}

function DialogOptions(props: {
	$: UIDialog;
	pinned: boolean;
	muted: boolean;
	onSelect: (e: DialogOptionsSelected | null) => void;
}) {
	const SN_ID_OPTIONS = createUniqueId();

	onMount(() => {
		SpatialNavigation.add(SN_ID_OPTIONS, {
			selector: ".option",
			restrict: "self-only",
		});
		SpatialNavigation.focus(SN_ID_OPTIONS);
		setSoftkeys("", "OK", "");
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID_OPTIONS);
	});

	return (
		<Options
			onClose={() => {
				props.onSelect(null);
			}}
			title="Options"
		>
			{/* <OptionsItem
				classList={{ option: true, [styles.item]: true }}
				on:sn-enter-down={() => {
					props.onSelect(props.pinned ? DialogOptionsSelected.UNPIN : DialogOptionsSelected.PIN);
				}}
				tabIndex={-1}
			>
				{props.pinned ? "Unpin" : "Pin"}
			</OptionsItem>
			<OptionsItem
				classList={{ option: true, [styles.item]: true }}
				tabIndex={-1}
				on:sn-enter-down={() => {
					props.onSelect(props.muted ? DialogOptionsSelected.UNMUTE : DialogOptionsSelected.MUTE);
				}}
			>
				{props.muted ? "Unmute" : "Mute"}
			</OptionsItem> */}
			{/* <OptionsItem
				classList={{ option: true, [styles.item]: true }}
				tabIndex={-1}
				on:sn-enter-down={() => {
					props.onSelect(DialogOptionsSelected.CHANGELOG);
				}}
			>
				Changelog
			</OptionsItem> */}
			<OptionsItem
				classList={{ option: true, [styles.item]: true }}
				tabIndex={-1}
				on:sn-enter-down={() => {
					props.onSelect(DialogOptionsSelected.SETTINGS);
				}}
				on:sn-focused={() => {
					Settings.preload();
				}}
			>
				Settings
			</OptionsItem>
			<OptionsItem
				classList={{ option: true, [styles.item]: true }}
				tabIndex={-1}
				on:sn-enter-down={() => {
					props.onSelect(DialogOptionsSelected.EXIT);
				}}
			>
				Exit
			</OptionsItem>
			{/* <Show when={!localStorage.getItem("NO_ADS")}>
				<OptionsItem
					classList={{ option: true, [styles.item]: true }}
					tabIndex={-1}
					on:sn-enter-down={() => {
						props.onSelect(DialogOptionsSelected.KAIAD);
					}}
				>
					Show Ad
				</OptionsItem>
			</Show> */}
		</Options>
	);
}

function DialogSender(props: { $: UIDialog }) {
	const lastMessage = useStore(() => props.$.$lastMessage);

	const sender = () => {
		const sender = lastMessage()?.sender;
		if (sender) {
			if ("firstName" in sender && sender.firstName) return sender.firstName;
			return sender.displayName;
		}
		return null;
	};

	const check = useMessageChecks(lastMessage, () => props.$);

	return (
		<Show when={lastMessage() && !lastMessage()!.raw.action}>
			<Show when={lastMessage()?.isOutgoing}>
				<div class={styles.check}>
					<TelegramIcon name={check() ? "check" : "checks"} />
				</div>
			</Show>
			<Show when={lastMessage() && !lastMessage()!.isOutgoing && (props.$.isGroup || props.$.isForum)}>
				<span class={styles.sender}>{sender()}: </span>
			</Show>
		</Show>
	);
}

const chatMinisearch = DialogsJar.search;

export function getWeek(d: Date) {
	// Create a copy of this date object
	var target = new Date(d.valueOf());

	// ISO week date weeks start on monday
	// so correct the day number
	var dayNr = (d.getDay() + 6) % 7;

	// Set the target to the thursday of this week so the
	// target date is in the right year
	target.setDate(target.getDate() - dayNr + 3);

	// ISO 8601 states that week 1 is the week
	// with january 4th in it
	var jan4 = new Date(target.getFullYear(), 0, 4);

	// Number of days between target date and january 4th
	var dayDiff = (+target - +jan4) / 86400000;

	// Calculate week number: Week 1 (january 4th) plus the
	// number of weeks between target date and january 4th
	var weekNr = 1 + Math.ceil(dayDiff / 7);

	return weekNr;
}

export function timeStamp(date: Date) {
	const today = new Date();

	const isSameYear = today.getFullYear() == date.getFullYear();

	if (isSameYear) {
		if (isToday(date, today)) {
			return date.toLocaleTimeString(navigator.language, {
				hour: "numeric",
				minute: "numeric",
			});
		} else {
			const isSameWeek = getWeek(date) == getWeek(today);
			if (isSameWeek) {
				return date.toLocaleDateString(navigator.language, {
					weekday: "short",
				});
			} else {
				return date.toLocaleDateString(navigator.language, {
					month: "short",
					day: "numeric",
				});
			}
		}
	} else {
		return date.toLocaleDateString(navigator.language);
	}
}

function DialogDate(props: { $: Date }) {
	const [text, setText] = createSignal("");

	createRenderEffect(() => {
		const date = props.$;

		setText(timeStamp(date));
	});

	return <>{text()}</>;
}

const BRAILE = "⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠩⠝⠕⠏⠟⠗⠎⠞⠥⠼⠺⠭⠽⠵";

function generateHiddenCodeThing(length = 5) {
	let e = "";

	while (e.length < length) {
		e = e + BRAILE[Math.floor(Math.random() * BRAILE.length)];
	}

	return e;
}

const isLandscape = window.innerHeight < window.innerWidth;

function DialogItem(props: { $: UIDialog; isSearchResult?: boolean; isLast?: () => boolean; loadMore?: () => void }) {
	const [focused, setFocused] = createSignal(false);

	const lastMessage = useStore(() => props.$.$lastMessage);
	const lastMessageTextWithEntities = useStore(() => lastMessage()?.$entities);

	let divRef!: HTMLDivElement;

	// onMount(() => {
	// 	if (import.meta.env.DEV) {
	// 		if (divRef) {
	// 			// @ts-ignore
	// 			divRef.__$props = props;
	// 		}
	// 	}
	// });

	const text = () => {
		const lastMsg = lastMessage();
		const textWithEntities = lastMessageTextWithEntities();

		if (lastMsg && textWithEntities) {
			return textWithEntities.entities
				? unparse(textWithEntities)
						.map((a) =>
							typeof a == "string"
								? a
								: a.entity._ == "messageEntitySpoiler"
									? generateHiddenCodeThing(a.source.length)
									: a.source,
						)
						.join("") || lastMsg.$text.get()
				: lastMsg.$text.get();
		}

		return "";
	};

	const pinned = useStore(() => props.$.$pinned);

	const count = useStore(() => props.$.$count);

	const muted = useStore(() => props.$.$muted);

	const view = useStore_($view);

	createEffect(() => {
		const currentView = view();

		untrack(() => {
			if (currentView == "room") {
				$handledDialogRefocus.set(false);
			}

			const room = $room.get();
			// if the view changes to home
			if (currentView == "home" && room === props.$ && !$handledDialogRefocus.get()) {
				console.log("REFOCUSING DIALOG.");
				$handledDialogRefocus.set(true);
				scrollIntoView(divRef, {
					scrollMode: "if-needed",
					block: "nearest",
					inline: "nearest",
				});

				sleep().then(() => {
					if (document.activeElement != divRef) {
						divRef.focus();
					}
				});
			}
		});
	});

	const textFactory = () => {
		const _text = text();
		const isSupport = props.$.isSupport;

		return (
			_text && (isSupport ? _text.replace(/Login code: \d\d\d\d\d/, "Login code: " + generateHiddenCodeThing()) : _text)
		);
	};

	createRenderEffect(() => {
		// we won't index searchResults
		if (props.isSearchResult) {
			console.error("search result dialog");
			return;
		}
	});

	// const [showChangelog, setShowChangelog] = createSignal(false);

	const [showOptions, setShowOptions] = createSignal(false);

	return (
		<>
			<div
				ref={divRef}
				onFocus={() => {
					setStatusbarColor("#1c96c3");
					setSoftkeys("New chat", "OPEN", "tg:more");
					setFocused(true);
					if (props.isLast?.()) props.loadMore?.();
				}}
				onBlur={() => {
					setFocused(false);
				}}
				onKeyDown={(e) => {
					if (e.key == "SoftRight") {
						setShowOptions(true);
					}

					if (e.key == "SoftLeft") {
						$previousView.set("home");
						$view.set("new_chat");
					}
				}}
				on:sn-enter-down={async () => {
					if (!props.$.messages.hasLoadedBefore) {
						props.$.messages.loadMore();
					}

					batch(() => {
						$room.set(props.$);
						$view.set("room");
					});

					if (props.$.isForum) {
						// currently this one is so confusing
						toaster("Forum supergroups are currently unstable!");
					}
				}}
				tabIndex={-1}
				classList={{ [styles.dialog]: true, focusable }}
				on:sn-willfocus={(e) => {
					scrollIntoView(e.currentTarget, {
						scrollMode: "if-needed",
						block: "nearest",
						inline: "nearest",
					});
				}}
			>
				<div class={styles.icon}>
					<PeerPhotoIcon peer={props.$.peer}></PeerPhotoIcon>
				</div>
				<div class={styles.details}>
					<div class={styles.top}>
						<div class={styles.name}>
							<MarqueeOrNot marquee={focused()}>
								{props.$.isSelf ? "Saved Messages" : props.$.peer.displayName}
							</MarqueeOrNot>
						</div>
						<div class={styles.time}>
							<Show when={props.$.isVerified}>
								<VerifiedIcon width={14} height={14} class={styles.verified} />
							</Show>
							<Show when={muted()}>
								<TelegramIcon classList={{ [styles.icons]: true }} name="muted" />
							</Show>
							<Show when={lastMessage()}>{(message) => <DialogDate $={message().date} />}</Show>
						</div>
					</div>
					<div class={styles.bottom}>
						<div class={styles.desc}>
							<DialogSender $={props.$} />
							<MarkdownText text={textFactory()?.slice(0, isLandscape ? 50 : 30) || "__"} />
						</div>
						<div class={styles.meta}>
							<Show when={pinned() && !count()}>
								<TelegramIcon name="chatspinned" />
							</Show>
							<Show when={count()}>
								<div classList={{ [styles.count]: true, [styles.muted]: muted() }}>{count()}</div>
							</Show>
						</div>
					</div>
				</div>
			</div>

			<Show when={showOptions()}>
				<Portal>
					<DialogOptions
						onSelect={async (e) => {
							setShowOptions(false);

							switch (e) {
								case DialogOptionsSelected.SETTINGS:
									batch(() => {
										$previousView.set("home");
										$view.set("settings");
									});

									return;

								case DialogOptionsSelected.EXIT:
									window.close();
									return;
							}

							await sleep(100);
							SpatialNavigation.focus("dialogs");
						}}
						$={props.$}
						muted={muted()}
						pinned={pinned()}
					></DialogOptions>
				</Portal>
			</Show>

			{
				// TODO
				/* 
			<Show when={showChangelog()}>
				<Changelog
					onClose={async () => {
						setShowChangelog(false);
						await sleep(100);
						SpatialNavigation.focus("dialogs");
					}}
				></Changelog>
			</Show> */
			}
		</>
	);
}

function DialogFilterTab(props: { $: UIDialogFilter }) {
	// hmm what if it changes?
	const text = useStore(() => props.$.$title);
	const currentTab = useStore($currentTab);

	return (
		<Tab
			onClick={() => {
				$currentTab.set(props.$);
			}}
			selected={currentTab() == props.$}
		>
			{text()}
		</Tab>
	);
}

const focusable = true;

function moveTab(forward = false) {
	const filters = $dialogFilters.get();
	if (!filters.length) return;
	const current = $currentTab.get();

	if (forward) {
		if (current === null) {
			$currentTab.set(filters[0]);
		} else {
			$currentTab.set(filters[Math.min(filters.indexOf(current) + 1, filters.length - 1)]);
		}
	} else {
		if (current !== null) {
			const index = filters.indexOf(current);
			if (index) $currentTab.set(filters[Math.max(0, index - 1)]);
			else $currentTab.set(null);
		}
	}
}

function FolderEmpty() {
	return (
		<div class={styles.empty_folder}>
			<div class={styles.folder}>
				<MarkdownText text="📁"></MarkdownText>
			</div>
			<div class={styles.empty}>Folder is empty</div>
			<div class={styles.text}>No chats currently belong to this folder.</div>
		</div>
	);
}

export default function Home(props: { hidden: boolean }) {
	// let mounted = false;

	onMount(() => {
		LazyNewChat.preload();
		// mounted = true;

		setStatusbarColor("#1c96c3");

		SpatialNavigation.add("dialogs", {
			selector: `.${styles.dialogs} .focusable`,
			rememberSource: true,
			restrict: "self-only",
			defaultElement: `.${styles.dialog}`,
			enterTo: "last-focused",
		});
	});

	onCleanup(() => {
		// mounted = false;
		SpatialNavigation.remove("dialogs");
	});

	createEffect(() => {
		const hidden = props.hidden;

		if (!hidden) {
			SpatialNavigation.resume();
			SpatialNavigation.focus("dialogs");
			scrollIntoView(document.activeElement!, {
				scrollMode: "if-needed",
				block: "nearest",
				inline: "nearest",
			});
		}
	});

	const currentTab = useStore($currentTab);
	const dialogs = useStore($dialogs);
	const dialogFilters = useStore($dialogFilters);

	const [currentSlice, setCurrentSlice] = createSignal(10);
	const [searchText, setSearchText] = createSignal("");

	const [searchResults, setSearchResults] = createSignal<UIDialog[]>([]);

	const debounced_search = debounce((str: string) => {
		if (searchText()) {
			const results = chatMinisearch.search(str).map((a) => dialogsJar.get(a.id)!);
			// console.log("SEARCH RESULTS", results, chatMinisearch);
			setSearchResults(results);
		}
	}, 150);

	createEffect(() => {
		const toSearch = searchText();
		debounced_search(toSearch.toLowerCase());
	});

	let _lastDialog: UIDialog | undefined;

	const tabFiltered = createMemo(() => {
		const _tab = currentTab();
		const slice = currentSlice();
		const _dialogs = dialogs();

		if (_tab == null) {
			const noFilter = _dialogs.slice(0, slice);
			_lastDialog = last(noFilter);
			return noFilter;
		}
		// maybe i should memoize these values?
		// a huge array filled of object pointers shouldn't use too much memory right?
		// console.time("dialog filter");

		const filtered: UIDialog[] = [];

		for (let i = 0; i < _dialogs.length; i++) {
			const d = _dialogs[i];
			if (_tab.filter(d)) {
				filtered.push(d);
				if (filtered.length >= slice) break;
			}
		}

		// console.timeEnd("dialog filter");

		_lastDialog = last(filtered);
		return filtered;
	});

	return (
		<>
			<Content
				hidden={props.hidden}
				before={
					<Tabs>
						<Tab
							onClick={() => {
								$currentTab.set(null);
							}}
							selected={currentTab() == null}
						>
							Chats
						</Tab>
						<Index each={dialogFilters()}>{(a) => <DialogFilterTab $={a()} />}</Index>
					</Tabs>
				}
			>
				<div class={styles.home}>
					<div
						onKeyDown={(e) => {
							// console.error("ONKEYDOWN", e.target.tagName);
							if ("value" in e.target && e.target.value != "") return;

							if (e.key == "ArrowLeft" || e.key == "ArrowRight") {
								moveTab(e.key == "ArrowRight");
								const divEl = e.currentTarget;

								sleep().then(() => {
									if (document.activeElement != document.body) return;
									const focusNext: HTMLElement =
										divEl.querySelector("." + styles.dialog) || divEl.querySelector("input.focusable")!;
									focusNext.focus();
								});
							}
						}}
						class={styles.dialogs}
					>
						<Show when={dialogs().length}>
							<Search
								onInput={(e) => {
									setSearchText(e.currentTarget.value.toLocaleLowerCase());
								}}
								onFocus={(e) => {
									e.currentTarget.scrollIntoView(false);
									setStatusbarColor("#1c96c3");
									setSoftkeys("New chat", "", "tg:more");
								}}
								onKeyDown={(e) => {
									if (e.key == "SoftLeft") {
										$previousView.set("home");
										$view.set("new_chat");
									}
								}}
								classList={{ focusable }}
								placeholder="Search"
							/>
						</Show>
						<Show when={searchText() && searchResults().length}>
							<div>
								<For each={searchResults()}>{(dialog) => <DialogItem $={dialog} />}</For>
							</div>
						</Show>
						<div
							style={
								searchText()
									? {
											display: "none",
										}
									: undefined
							}
						>
							<Index
								fallback={
									<Show when={currentTab() != null}>
										<FolderEmpty></FolderEmpty>
									</Show>
								}
								each={tabFiltered()}
							>
								{(dialog) => (
									<DialogItem
										$={dialog()}
										isLast={() => dialog() === _lastDialog}
										loadMore={() => {
											setCurrentSlice((e) => e + 3);
										}}
									></DialogItem>
								)}
							</Index>
						</div>
					</div>
				</div>
			</Content>
		</>
	);
}
