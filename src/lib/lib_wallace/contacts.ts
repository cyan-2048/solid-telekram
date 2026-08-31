/**
 * Contacts module for the Wallace library.
 *
 * Provides access to the daemon's contacts service (lib_contacts /
 * ContactsManager). This module is fully self-contained for tree-shaking:
 * importing it pulls in the generic session + service helpers, but never
 * settings (or any other service) code.
 */
import { ensureService } from "./service";
import { DAEMON_ORIGIN } from "./session";

// ---------------------------------------------------------------------------
// Types (derived from the daemon's remote contact shape)
// ---------------------------------------------------------------------------

/** A single phone/email/url sub-field value (remote shape). */
export interface ContactField {
  atype?: string;
  value: string;
  pref?: boolean;
  carrier?: string;
}

/** A physical address (remote shape). */
export interface ContactAddress {
  atype?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  countryName?: string;
  pref?: boolean;
}

/**
 * A contact as returned by the daemon (REMOTE shape).
 *
 * NOTE: the daemon returns givenName/familyName/name as STRINGS, addresses
 * under `addresses` (with `atype`), and groups under `groups`. This differs
 * from the app's "local" shape (arrays + `adr`/`type` + `group`), which is
 * produced by convertContactToLocal().
 */
export interface Contact {
  id: string;
  published?: Date;
  updated?: Date;
  bday?: Date;
  anniversary?: Date;
  sex?: string;
  genderIdentity?: string;
  ringtone?: string;
  photoType?: string;
  photoBlob?: Uint8Array;
  addresses?: ContactAddress[];
  email?: ContactField[];
  url?: ContactField[];
  name?: string;
  tel?: ContactField[];
  honorificPrefix?: string[];
  givenName?: string;
  phoneticGivenName?: string;
  additionalName?: string[];
  familyName?: string;
  phoneticFamilyName?: string;
  honorificSuffix?: string[];
  nickname?: string[];
  category?: string[];
  org?: string[];
  jobTitle?: string[];
  note?: string[];
  groups?: string[];
  icePosition?: number;
}

/**
 * A contact in the app's LOCAL shape (after convertContactToLocal): name
 * fields are arrays, addresses use `adr`/`type`, groups use `group`.
 */
export interface ContactLocal {
  id: string;
  published?: Date;
  updated?: Date;
  bday?: Date | null;
  anniversary?: Date | null;
  sex?: string | null;
  genderIdentity?: string | null;
  ringtone?: string | null;
  adr?: ContactAddressLocal[];
  email?: ContactFieldLocal[];
  url?: string | null;
  impp?: string | null;
  tel?: ContactFieldLocal[];
  name?: string[];
  honorificPrefix?: string | null;
  givenName?: string[];
  phoneticGivenName?: string | null;
  additionalName?: string[];
  familyName?: string[];
  phoneticFamilyName?: string | null;
  honorificSuffix?: string | null;
  nickname?: string | null;
  category?: string[];
  org?: string[];
  jobTitle?: string[];
  note?: string | null;
  key?: string | null;
  group?: string[] | null;
  photo?: Blob[];
  photoBlob?: Uint8Array;
  photoType?: string;
}

/** A local-shape phone/email sub-field. */
export interface ContactFieldLocal {
  type: string[];
  value: string;
}

/** A local-shape physical address. */
export interface ContactAddressLocal {
  countryName?: string;
  locality?: string;
  postalCode?: string;
  region?: string;
  streetAddress?: string;
  type: string[];
}

/** Options for getAll. */
export interface GetAllOptions {
  sortBy?: SortOption;
  sortOrder?: Order;
  sortLanguage?: string;
}

/** Options for find. */
export interface FindOptions {
  sortBy?: SortOption;
  sortOrder?: Order;
  sortLanguage?: string;
  filterValue: string;
  filterOption: FilterOption;
  filterBy: FilterByOption[];
  onlyMainData?: boolean;
}

