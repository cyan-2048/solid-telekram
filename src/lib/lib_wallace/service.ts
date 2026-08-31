/**
 * Generic daemon service initializer for the Wallace library.
 *
 * A service is a daemon component (settings, audio volume, ...) that:
 *   - has its own daemon service file at `<daemon>/<name>/service.js`
 *   - exposes a manager obtained via a `lib_*.Manager.get(session)` call
 *
 * This helper is service-agnostic. Each concrete service module imports it
 * and supplies its own service file + init function. Keeping the logic here
 * (rather than in session.ts) means services stay independent and the
 * library stays tree-shakeable.
 */
import { ensureSession, loadScript } from "./session";

const servicePromises: Record<string, Promise<any>> = {};

/**
 * Ensure a daemon service is ready: loads its service file and obtains its
 * manager from the shared session. Cached per service.
 *
 * @param name - unique service key (used for the cache)
 * @param file - the daemon service file URL
 * @param init - function that obtains the manager from the session
 */
export function ensureService(
  name: string,
  file: string,
  init: (session: any) => Promise<any>,
): Promise<any> {
  if (Object.prototype.hasOwnProperty.call(servicePromises, name)) {
    return servicePromises[name];
  }

  servicePromises[name] = (async () => {
    const session = await ensureSession();
    // Load this service's own daemon file.
    await loadScript(file);
    // Obtain the manager from the session.
    return init(session);
  })();

  return servicePromises[name];
}
