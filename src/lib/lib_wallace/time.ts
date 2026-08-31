/**
 * Time module for the Wallace library.
 *
 * Provides access to the daemon's time service (lib_time / TimeService).
 * This module is fully self-contained for tree-shaking: importing it pulls
 * in the generic session + service helpers, but never settings (or any other
 * service) code.
 */
import { ensureService } from "./service";
import { DAEMON_ORIGIN } from "./session";

// ---------------------------------------------------------------------------
// Types (mirror lib_time)
// ---------------------------------------------------------------------------

/** Reasons a time observer can be registered for. */
export const enum CallbackReason {
  NONE = 0,
  TIME_CHANGED = 1,
  TIMEZONE_CHANGED = 2,
}

/** The payload delivered to a time observer callback. */
export interface TimeChangeEvent {
  reason: CallbackReason;
  timezone: string;
  delta: number;
}

/** A time observer callback (from TimeObserverBase). */
export type TimeObserverCallback = (event: TimeChangeEvent) => Promise<void>;

/** The time service manager (from lib_time.TimeService.get). */
export interface TimeService {
  get(): Promise<Date>;
  set(time: Date): Promise<void>;
  getElapsedRealTime(): Promise<number>;
  setTimezone(timezone: string): Promise<void>;
  addObserver(
    reason: CallbackReason,
    observer: TimeObserverCallback,
  ): Promise<void>;
  removeObserver(
    reason: CallbackReason,
    observer: TimeObserverCallback,
  ): Promise<void>;
  addEventListener(event: number, callback: (event: any) => void): void;
  removeEventListener(event: number, callback: (event: any) => void): void;
}

// ---------------------------------------------------------------------------
// Service initialization (time-specific)
// ---------------------------------------------------------------------------

/** Ensure the time service is ready and return its manager. */
function ensureTime(): Promise<TimeService> {
  return ensureService(
    "time",
    `${DAEMON_ORIGIN}/time/service.js`,
    (session) => (window as any).lib_time.TimeService.get(session),
  ).then((manager) => {
    (navigator as any).b2g.__timeService = manager;
    return manager;
  });
}

/** The time service manager handle (from lib_time.TimeService.get). */
function timeService(): TimeService {
  return (navigator as any).b2g.__timeService;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ensure the time service is ready.
 */
export async function ready(): Promise<void> {
  await ensureTime();
}

/**
 * Get the current system time.
 */
export async function get(): Promise<Date> {
  await ensureTime();
  return timeService().get();
}

/**
 * Set the system time.
 * @param time - the new time
 */
export async function set(time: Date): Promise<void> {
  await ensureTime();
  return timeService().set(time);
}

/**
 * Get the elapsed real time (monotonic, in ms).
 */
export async function getElapsedRealTime(): Promise<number> {
  await ensureTime();
  return timeService().getElapsedRealTime();
}

/**
 * Set the system timezone.
 * @param timezone - the IANA timezone id, e.g. "America/New_York"
 */
export async function setTimezone(timezone: string): Promise<void> {
  await ensureTime();
  return timeService().setTimezone(timezone);
}

/**
 * Subscribe to time / timezone change events.
 * @param reason   - one of the CallbackReason values
 * @param callback - called when the event fires
 * @returns a function to unsubscribe
 */
export async function observe(
  reason: CallbackReason,
  callback: TimeObserverCallback,
): Promise<() => void> {
  await ensureTime();
  const service = timeService();
  await service.addObserver(reason, callback);
  return () => {
    service.removeObserver(reason, callback);
  };
}

/**
 * Subscribe to the time-changed event.
 * @param callback - called when the time changes
 * @returns a function to unsubscribe
 */
export async function observeTimeChanged(
  callback: TimeObserverCallback,
): Promise<() => void> {
  return observe(CallbackReason.TIME_CHANGED, callback);
}

/**
 * Subscribe to the timezone-changed event.
 * @param callback - called when the timezone changes
 * @returns a function to unsubscribe
 */
export async function observeTimezoneChanged(
  callback: TimeObserverCallback,
): Promise<() => void> {
  return observe(CallbackReason.TIMEZONE_CHANGED, callback);
}