/** An ICE (In Case of Emergency) entry. */
export interface IceEntry {
  position: number;
  contactId: string;
}

/** A cursor over a batch of contacts returned by getAll. */
export interface ContactCursor {
  next(): Promise<Contact[]>;
  release(): void;
}

/** A contact group. */
export interface ContactGroup {
  id: string;
  name: string;
}

/** A speed dial entry. */
export interface SpeedDial {
  dialKey: string;
  tel: string;
  contactId: string;
}

/** The payload of a blocked-number change event. */
export interface BlockedNumberChangeEvent {
  reason: ChangeReason;
  number: string;
}

/** The payload of a contact-change event. */
export interface ContactChangeEvent {
  reason: ChangeReason;
  contacts?: Contact[];
}

/** The payload of a group-change event. */
export interface GroupChangeEvent {
  reason: ChangeReason;
  group: ContactGroup;
}

/** The payload of a SIM-contact-loaded event. */
export interface SimContactLoadedEvent {
  removeCount: number;
  updateCount: number;
}

/** The payload of a speed-dial change event. */
export interface SpeedDialChangeEvent {
  reason: ChangeReason;
  speeddial: SpeedDial;
}

// ---------------------------------------------------------------------------
// Constants (mirror lib_contacts)
// ---------------------------------------------------------------------------

/** Sort options for getAll. */
export const enum SortOption {
  GIVEN_NAME = 0,
  FAMILY_NAME = 1,
  NAME = 2,
}

/** Sort order for getAll. */
export const enum Order {
  ASCENDING = 0,
  DESCENDING = 1,
}

/** Fields you can filter by. */
export const enum FilterByOption {
  NAME = 0,
  GIVEN_NAME = 1,
  FAMILY_NAME = 2,
  TEL = 3,
  EMAIL = 4,
  CATEGORY = 5,
}

/** Filter operators for find. */
export const enum FilterOption {
  EQUALS = 0,
  CONTAINS = 1,
  MATCH = 2,
  STARTS_WITH = 3,
  FUZZY_MATCH = 4,
}

/** Change reasons reported by contact-change events. */
export const enum ChangeReason {
  CREATE = 0,
  UPDATE = 1,
  REMOVE = 2,
}

/** Event names exposed by the contacts service. */
export const enum ContactEvent {
  BLOCKED_NUMBER_CHANGE = "blockChange",
  CONTACT_CHANGE = "contactChange",
  GROUP_CHANGE = "groupChange",
  SPEED_DIAL_CHANGE = "speedDialChange",
  SIM_LOADED_EVENT = "simLoadedEvent",
}

// ---------------------------------------------------------------------------
// Service initialization (contacts-specific)
// ---------------------------------------------------------------------------

/** Ensure the contacts service is ready and return its manager. */
function ensureContacts(): Promise<unknown> {
  return ensureService(
    "contacts",
    `${DAEMON_ORIGIN}/contacts/service.js`,
    (session) => (window as any).lib_contacts.ContactsManager.get(session),
  ).then((manager) => {
    (navigator as any).b2g.__contactsManager = manager;
    return manager;
  });
}

