/**
 * Audio volume module for the Wallace library.
 *
 * Provides volume up/down/show and volume-change observation. This module is
 * fully self-contained for tree-shaking: importing it pulls in the generic
 * session + service helpers, but never settings (or any other service) code.
 */
import { ensureService } from "./service";
import { DAEMON_ORIGIN } from "./session";

/** The event name fired when the audio volume changes. */
export const AUDIO_VOLUME_CHANGED_EVENT = "audiovolumechange";

/** Ensure the audio volume service is ready and return its manager. */
function ensureAudioVolume(): Promise<any> {
  return ensureService(
    "audiovolume",
    `${DAEMON_ORIGIN}/audiovolumemanager/service.js`,
    (session) =>
      (window as any).lib_audiovolume.AudioVolumeManager.get(session),
  ).then((manager) => {
    (navigator as any).b2g.__audioVolumeManager = manager;
    return manager;
  });
}

/** The audio volume manager handle (from lib_audiovolume.AudioVolumeManager.get). */
function audioVolumeManager(): any {
  return (navigator as any).b2g.__audioVolumeManager;
}

/**
 * Ensure the audio volume service is ready.
 */
export async function ready(): Promise<void> {
  await ensureAudioVolume();
}

/**
 * Request the system to show the volume UI.
 */
export async function requestVolumeShow(): Promise<void> {
  await ensureAudioVolume();
  await audioVolumeManager().requestVolumeShow();
}

/**
 * Request the system to increase the volume.
 */
export async function requestVolumeUp(): Promise<void> {
  await ensureAudioVolume();
  await audioVolumeManager().requestVolumeUp();
}

/**
 * Request the system to decrease the volume.
 */
export async function requestVolumeDown(): Promise<void> {
  await ensureAudioVolume();
  await audioVolumeManager().requestVolumeDown();
}

/**
 * Subscribe to audio volume changes.
 * @param callback - called when the volume changes
 * @returns a function to unsubscribe
 */
export async function observeVolumeChanged(
  callback: (event: any) => void,
): Promise<() => void> {
  await ensureAudioVolume();
  const manager = audioVolumeManager();
  manager.addEventListener(AUDIO_VOLUME_CHANGED_EVENT, callback);
  return () => {
    manager.removeEventListener(AUDIO_VOLUME_CHANGED_EVENT, callback);
  };
}
