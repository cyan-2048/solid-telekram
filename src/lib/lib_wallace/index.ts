/**
 * Wallace library.
 *
 * A self-contained TypeScript library for KaiOS 3.0 daemon services, with NO
 * dependency on shared.localhost or the Settings app's own JavaScript files.
 *
 * It talks to the daemon at 127.0.0.1 directly. Each service lives in its
 * own module and is fully tree-shakeable - importing settings never pulls
 * in audio volume code and vice versa.
 *
 * Usage:
 *   import { settings, wifi, audioVolume, apps, contacts, libsignal, time } from "./lib_wallace";
 *
 *   await settings.turnOn("airplaneMode.status");
 *   await wifi.setEnabled(true);
 *   const networks = await wifi.scan();
 *   await audioVolume.requestVolumeUp();
 *   const allApps = await apps.getAll();
 *   const cursor = await contacts.getAll();
 *   const ctx = await libsignal.newGlobalContext();
 *   const now = await time.get();
 */

export * as settings from "./settings";
export * as wifi from "./wifi";
export * as audioVolume from "./audio_volume";
export * as apps from "./apps";
export * as contacts from "./contacts";
export * as libsignal from "./libsignal";
export * as time from "./time";

// Generic infrastructure (session + script loading + service initializer).
export { ensureSession, ensureService, DAEMON_ORIGIN } from "./core";

export type { SettingEntry } from "./settings";
export type {
  WifiNetwork,
  KeyManagement,
  ConnectOptions,
} from "./wifi";