/** The contacts manager handle (from lib_contacts.ContactsManager.get). */
function contactsManager(): any {
  return (navigator as any).b2g.__contactsManager;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ensure the contacts service is ready.
 */
export async function ready(): Promise<void> {
  await ensureContacts();
}

/**
 * Get all contacts as a cursor.
 *
 * @param options       - { sortBy, sortOrder, sortLanguage }
 * @param batchSize     - number of contacts per batch (defaults to 0)
 * @param onlyMainData  - if truthy, only return the main data (no photos etc.)
 * @returns a cursor; call next() to pull batches, release() when done
 */
export async function getAll(
  options: GetAllOptions = {},
  batchSize = 0,
  onlyMainData = false,
): Promise<ContactCursor> {
  await ensureContacts();
  // The daemon's encoder requires sortBy/sortOrder to be numbers, so default
  // them to valid enum values when not provided.
  const opts: GetAllOptions = {
    sortBy: SortOption.NAME,
    sortOrder: Order.ASCENDING,
    ...options,
  };
  return contactsManager().getAll(opts, batchSize, onlyMainData);
}

/**
 * Search contacts.
 * @param params    - { sortBy, sortOrder, sortLanguage, filterValue, filterOption, filterBy, onlyMainData }
 * @param batchSize - number of results per batch
 */
export async function find(
  params: FindOptions,
  batchSize = 0,
): Promise<ContactCursor> {
  await ensureContacts();
  return contactsManager().find(params, batchSize);
}

/**
 * Get a single contact by ID.
 * @param id           - the contact id
 * @param onlyMainData - if truthy, only return the main data
 */
export async function get(
  id: string,
  onlyMainData = false,
): Promise<Contact> {
  await ensureContacts();
  return contactsManager().get(id, onlyMainData);
}

/**
 * Add one or more contacts.
 * @param contacts - the contacts to add (remote shape)
 */
export async function add(contacts: Contact[]): Promise<unknown> {
  await ensureContacts();
  return contactsManager().add(contacts);
}

/**
 * Update one or more contacts.
 * @param contacts - the contacts to update (remote shape)
 */
export async function update(contacts: Contact[]): Promise<unknown> {
  await ensureContacts();
  return contactsManager().update(contacts);
}

/**
 * Remove contacts by id.
 * @param contactIds - array of contact ids
 */
export async function remove(contactIds: string[]): Promise<unknown> {
  await ensureContacts();
  return contactsManager().remove(contactIds);
}

/**
 * Get the total number of contacts.
 */
export async function getCount(): Promise<number> {
  await ensureContacts();
  return contactsManager().getCount();
}

/**
 * Get all contact groups.
 */
export async function getAllGroups(): Promise<ContactGroup[]> {
  await ensureContacts();
  return contactsManager().getAllGroups();
}

/**
 * Get all blocked numbers.
 */
export async function getAllBlockedNumbers(): Promise<string[]> {
  await ensureContacts();
  return contactsManager().getAllBlockedNumbers();
}

/**
 * Get all ICE (In Case of Emergency) entries.
 */
export async function getAllICE(): Promise<IceEntry[]> {
  await ensureContacts();
  return contactsManager().getAllIce();
}

/**
 * Get all speed dials.
 */
export async function getSpeedDials(): Promise<SpeedDial[]> {
  await ensureContacts();
  return contactsManager().getSpeedDials();
}

/**
 * Get the contact ids that belong to a group.
 * @param groupId - the group id
 */
export async function getContactIdsFromGroup(groupId: string): Promise<string[]> {
  await ensureContacts();
  return contactsManager().getContactidsFromGroup(groupId);
}

/**
 * Import a vCard (VCF) string.
 * @param vcf - the vCard data
 */
export async function importVcf(vcf: string): Promise<number> {
  await ensureContacts();
  return contactsManager().importVcf(vcf);
}

/**
 * Check whether a value matches a filter.
 * @param filterByOption - one of the FilterByOption values
 * @param filter         - one of the FilterOption values
 * @param value          - the value to match
 */
export async function matches(
  filterByOption: FilterByOption,
  filter: FilterOption,
  value: string,
): Promise<boolean> {
  await ensureContacts();
  return contactsManager().matches(filterByOption, filter, value);
}

/**
 * Subscribe to a contact event.
 * @param event - one of the ContactEvent values
 * @param callback - called when the event fires
 * @returns a function to unsubscribe
 */
export async function addEventListener(
  event: ContactEvent,
  callback: (event: any) => void,
): Promise<() => void> {
  await ensureContacts();
  const manager = contactsManager();
  manager.addEventListener(event, callback);
  return () => manager.removeEventListener(event, callback);
}

