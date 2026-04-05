import type { tl } from "@mtcute/core";
import type UIDialog from "./UIDialog";
import { type Dialog, getMarkedPeerId } from "@mtcute/core";
import { atom } from "nanostores";

export default class UIDialogFilter {
	filterPredicate!: (val: Dialog) => boolean;
	id: number;

	$title = atom("");

	constructor(public rawFilter: tl.RawDialogFilter) {
		this.id = rawFilter.id;
		this.update(rawFilter);
	}

	update(filter: tl.RawDialogFilter) {
		this.rawFilter = filter;
		this.$title.set(filter.title.text);
		this.filterPredicate = UIDialogFilter.filterFolder(filter);
	}

	filter(dialog: UIDialog | Dialog) {
		const rawDialog = "id" in dialog ? dialog.rawDialog : dialog;
		return this.filterPredicate(rawDialog);
	}

	/**
	 * Create a filter predicate for the given Folder.
	 * Returned predicate can be used in `Array.filter()`
	 *
	 * @param folder  Folder to filter for
	 * @param excludePinned  Whether to exclude pinned folders
	 */
	static filterFolder(folder: tl.TypeDialogFilter): (val: Dialog) => boolean {
		// return Dialog.filterFolder(folder, false);

		if (folder._ === "dialogFilterDefault") {
			return () => true;
		}

		const pinned = new Set<number>();
		const include = new Set<number>();
		const exclude = new Set<number>();

		folder.includePeers.forEach((peer) => {
			include.add(getMarkedPeerId(peer));
		});

		if (folder._ === "dialogFilterChatlist") {
			return (dialog) => {
				const peerId = dialog.peer.id;

				return include.has(peerId) || pinned.has(peerId);
			};
		}

		folder.excludePeers.forEach((peer) => {
			exclude.add(getMarkedPeerId(peer));
		});

		return (dialog) => {
			const peer = dialog.peer;
			const peerId = dialog.peer.id;

			// manual exclusion/inclusion and pins
			if (include.size && include.has(peerId)) return true;

			if (exclude.size && exclude.has(peerId)) {
				return false;
			}

			// exclusions based on status
			if (folder.excludeRead && !dialog.isUnread) return false;
			if (folder.excludeMuted && dialog.isMuted) return false;
			// even though this was handled in getDialogs, this method
			// could be used outside of it, so check again
			if (folder.excludeArchived && dialog.isArchived) return false;

			// inclusions based on chat type
			if (folder.contacts && peer.type === "user" && peer.isContact) {
				return true;
			}
			if (folder.nonContacts && peer.type === "user" && !peer.isContact) {
				return true;
			}
			if (folder.groups && peer.type === "chat" && peer.isGroup) {
				return true;
			}
			if (folder.broadcasts && peer.type === "chat" && peer.chatType === "channel") return true;
			if (folder.bots && peer.type === "user" && peer.isBot) return true;

			return false;
		};
	}
}
