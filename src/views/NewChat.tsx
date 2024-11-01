import styles from "./NewChat.module.scss";

import { batch, createSignal, For, JSXElement, onCleanup, onMount, Show } from "solid-js";
import Content from "./components/Content";
import Header from "./components/Header";
import SpatialNavigation from "@/lib/spatial_navigation";
import { sleep } from "@/lib/utils";
import {
	cachedContacts,
	client,
	dialogsJar,
	reloadCachedContacts,
	setCachedContacts,
	setRoom,
	setSoftkeys,
	setStatusbarColor,
	setUIDialog,
	setView,
} from "@signals";
import scrollIntoView from "scroll-into-view-if-needed";
import Search from "./components/Search";
import { PeerPhotoIcon } from "./components/PeerPhoto";
import { User } from "@mtcute/core";
import { ModifyString } from "./components/Markdown";
import Options from "./components/Options";
import OptionsItem from "./components/OptionsItem";
import { Portal } from "solid-js/web";
import { importKaiContacts } from "@/lib/import-contacts";

const SUPPORTS_IMPORT_CONTACTS = Boolean(navigator.mozContacts);

const SN_ID_OPTIONS = "dialog_options_contacts";

function OptionsContactItem(props: { user: User | null; onClose: () => void }) {
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
			<OptionsItem classList={{ [styles.option]: true }} tabIndex={-1}>
				Add new contact
			</OptionsItem>
			<OptionsItem
				classList={{ [styles.option]: true }}
				on:sn-enter-down={async () => {
					setCachedContacts([]);
					await sleep();
					reloadCachedContacts();
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
							if (!confirm("You have more than 100 contacts, are you sure you want to import them all?")) return;
						}

						const cached = cachedContacts();

						const result = await importKaiContacts(client()!, cached.length ? cached : await reloadCachedContacts());

						if (!result) return;
						if (result.length) {
							setCachedContacts((a) => a.concat(result));
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

function ContactItem(props: { user: User }) {
	const [showOptions, setShowOptions] = createSignal(false);

	return (
		<>
			<div
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
				onKeyDown={async (e) => {
					const tg = client()!;

					if (e.key == "Enter") {
						const dialog = (await tg.getPeerDialogs(props.user))[0];

						if (!dialog) return;

						const uiDialog = dialogsJar.add(dialog);

						if (!uiDialog.messages.hasLoadedBefore) {
							uiDialog.messages.loadMore();
						}

						batch(() => {
							setStatusbarColor("#3b90bc");
							setUIDialog(uiDialog);
							setRoom(uiDialog.$.chat);
							setView("room");
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
					<ModifyString text={props.user.displayName} />
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

		if (!cachedContacts().length) {
			await sleep();
			await reloadCachedContacts();
		}
	});

	onCleanup(() => {
		SpatialNavigation.remove("new_chat");
	});

	const [showOptions, setShowOptions] = createSignal(false);

	return (
		<>
			<Content before={<Header>New chat{cachedContacts().length ? ` (${cachedContacts().length})` : ""}</Header>}>
				<div
					onKeyDown={(e) => {
						if (e.key == "SoftLeft") {
							props.onClose();
						}

						if (e.key == "Backspace") {
							const actEl = document.activeElement as HTMLInputElement;

							if (actEl?.tagName == "INPUT" && actEl.value != "") {
								return;
							}

							e.preventDefault();
							props.onClose();
						}
					}}
					style={{ "background-color": "white", height: "100%" }}
				>
					<Search
						class="new_chat_search"
						onFocus={(e) => {
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
						placeholder="Search"
					></Search>
					<For each={cachedContacts()}>{(r) => <ContactItem user={r} />}</For>
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
