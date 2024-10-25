import styles from "./NewChat.module.scss";

import { batch, For, JSXElement, onCleanup, onMount } from "solid-js";
import Content from "./components/Content";
import Header from "./components/Header";
import SpatialNavigation from "@/lib/spatial_navigation";
import { sleep } from "@/lib/utils";
import {
	cachedContacts,
	client,
	dialogsJar,
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

function ContactItem(props: { user: User }) {
	return (
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
			}}
		>
			<div class={styles.photo}>
				<PeerPhotoIcon peer={props.user}></PeerPhotoIcon>
			</div>
			<div class={styles.name}>
				<ModifyString text={props.user.displayName} />
			</div>
		</div>
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
			setCachedContacts(await client()!.getContacts());
		}
	});

	onCleanup(() => {
		SpatialNavigation.remove("new_chat");
	});

	return (
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
					placeholder="Search"
				></Search>
				<For each={cachedContacts()}>{(r) => <ContactItem user={r} />}</For>
			</div>
		</Content>
	);
}
