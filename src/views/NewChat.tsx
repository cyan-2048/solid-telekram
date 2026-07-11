import * as styles from "./NewChat.module.scss";

import { batch, createEffect, createSignal, createUniqueId, For, onCleanup, onMount, Show } from "solid-js";
import Content from "@components/Content";
import Header from "@components/Header";
import SpatialNavigation from "@/lib/spatial_navigation";
import { setSoftkeys, sleep } from "@utils";

import scrollIntoView from "scroll-into-view-if-needed";
import Search from "@components/Search";
import PeerPhotoIcon from "@components/PeerPhotoIcon";
import type { User } from "@mtcute/core";
import { MarkdownText } from "@components/Markdown";
import Options from "@components/Options";
import OptionsItem from "@components/OptionsItem";
import { Portal } from "solid-js/web";
import { importKaiContact, importKaiContacts } from "@/lib/import-contacts";
import debounce from "lodash-es/debounce";
import { startActivity } from "@/lib/webActivities";
import { tg, dialogsJar, contactsJar, sortDialogs } from "@globals";
import { $room, $view, setStatusbarColor } from "@/stores";
import { useStore } from "@nanostores/solid";

const contactsMinisearch = contactsJar.search;

const SUPPORTS_IMPORT_CONTACTS = Boolean(navigator.mozContacts);

function OptionsContactItem(props: { user: User | null; onClose: () => void }) {
	const SN_ID_OPTIONS = createUniqueId();

	onMount(() => {
		SpatialNavigation.add(SN_ID_OPTIONS, {
			selector: "." + styles.option,
			restrict: "self-only",
		});
		SpatialNavigation.focus(SN_ID_OPTIONS);
		setSoftkeys("", "OK", "");
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID_OPTIONS);
	});

	return (
		<Options onClose={props.onClose} title="Options">
			<Show when={SUPPORTS_IMPORT_CONTACTS}>
				<OptionsItem
					classList={{ [styles.option]: true }}
					tabIndex={-1}
					on:sn-enter-down={async () => {
						startActivity<{ contact: mozContact }>("pick", {
							type: ["webcontacts/contact"],
						}).then(async (data) => {
							const contact = data?.contact;

							if (contact) {
								const cached = contactsJar.$cached.get();

								const result = await importKaiContact(tg, cached.length ? cached : await contactsJar.reload(), contact);

								if (!result) return;
								if (result.length) {
									contactsJar.addAll(result);
								}
							}
						});

						props.onClose();
					}}
				>
					Add new contact
				</OptionsItem>
			</Show>
			<OptionsItem
				classList={{ [styles.option]: true }}
				on:sn-enter-down={async () => {
					contactsJar.clear();
					await sleep();
					contactsJar.reload();
					props.onClose();
				}}
				tabIndex={-1}
			>
				Reload contacts
			</OptionsItem>
			<Show when={SUPPORTS_IMPORT_CONTACTS}>
				<OptionsItem
					classList={{ [styles.option]: true }}
					on:sn-enter-down={async () => {
						const count = await navigator.mozContacts.getCount().then((a) => a);
						if (count > 100) {
							// KaiOS only, does not require modal
							if (!confirm("You have more than 100 contacts, are you sure you want to import them all?")) return;
						}

						const cached = contactsJar.$cached.get();

						const result = await importKaiContacts(tg, cached.length ? cached : await contactsJar.reload());

						if (!result) return;
						if (result.length) {
							contactsJar.addAll(result);
						}
						props.onClose();
					}}
					tabIndex={-1}
				>
					Import contacts
				</OptionsItem>
			</Show>
		</Options>
	);
}

async function getUIDialogFromUser(user: User) {
	const peerId = user.id;
	const fromJar = dialogsJar.get(peerId);
	if (fromJar) return fromJar;

	const fromTelegram = (await tg.getPeerDialogs(user))[0];

	if (!fromTelegram) return null;

	const uiDialog = dialogsJar.add(fromTelegram);
	sortDialogs();
	return uiDialog;
}

