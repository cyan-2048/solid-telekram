import { TelegramClient, User } from "@mtcute/web";
import { Array_from_DOMCursor } from "../helpers";

/**
 *
 * @returns returns null if no new contacts have to be added
 */
export async function importKaiContacts(tg: TelegramClient, cachedContacts: User[]) {
	const contactsFromKai = await Array_from_DOMCursor(navigator.mozContacts.getAll());

	const contactsForTelegram: Parameters<typeof tg.importContacts>[0] = [];

	const numbersAlreadySaved = new Set(cachedContacts.map((a) => "+" + a.phoneNumber!));

	console.error(numbersAlreadySaved);

	contactsFromKai.forEach((contact) => {
		const isFullname = contact.givenName && contact.familyName;

		const firstName = isFullname ? contact.givenName[0] : contact.name[0];
		const lastName = isFullname ? contact.familyName[0] : "";

		contact.tel.forEach((field) => {
			// only import the ones not already added
			if (!numbersAlreadySaved.has(field.value))
				contactsForTelegram.push({
					firstName,
					lastName,
					phone: field.value,
				});
		});
	});

	if (!contactsForTelegram.length) return null;

	const users = (await tg.importContacts(contactsForTelegram)).users;

	// return early
	if (!users.length) return [];

	const idSet = new Set(cachedContacts.map((a) => a.id));

	// only return users that were not there before! and also return the User object
	return users.filter((a) => !idSet.has(a.id)).map((a) => new User(a));
}
