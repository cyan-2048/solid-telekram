import styles from "./Home.module.scss";
import {
	For,
	Show,
	createEffect,
	createRenderEffect,
	createSignal,
	from,
	onCleanup,
	onMount,
} from "solid-js";
import {
	UIDialog,
	dialogs,
	dialogsJar,
	setRoom,
	setSoftkeys,
	setStatusbarColor,
	setView,
} from "@signals";
import Search from "./components/Search";
import Content from "./components/Content";
import Tabs, { Tab } from "./components/Tabs";
import { resumeKeypress, sleep, useStore } from "@/lib/utils";
import MarqueeOrNot from "./components/MarqueeOrNot";
import SpatialNavigation from "@/lib/spatial_navigation";
import scrollIntoView from "scroll-into-view-if-needed";
import TelegramIcon, { VerifiedIcon } from "./components/TelegramIcon";
import { Unsubscriber, get, readable } from "@/lib/stores";
import ChatPhotoIcon from "./components/ChatPhoto";
import { unparse } from "@/lib/unparse";
import { ModifyString } from "./components/Markdown";
import MiniSearch from "minisearch";
import { debounce } from "lodash-es";

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

export function isToday(date: Date, today = new Date()) {
	return (
		date.getDate() == today.getDate() &&
		date.getMonth() == today.getMonth() &&
		date.getFullYear() == today.getFullYear()
	);
}

export function timeStamp(date: Date) {
	const today = new Date();

	const isSameYear = today.getFullYear() == date.getFullYear();

	if (isSameYear) {
		if (isToday(date, today)) {
			return date.toLocaleTimeString([], {
				hour: "numeric",
				minute: "numeric",
			});
		} else {
			const isSameWeek = getWeek(date) == getWeek(today);
			if (isSameWeek) {
				return date.toLocaleDateString([], {
					weekday: "short",
				});
			} else {
				return date.toLocaleDateString([], {
					month: "short",
					day: "numeric",
				});
			}
		}
	} else {
		return date.toLocaleDateString();
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
	const lastReadOutgoing = useStore(() => props.$.lastReadOutgoing);

	return (
		<Show when={lastMessage() && !lastMessage()!.$.action}>
			<Show when={lastMessage()?.isOutgoing}>
				<div class={styles.check}>
					<TelegramIcon name={lastReadOutgoing() < lastMessage()!.id ? "check" : "checks"} />
				</div>
			</Show>
			<Show
				when={lastMessage() && !lastMessage()!.isOutgoing && (chat().isGroup || chat().isForum)}
			>
				<span class={styles.sender}>
					{lastMessage()!.sender.firstName || lastMessage()!.sender.displayName}:{" "}
				</span>
			</Show>
		</Show>
	);
}

const minisearch = new MiniSearch({
	fields: ["name"],
});

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
											.join("")
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
			_text &&
			(isSupport
				? _text.replace(/Login code: \d\d\d\d\d/, "Login code: " + generateHiddenCodeThing())
				: _text)
		);
	};

	createEffect(() => {
		// we won't index searchResults
		if (props.isSearchResult) return;

		const dialog = props.$;

		minisearch.add({
			name: (dialog.$.chat.isSelf ? "Saved Messages" : dialog.$.chat.displayName).toLowerCase(),
			id: dialog.id,
		});

		onCleanup(() => {
			minisearch.discard(dialog.id);
		});
	});

	return (
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
			on:sn-enter-down={async () => {
				if (!props.$.messages.hasLoadedBefore) {
					props.$.messages.loadMore();
					await sleep(0);
				}
				setRoom(props.$.$.chat);
				await sleep(0);
				setView("room");
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
	);
}

export default function Home(props: { hidden: boolean }) {
	const [mounted, setMounted] = createSignal(false);

	onMount(() => {
		SpatialNavigation.add("dialogs", {
			selector: `.${styles.dialogs} .focusable`,
			rememberSource: true,
			restrict: "self-only",
			defaultElement: `.${styles.dialog}`,
			enterTo: "last-focused",
		});

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
			setSearchResults(minisearch.search(str).map((a) => dialogsJar.get(a.id)!));
		}
	}, 150);

	createEffect(() => {
		const toSearch = searchText();
		debounced_search(toSearch.toLowerCase());
	});

	return (
		<>
			<Content
				hidden={props.hidden}
				before={
					<Tabs>
						<Tab selected>Chats</Tab>
						{/* <Tab>Stories</Tab> */}
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
								setSoftkeys("New chat", "", "tg:more");
							}}
							classList={{ focusable }}
							placeholder="Search"
						/>

						<Show when={searchText() && searchResults().length}>
							<div>
								<For each={searchResults()}>
									{(dialog) => <DialogItem $={dialog} isSearchResult />}
								</For>
							</div>
						</Show>
						<div
							style={{
								display: searchText() ? "none" : undefined,
							}}
						>
							<For each={dialogs()}>{(dialog) => <DialogItem $={dialog} />}</For>
						</div>
					</div>
				</div>
			</Content>
		</>
	);
}