function ContactItem(props: { user: User }) {
	const [showOptions, setShowOptions] = createSignal(false);

	let divRef!: HTMLDivElement;

	return (
		<>
			<div
				ref={divRef}
				tabIndex={0}
				classList={{
					[styles.item]: true,
					[styles.contact]: true,
				}}
				on:sn-willfocus={(e) => {
					scrollIntoView(e.currentTarget, {
						scrollMode: "if-needed",
						block: "nearest",
						inline: "nearest",
					});

					setSoftkeys("Cancel", "OPEN", "tg:more");
				}}
				onKeyUp={async (e) => {
					if (e.key == "Enter") {
						divRef.blur();

						SpatialNavigation.pause();

						const uiDialog = await getUIDialogFromUser(props.user);

						SpatialNavigation.resume();

						if (!uiDialog) {
							divRef.focus();
							return;
						}

						if (!uiDialog.messages.hasLoadedBefore) {
							uiDialog.messages.loadMore();
						}

						batch(() => {
							setStatusbarColor("#1c96c3");
							$room.set(uiDialog);
							$view.set("room");
						});
					}

					if (e.key == "SoftRight") {
						setShowOptions(true);
					}
				}}
			>
				<div class={styles.photo}>
					<PeerPhotoIcon peer={props.user}></PeerPhotoIcon>
				</div>
				<div class={styles.name}>
					<MarkdownText text={props.user.displayName} />
				</div>
			</div>

			<Show when={showOptions()}>
				<Portal>
					<OptionsContactItem
						onClose={async () => {
							setShowOptions(false);
							SpatialNavigation.focus("new_chat");
						}}
						user={props.user}
					></OptionsContactItem>
				</Portal>
			</Show>
		</>
	);
}

export default function NewChat(props: { onClose: () => void }) {
	onMount(async () => {
		SpatialNavigation.add("new_chat", {
			selector: "." + styles.item + ", .new_chat_search",
			restrict: "self-only",
		});

		SpatialNavigation.focus("new_chat");

		setStatusbarColor("#0a323f");

		if (!contactsJar.size) {
			await sleep();
			await contactsJar.reload();
		}
	});

	onCleanup(() => {
		SpatialNavigation.remove("new_chat");
	});

	const [showOptions, setShowOptions] = createSignal(false);

	const [searchText, setSearchText] = createSignal("");

	const [searchResults, setSearchResults] = createSignal<User[]>([]);

	const debounced_search = debounce((str: string) => {
		if (searchText()) {
			setSearchResults(contactsMinisearch.search(str).map((a) => contactsJar.get(a.id)!));
		}
	}, 50);

	createEffect(() => {
		const toSearch = searchText();
		debounced_search(toSearch.toLowerCase());
	});

	const cachedContacts = useStore(contactsJar.$cached);

	return (
		<>
			<Content before={<Header>New chat{cachedContacts().length ? ` (${cachedContacts().length})` : ""}</Header>}>
				<div
					onKeyDown={(e) => {
						if (e.key == "Backspace") {
							const actEl = document.activeElement as HTMLInputElement;

							if (actEl?.tagName == "INPUT" && actEl.value != "") {
								return;
							}

							e.preventDefault();
						}
					}}
					onKeyUp={(e) => {
						if (e.key == "SoftLeft") {
							props.onClose();
						}

						if (e.key == "Backspace") {
							props.onClose();
						}
					}}
					style={{ "background-color": "white", height: "100%" }}
				>
					<Search
						class="new_chat_search"
						onFocus={() => {
							setSoftkeys("Cancel", "", "tg:more");
						}}
						on:sn-willfocus={(e) => {
							e.currentTarget.scrollIntoView(false);
						}}
						onKeyDown={(e) => {
							if (e.key == "SoftRight") {
								setShowOptions(true);
							}
						}}
						onInput={(e) => {
							setSearchText(e.currentTarget.value);
						}}
						placeholder="Search"
					></Search>
					<Show
						when={!searchResults().length || searchText() === ""}
						fallback={<For each={searchResults()}>{(r) => <ContactItem user={r} />}</For>}
					>
						<For each={cachedContacts()}>{(r) => <ContactItem user={r} />}</For>
					</Show>
				</div>
			</Content>

			<Show when={showOptions()}>
				<Portal>
					<OptionsContactItem
						onClose={async () => {
							setShowOptions(false);
							SpatialNavigation.focus("new_chat");
						}}
						user={null}
					></OptionsContactItem>
				</Portal>
			</Show>
		</>
	);
}
