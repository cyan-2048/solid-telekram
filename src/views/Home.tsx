import styles from "./Home.module.scss";
import {
	For,
	Show,
	batch,
	createEffect,
	createMemo,
	createRenderEffect,
	createSignal,
	from,
	onCleanup,
	onMount,
} from "solid-js";
import {
	UIDialog,
	UIDialogFilter,
	chatMinisearch,
	client,
	currentTab,
	dialogFilters,
	dialogs,
	dialogsJar,
	room,
	setRoom,
	setSoftkeys,
	setStatusbarColor,
	setTab,
	setUIDialog,
	setView,
	showKaiAd,
	toaster,
} from "@signals";
import Search from "./components/Search";
import Content from "./components/Content";
import Tabs, { Tab } from "./components/Tabs";
import { isToday, resumeKeypress, sleep, useMessageChecks, useStore } from "@/lib/utils";
import MarqueeOrNot from "./components/MarqueeOrNot";
import SpatialNavigation from "@/lib/spatial_navigation";
import scrollIntoView from "scroll-into-view-if-needed";
import TelegramIcon, { VerifiedIcon } from "./components/TelegramIcon";
import { Unsubscriber, get, readable } from "@/lib/stores";
import ChatPhotoIcon from "./components/ChatPhoto";
import { unparse } from "@/lib/unparse";
import { ModifyString } from "./components/Markdown";
import { debounce } from "lodash-es";
import Options from "./components/Options";
import OptionsItem from "./components/OptionsItem";
import { Portal } from "solid-js/web";
import Changelog from "./Changelog";

const focusable = true;

const BRAILE = "⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠩⠝⠕⠏⠟⠗⠎⠞⠥⠼⠺⠭⠽⠵";

function generateHiddenCodeThing(length = 5) {
	let e = "";

	while (e.length < length) {
		e = e + BRAILE[Math.floor(Math.random() * BRAILE.length)];
	}

	return e;
}

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

function DialogSender(props: { $: UIDialog }) {
	const chat = () => props.$.$.chat;
	const lastMessage = useStore(() => props.$.lastMessage);

	const check = useMessageChecks(lastMessage, () => props.$);

	return (
		<Show when={lastMessage() && !lastMessage()!.$.action}>
			<Show when={lastMessage()?.isOutgoing}>
				<div class={styles.check}>
					<TelegramIcon name={check() ? "check" : "checks"} />
				</div>
			</Show>
			<Show when={lastMessage() && !lastMessage()!.isOutgoing && (chat().isGroup || chat().isForum)}>
				<span class={styles.sender}>{lastMessage()!.sender.firstName || lastMessage()!.sender.displayName}: </span>
			</Show>
		</Show>
	);
}

const SN_ID_OPTIONS = "dialog_options";

// to do more shit
const enum DialogOptionsSelected {
	PIN,
	UNPIN,

	MUTE,
	UNMUTE,

	LOGOUT,
	KAIAD,
	CHANGELOG,

	SETTINGS,
}

function DialogOptions(props: {
	$: UIDialog;
	pinned: boolean;
	muted: boolean;
	onSelect: (e: DialogOptionsSelected | null) => void;
}) {
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
			<OptionsItem
				classList={{ option: true, [styles.item]: true }}
				tabIndex={-1}
				on:sn-enter-down={() => {
					props.onSelect(DialogOptionsSelected.CHANGELOG);
				}}
			>
				Changelog
			</OptionsItem>
			<OptionsItem
				classList={{ option: true, [styles.item]: true }}
				tabIndex={-1}
				on:sn-enter-down={() => {
					props.onSelect(DialogOptionsSelected.LOGOUT);
				}}
			>
				Logout
			</OptionsItem>
			<OptionsItem
				classList={{ option: true, [styles.item]: true }}
				tabIndex={-1}
				on:sn-enter-down={() => {
					props.onSelect(DialogOptionsSelected.SETTINGS);
				}}
			>
				Settings
			</OptionsItem>
			<Show when={!localStorage.getItem("NO_ADS")}>
				<OptionsItem
					classList={{ option: true, [styles.item]: true }}
					tabIndex={-1}
					on:sn-enter-down={() => {
						props.onSelect(DialogOptionsSelected.KAIAD);
					}}
				>
					Show Ad
				</OptionsItem>
			</Show>
		</Options>
	);
}

