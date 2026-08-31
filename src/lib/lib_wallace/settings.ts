/**
 * Settings module for the Wallace library.
 *
 * Provides read / write / observe access to the daemon's settings store.
 * This module is fully self-contained for tree-shaking: importing it pulls
 * in the generic session + service helpers, but never audio volume (or any
 * other service) code.
 */
import { ensureService } from "./service";
import { DAEMON_ORIGIN } from "./session";

/** A single setting entry as expected by the daemon. */
export interface SettingEntry {
  name: string;
  value: any;
}

// ---------------------------------------------------------------------------
// Service initialization (settings-specific)
// ---------------------------------------------------------------------------

/** Ensure the settings service is ready and return its manager. */
function ensureSettings(): Promise<any> {
  return ensureService(
    "settings",
    `${DAEMON_ORIGIN}/settings/service.js`,
    (session) => (window as any).lib_settings.SettingsManager.get(session),
  ).then((manager) => {
    (navigator as any).b2g.__settingsManager = manager;
    return manager;
  });
}

/** The settings manager handle (from lib_settings.SettingsManager.get). */
function settingsManager(): any {
  return (navigator as any).b2g.__settingsManager;
}

// ---------------------------------------------------------------------------
// Observer wrapper (settings-specific, replaces shared.localhost's
// SettingsObserver)
// ---------------------------------------------------------------------------

interface ObserverEntry {
  name: string;
  callback: (value: any, name: string) => void;
}

let observerInstance: any = null;
const observerEntries: ObserverEntry[] = [];

/** Create (once) a SettingObserverBase that fans out to registered entries. */
function ensureObserver(): any {
  if (observerInstance) {
    return observerInstance;
  }
  const manager = settingsManager();
  if (!manager) {
    return null;
  }
  class Observer extends (window as any).lib_settings.SettingObserverBase {
    constructor(id: any, session: any) {
      super(id.id, session);
    }
    callback(value: any, name: string) {
      for (const entry of observerEntries) {
        if (entry.name === name) {
          entry.callback(value, name);
        }
      }
      return Promise.resolve();
    }
  }
  observerInstance = new Observer(manager, (window as any).__session);
  return observerInstance;
}

/** The settings observer wrapper (getValue/setValue/getBatch/observe/unobserve). */
function settingsObserver(): any {
  return {
    getValue(key: string): Promise<any> {
      return settingsManager().get(key).then(
        (res: any) => res?.value,
        () => undefined,
      );
    },
    getBatch(keys: string[]): Promise<any[]> {
      return settingsManager().getBatch(keys);
    },
    setValue(entries: { name: string; value: any }[]): Promise<any> {
      return settingsManager().set(entries);
    },
    observe(
      name: string,
      defaultValue: any,
      callback: (value: any, name: string) => void,
      observeOnly?: boolean,
    ) {
      const manager = settingsManager();
      if (!observeOnly) {
        this.getValue(name).then(
          (value: any) =>
            callback(value === undefined ? defaultValue : value, name),
          () => callback(defaultValue, name),
        );
      }
      if (
        !observerEntries.find((e) => e.name === name && e.callback === callback)
      ) {
        observerEntries.push({ name, callback });
      }
      const observer = ensureObserver();
      if (observer) {
        manager.addObserver(name, observer);
      }
    },
    unobserve(name: string, callback: (value: any, name: string) => void) {
      const idx = observerEntries.findIndex(
        (e) => e.name === name && e.callback === callback,
      );
      if (idx >= 0) {
        observerEntries.splice(idx, 1);
      }
      if (!observerEntries.find((e) => e.name === name)) {
        settingsManager()?.removeObserver(name, ensureObserver());
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Turn a boolean setting ON (true).
 * @param key - e.g. "airplaneMode.status"
 */
export async function turnOn(key: string): Promise<boolean> {
  return setBoolean(key, true);
}

/**
 * Turn a boolean setting OFF (false).
 * @param key - e.g. "bluetooth.enabled"
 */
export async function turnOff(key: string): Promise<boolean> {
  return setBoolean(key, false);
}

/**
 * Toggle a boolean setting to the opposite of its current value.
 * @param key - the settings key
 * @returns the new value
 */
export async function toggle(key: string): Promise<boolean> {
  const current = await getBoolean(key);
  const next = !current;
  await setBoolean(key, next);
  return next;
}

/**
 * Set a boolean setting to a specific value.
 * @param key - the settings key
 * @param value - true or false
 */
export async function setBoolean(key: string, value: boolean): Promise<boolean> {
  if (typeof value !== "boolean") {
    throw new Error(`setBoolean expects a boolean, got ${typeof value}`);
  }
  await ensureSettings();
  const observer = settingsObserver();
  try {
    await observer.setValue([{ name: key, value }]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the current boolean value of a setting.
 * @param key - the settings key
 * @returns the value (defaults to false)
 */
export async function getBoolean(key: string): Promise<boolean> {
  const value = await getRaw(key);
  return value === true || value === 1 || value === "true";
}

/**
 * Read the raw value of a setting.
 * @param key - the settings key
 */
export async function getRaw(key: string): Promise<any> {
  await ensureSettings();
  return settingsObserver().getValue(key);
}

/**
 * Read multiple settings in one batch call.
 * @param keys - list of setting keys
 * @returns a map of key -> value
 */
export async function getBatch(keys: string[]): Promise<Record<string, any>> {
  await ensureSettings();
  const resultList = await settingsObserver().getBatch(keys);
  const out: Record<string, any> = {};
  for (const entry of resultList) {
    out[entry.name] = entry.value;
  }
  return out;
}

/**
 * Set multiple settings in one call.
 * @param entries - array of { name, value }
 */
export async function setBatch(entries: SettingEntry[]): Promise<void> {
  await ensureSettings();
  await settingsObserver().setValue(entries);
}

/**
 * Watch a setting and react to changes (including changes made by other
 * apps / the system).
 * @param key - the settings key
 * @param callback - called with (value, key) on change
 * @param defaultValue - value to use before the setting is set
 * @returns a function to stop observing
 */
export function observe(
  key: string,
  callback: (value: any, key: string) => void,
  defaultValue?: any,
): () => void {
  ensureSettings().then(() => {
    settingsObserver().observe(key, defaultValue, callback);
  });
  return () => settingsObserver().unobserve(key, callback);
}
