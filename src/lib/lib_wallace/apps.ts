/**
 * Apps module for the Wallace library.
 *
 * Provides access to the daemon's app management service (lib_apps /
 * AppsManager). This module is fully self-contained for tree-shaking:
 * importing it pulls in the generic session + service helpers, but never
 * settings (or any other service) code.
 */
import { ensureService } from "./service";
import { DAEMON_ORIGIN } from "./session";

/** Ensure the apps service is ready and return its manager. */
function ensureApps(): Promise<any> {
  return ensureService(
    "apps",
    `${DAEMON_ORIGIN}/apps/service.js`,
    (session) => (window as any).lib_apps.AppsManager.get(session),
  ).then((manager) => {
    (navigator as any).b2g.__appsManager = manager;
    return manager;
  });
}

/** The apps manager handle (from lib_apps.AppsManager.get). */
function appsManager(): any {
  return (navigator as any).b2g.__appsManager;
}

/**
 * Ensure the apps service is ready.
 */
export async function ready(): Promise<void> {
  await ensureApps();
}

/**
 * Get all installed apps.
 */
export async function getAll(): Promise<any[]> {
  await ensureApps();
  return appsManager().getAll();
}

/**
 * Get a single app by manifest URL.
 * @param manifestURL - the app's manifest URL
 */
export async function getApp(manifestURL: string): Promise<any> {
  await ensureApps();
  return appsManager().getApp(manifestURL);
}

/**
 * Get the current state of the apps service.
 */
export async function getState(): Promise<any> {
  await ensureApps();
  return appsManager().getState();
}

/**
 * Install a packaged app.
 * @param args - install arguments
 */
export async function installPackage(...args: any[]): Promise<any> {
  await ensureApps();
  return appsManager().installPackage(...args);
}

/**
 * Uninstall an app by manifest URL.
 * @param manifestURL - the app's manifest URL
 */
export async function uninstall(manifestURL: string): Promise<any> {
  await ensureApps();
  return appsManager().uninstall(manifestURL);
}

/**
 * Update an app.
 * @param manifestURL - the app's manifest URL
 */
export async function update(manifestURL: string): Promise<any> {
  await ensureApps();
  return appsManager().update(manifestURL);
}

/**
 * Check for an app update.
 * @param manifestURL - the app's manifest URL
 * @param options - { autoInstall?: boolean }
 */
export async function checkForUpdate(
  manifestURL: string,
  options: { autoInstall?: boolean } = {},
): Promise<any> {
  await ensureApps();
  return appsManager().checkForUpdate(manifestURL, options);
}

/**
 * Install a PWA.
 * @param args - install arguments
 */
export async function installPwa(...args: any[]): Promise<any> {
  await ensureApps();
  return appsManager().installPwa(...args);
}

/**
 * Enable or disable an app.
 * @param manifestURL - the app's manifest URL
 * @param enabled - true to enable, false to disable
 */
export async function setEnabled(
  manifestURL: string,
  enabled: boolean,
): Promise<any> {
  await ensureApps();
  return appsManager().setEnabled(manifestURL, enabled);
}

/**
 * Clear an app's data.
 * @param args - clear arguments
 */
export async function clear(...args: any[]): Promise<any> {
  await ensureApps();
  return appsManager().clear(...args);
}

/**
 * Get the update policy.
 */
export async function getUpdatePolicy(): Promise<any> {
  await ensureApps();
  return appsManager().getUpdatePolicy();
}

/**
 * Set the update policy.
 * @param args - policy arguments
 */
export async function setUpdatePolicy(...args: any[]): Promise<any> {
  await ensureApps();
  return appsManager().setUpdatePolicy(...args);
}

/**
 * Cancel an app download.
 * @param manifestURL - the app's manifest URL
 */
export async function cancelDownload(manifestURL: string): Promise<any> {
  await ensureApps();
  return appsManager().cancelDownload(manifestURL);
}

/**
 * App-related event names exposed by the daemon service.
 */
export const enum AppEvent {
  DOWNLOAD_FAILED = "APP_DOWNLOAD_FAILED_EVENT",
  INSTALLED = "APP_INSTALLED_EVENT",
  INSTALLING = "APP_INSTALLING_EVENT",
  UNINSTALLED = "APP_UNINSTALLED_EVENT",
  UPDATE_AVAILABLE = "APP_UPDATE_AVAILABLE_EVENT",
  UPDATED = "APP_UPDATED_EVENT",
  UPDATING = "APP_UPDATING_EVENT",
  STATUS_CHANGED = "APPSTATUS_CHANGED_EVENT",
}

/**
 * Subscribe to an app event.
 * @param event - one of the AppEvent values
 * @param callback - called when the event fires
 * @returns a function to unsubscribe
 */
export async function addEventListener(
  event: AppEvent,
  callback: (event: any) => void,
): Promise<() => void> {
  await ensureApps();
  const manager = appsManager();
  manager.addEventListener(event, callback);
  return () => manager.removeEventListener(event, callback);
}