function DialogItem(props: { $: UIDialog; isSearchResult?: boolean }) {
	const [focused, setFocused] = createSignal(false);

	const lastMessage = useStore(() => props.$.lastMessage);

	let divRef!: HTMLDivElement;

	const text = from(
		readable("", (set) => {
			const unsubs: Unsubscriber[] = [];
			const sub = props.$.lastMessage.subscribe((lastMsg) => {
				if (lastMsg) {
					unsubs.push(
						lastMsg.entities.subscribe((str) => {
							str.entities
								? set(
										unparse(str)
											.map((a) =>
												typeof a == "string"
													? a
													: a.entity._ == "messageEntitySpoiler"
													? generateHiddenCodeThing(a.source.length)
													: a.source
											)
											.join("") || get(lastMsg.text)
								  )
								: set(get(lastMsg.text));
						})
					);
				} else {
					set("");
				}
			});
			unsubs.push(sub);

			return () => {
				unsubs.forEach((a) => a());
			};
		})
	);

	const pinned = useStore(() => props.$.pinned);

	const count = useStore(() => props.$.count);

	const muted = useStore(() => props.$.muted);

	const textFactory = () => {
		const _text = text();
		const isSupport = props.$.$.chat.isSupport;

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

	const [showChangelog, setShowChangelog] = createSignal(false);

	const [showOptions, setShowOptions] = createSignal(false);

	return (
		<>
			<div
				ref={divRef}
				onFocus={() => {
					setStatusbarColor("#3b90bc");
					setSoftkeys("New chat", "OPEN", "tg:more");
					setFocused(true);
				}}
				onBlur={() => {
					setFocused(false);
				}}
				onKeyDown={(e) => {
					if (e.key == "SoftRight") {
						setShowOptions(true);
					}
				}}
				on:sn-enter-down={async () => {
					if (!props.$.messages.hasLoadedBefore) {
						props.$.messages.loadMore();
					}

					batch(() => {
						setUIDialog(props.$);
						setRoom(props.$.$.chat);
						setView("room");
					});

					if (props.$.$.chat.isForum) {
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
					<ChatPhotoIcon chat={props.$.$.chat}></ChatPhotoIcon>
				</div>
				<div class={styles.details}>
					<div class={styles.top}>
						<div class={styles.name}>
							<MarqueeOrNot marquee={focused()}>
								{props.$.$.chat.isSelf ? "Saved Messages" : props.$.$.chat.displayName}
							</MarqueeOrNot>
						</div>
						<div class={styles.time}>
							<Show when={"verified" in props.$.$.chat.peer && props.$.$.chat.peer.verified}>
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
							<ModifyString text={textFactory()?.slice(0, 30) || "__"} />
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
							const tg = client()!;
							setShowOptions(false);

							switch (e) {
								case DialogOptionsSelected.KAIAD:
									showKaiAd();
									break;
								case DialogOptionsSelected.LOGOUT:
									await sleep(100);

									const sure = confirm("Are you sure you want to logout?");

									if (!sure) break;

									const success = await tg.logOut();
									if (!success) {
										alert("Logout was not successful!");
										await tg.storage.clear(true);
									}
									location.reload();
									return;
								case DialogOptionsSelected.CHANGELOG:
									setShowChangelog(true);
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
			<Show when={showChangelog()}>
				<Changelog
					onClose={async () => {
						setShowChangelog(false);
						await sleep(100);
						SpatialNavigation.focus("dialogs");
					}}
				></Changelog>
			</Show>
		</>
	);
}

function DialogFilterTab(props: { $: UIDialogFilter }) {
	const text = useStore(() => props.$.title);

	return (
		<Tab
			onClick={() => {
				setTab(props.$);
			}}
			selected={currentTab() == props.$}
		>
			{text()}
		</Tab>
	);
}

const ONE_FOCUSABLE = ".focusable";
const TWO_FOCUSABLE = ONE_FOCUSABLE.repeat(2);

let lastUsedFocusableClass = TWO_FOCUSABLE;

function refreshFocusables() {
	SpatialNavigation.remove("dialogs");

	const focusableToUse = (lastUsedFocusableClass =
		lastUsedFocusableClass == ONE_FOCUSABLE ? TWO_FOCUSABLE : ONE_FOCUSABLE);

	SpatialNavigation.add("dialogs", {
		selector: `.${styles.dialogs} ${focusableToUse}`,
		rememberSource: true,
		restrict: "self-only",
		defaultElement: `.${styles.dialog}`,
		enterTo: "last-focused",
	});
}

export default function Home(props: { hidden: boolean }) {
	const [mounted, setMounted] = createSignal(false);

	onMount(() => {
		refreshFocusables();

		setMounted(true);
	});

	onCleanup(() => {
		setMounted(false);
		SpatialNavigation.remove("dialogs");
	});

	createEffect(() => {
		const hidden = props.hidden;

		if (!mounted()) return;

		if (!hidden) {
			resumeKeypress();
			SpatialNavigation.resume();
			SpatialNavigation.focus("dialogs");
			scrollIntoView(document.activeElement!, {
				scrollMode: "if-needed",
				block: "nearest",
				inline: "nearest",
			});
		}
	});

	const [searchText, setSearchText] = createSignal("");

	const [searchResults, setSearchResults] = createSignal<UIDialog[]>([]);

	const debounced_search = debounce((str: string) => {
		if (searchText()) {
			setSearchResults(chatMinisearch.search(str).map((a) => dialogsJar.get(a.id)!));
		}
	}, 150);

	createEffect(() => {
		const toSearch = searchText();
		debounced_search(toSearch.toLowerCase());
	});

	const [currentSlice, setCurrentSlice] = createSignal(20);

	const tabFiltered = createMemo(() => {
		const _tab = currentTab();
		const slice = currentSlice();
		const _dialogs = dialogs();

		if (_tab == null) return _dialogs.slice(0, slice);
		// maybe i should memoize these values?
		// a huge array filled of object pointers shouldn't use too much memory right?
		console.time("dialog filter");

		const filtered: UIDialog[] = [];

		for (let i = 0; i < _dialogs.length; i++) {
			const d = _dialogs[i];
			if (_tab.filter(d)) {
				filtered.push(d);
				if (filtered.length >= slice) break;
			}
		}

		console.timeEnd("dialog filter");

		return filtered;
	});

	return (
		<>
			<Content
				hidden={props.hidden}
				before={
					<Tabs>
						<Tab selected={currentTab() == null}>Chats</Tab>
						<For each={dialogFilters()}>{(a) => <DialogFilterTab $={a} />}</For>
					</Tabs>
				}
			>
				<div class={styles.home}>
					<div class={styles.dialogs}>
						<Search
							onInput={(e) => {
								setSearchText(e.currentTarget.value);
							}}
							onFocus={(e) => {
								e.currentTarget.scrollIntoView(false);
								setStatusbarColor("#3b90bc");
								setSoftkeys(
									"New chat",

									"",
									"tg:more"
								);
							}}
							classList={{ focusable }}
							placeholder="Search"
						/>

						<Show when={searchText() && searchResults().length}>
							<div>
								<For each={searchResults()}>{(dialog) => <DialogItem $={dialog} isSearchResult />}</For>
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
							on:sn-navigatefailed={(e) => {
								const direction = e.detail.direction;

								switch (direction) {
									case "down":
										if (currentSlice() < dialogs().length) {
											setCurrentSlice((e) => e + 20);
										}
										break;

									case "right":
									case "left":
										const filters = dialogFilters();
										if (!filters.length) break;
										const current = currentTab();

										if (direction == "right") {
											if (current === null) {
												setTab(filters[0]);
											} else {
												setTab(filters[Math.min(filters.indexOf(current) + 1, filters.length - 1)]);
											}
										} else {
											if (current !== null) {
												const index = filters.indexOf(current);
												if (index) setTab(filters[Math.max(0, index - 1)]);
												else setTab(null);
											}
										}

										refreshFocusables();
										SpatialNavigation.focus("dialogs");
										break;
								}
							}}
						>
							<For
								fallback={
									<div>
										<ModifyString text="👀"></ModifyString>
									</div>
								}
								each={tabFiltered()}
							>
								{(dialog) => <DialogItem $={dialog} />}
							</For>
						</div>
					</div>
				</div>
			</Content>
		</>
	);
}
