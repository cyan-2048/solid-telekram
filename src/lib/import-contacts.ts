import { type TelegramClient, User } from "@mtcute/web";
import { Array_from_DOMCursor } from "../helpers";
import * as contacts from "@/lib/lib_wallace/contacts";

// module-level cache so we don't re-fetch tg.getMe() on every import call,
// and so concurrent calls share the same in-flight request
let cachedCountryCode: Promise<string> | null = null;

/**
 * Normalize a phone number to international format (no leading "+").
 *
 * Numbers starting with "0" are treated as local/domestic numbers, so the
 * leading "0" is replaced with the user's cached country code (e.g.
 * "08123456789" -> "628123456789" for Indonesia).
 */
function normalizePhone(phone: string, countryCode: string): string {
	let p = phone.replace(/[+\s()-]/g, "");

	if (p.startsWith("0")) {
		if (countryCode) p = countryCode + p.slice(1);
	}

	return p;
}

/**
 * Get (and cache) the user's country calling code (e.g. "62" for Indonesia).
 *
 * The resulting promise is cached at the module level, so concurrent calls
 * share the same in-flight request and don't re-fetch `tg.getMe()`.
 */
function getCountryCode(tg: TelegramClient): Promise<string> {
	if (cachedCountryCode) return cachedCountryCode;

	const parsePhoneNumberPromise = import("./parsePhoneNumber");

	cachedCountryCode = (async () => {
		const parsePhoneNumber = (await parsePhoneNumberPromise).default;
		const me = await tg.getMe();
		const countryCode = parsePhoneNumber("+" + me.phoneNumber!)?.countryCallingCode;

		return countryCode || "";
	})();

	return cachedCountryCode;
}

export async function importKaiContact(tg: TelegramClient, cachedContacts: User[], contact: mozContact) {
	const countryCode = await getCountryCode(tg);

	const contactsForTelegram: Parameters<typeof tg.importContacts>[0] = [];

	const numbersAlreadySaved = new Set(cachedContacts.map((a) => a.phoneNumber!));

	// console.error(numbersAlreadySaved);

	const isFullname = contact.givenName && contact.familyName;

	const firstName = isFullname ? contact.givenName[0] : contact.name[0];
	const lastName = isFullname ? contact.familyName[0] : "";

	contact.tel.forEach((field) => {
		const normalized = normalizePhone(field.value, countryCode);

		// only import the ones not already added
		if (!numbersAlreadySaved.has(normalized))
			contactsForTelegram.push({
				firstName,
				lastName,
				phone: normalized,
			});
	});

	console.error("CONTACTS TO BE UPLOADED TO TELEGRAM", contactsForTelegram);

	if (!contactsForTelegram.length) return null;

	const users = (await tg.importContacts(contactsForTelegram)).users;

	// return early
	if (!users.length) return [];

	const idSet = new Set(cachedContacts.map((a) => a.id));

	// only return users that were not there before! and also return the User object
	return users.filter((a) => !idSet.has(a.id)).map((a) => new User(a));
}

async function getAllContactsFlat() {
	const cursor = await contacts.getAll({}, 2, false);
	const result = [];
	try {
		while (true) result.push(...(await cursor.next()));
	} catch {
		/* exhausted */
	}
	cursor.release();
	return result;
}

function normalizeStringOrArray<T extends string | string[]>(val: T) {
	return typeof val == "string" ? val : val[0];
}

/**
 *
 * @returns returns null if no new contacts have to be added
 */
export async function importKaiContacts(tg: TelegramClient, cachedContacts: User[]) {
	const contactsFromKai =
		import.meta.env.KAIOS == 2
			? await Array_from_DOMCursor(navigator.mozContacts.getAll())
			: await getAllContactsFlat();

	console.log("CONTACTS FROM KAI", contactsFromKai);

	const countryCode = await getCountryCode(tg);

	const contactsForTelegram: Parameters<typeof tg.importContacts>[0] = [];

	const numbersAlreadySaved = new Set(cachedContacts.map((a) => a.phoneNumber!));

	// console.error(numbersAlreadySaved);

	contactsFromKai.forEach((contact) => {
		const givenName = contact.givenName;
		const familyName = contact.familyName;

		const isFullname = givenName && familyName;

		const firstName = isFullname
			? normalizeStringOrArray(givenName)
			: contact.name
				? normalizeStringOrArray(contact.name)
				: undefined;
		const lastName = isFullname ? normalizeStringOrArray(familyName) : "";

		contact.tel?.forEach((field) => {
			const normalized = normalizePhone(field.value, countryCode);

			// only import the ones not already added
			if (!numbersAlreadySaved.has(normalized) && firstName)
				contactsForTelegram.push({
					firstName,
					lastName,
					phone: normalized,
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
