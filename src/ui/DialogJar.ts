import { Dialog } from "@mtcute/core";
import UIDialog from "./UIDialog";
import MiniSearch from "minisearch";

export default class DialogsJar extends Map<number, UIDialog> {
	// it's giving Java lmao
	static jar = new DialogsJar();
	static search = new MiniSearch({
		fields: ["name"],
		searchOptions: {
			prefix: true,
		},
	});

	/**
	 * converts a UIDialog into a SearchDocument for MiniSearch
	 */
	static toSearchDocument(dialog: UIDialog) {
		return {
			name: (dialog.isSelf ? "Saved Messages" : dialog.displayName).toLowerCase(),
			id: dialog.id,
		};
	}

	static sort(dialogs: UIDialog[]) {
		const pinned = [];
		const unpinned = [];

		for (let i = 0; i < dialogs.length; i++) {
			const dialog = dialogs[i];
			if (dialog.$pinned.get()) {
				pinned.push(dialog);
			} else {
				unpinned.push(dialog);
			}
		}

		unpinned.sort((a, b) => {
			const _a = a.$lastMessage.get()?.date.getTime();
			const _b = b.$lastMessage.get()?.date.getTime();

			const a_date: number | undefined = a.joinDate?.getTime();
			const b_date: number | undefined = b.joinDate?.getTime();

			let compare1: null | number = null;
			let compare2: null | number = null;

			if (_a) {
				compare1 = _a;
			}
			if (a_date && (_a || 0) < a_date) {
				compare1 = a_date;
			}

			if (_b) {
				compare2 = _b;
			}
			if (b_date && (_b || 0) < b_date) {
				compare2 = b_date;
			}

			if (!compare1 || !compare2) return 0;

			return compare2 - compare1;

			// return +_b.date - +_a.date;
		});

		return pinned.concat(unpinned);
	}

	sorted() {
		const dialogs = this.list();
		return DialogsJar.sort(dialogs);
	}

	list() {
		return Array.from(this.values());
	}

	set(): never {
		throw new Error("not allowed");
	}

	add(dialog: UIDialog | Dialog): UIDialog {
		if (UIDialog.is(dialog)) {
			const has = this.get(dialog.id);
			if (has) {
				has.update(dialog.rawDialog);
			}

			super.set(dialog.id, has || dialog);
			const doc = DialogsJar.toSearchDocument(dialog);
			if (DialogsJar.search.has(doc.id)) {
				DialogsJar.search.replace(doc);
			} else {
				DialogsJar.search.add(doc);
			}
			return has || dialog;
		}

		const id = dialog.peer.id;
		const has = this.get(id);

		if (has) {
			has.update(dialog);
			return has;
		} else {
			return this.add(new UIDialog(dialog));
		}
	}

	remove(id: number) {
		this.delete(id);
		if (DialogsJar.search.has(id)) DialogsJar.search.discard(id);
	}
}
