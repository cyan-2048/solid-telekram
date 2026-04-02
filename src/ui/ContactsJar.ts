import { toaster } from "@/utils";
import { tg } from "@globals";
import type { User } from "@mtcute/web";
import MiniSearch from "minisearch";
import { atom } from "nanostores";

export default class ContactsJar extends Map<number, User> {
	$cached = atom<User[]>([]);

	search = new MiniSearch({
		fields: ["name"],
	});

	constructor() {
		super();
		this.$cached.subscribe(async (contacts) => {
			this.search.removeAll();
			this.search.addAll(
				contacts.map((a) => ({
					id: a.id,
					name: a.displayName,
				}))
			);
		});
	}

	async reload() {
		try {
			return this.addAll(await tg.getContacts());
		} catch (e) {
			toaster("Error occured while trying to reload contacts!");
			return [];
		}
	}

	addAll(users: User[]) {
		users.forEach((a) => this.set(a.id, a));
		this.updateCached();
		return users;
	}

	private updateCached() {
		this.$cached.set([...this.values()]);
	}

	set(id: number, contact: User) {
		super.set(id, contact);
		this.updateCached();
		return this;
	}

	delete(id: number) {
		return this.remove(id);
	}

	remove(id: number) {
		const result = super.delete(id);
		result && this.updateCached();
		return result;
	}

	clear(): void {
		super.clear();
		this.$cached.set([]);
	}

	add(contact: User) {
		return this.set(contact.id, contact);
	}
}
