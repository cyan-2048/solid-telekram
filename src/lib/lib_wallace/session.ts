/**
 * Session management for the Wallace library.
 *
 * Responsible for:
 *   1. Loading the daemon's common session files (127.0.0.1/api/v1/...).
 *   2. Opening the daemon WebSocket session once (generic, reusable).
 *
 * This module is intentionally generic and contains NO service-specific
 * knowledge. Each service (settings, audio volume, ...) lives in its own
 * file and only imports the session + script loader from here. That keeps
 * the library tree-shakeable: importing settings never pulls in audio
 * volume code and vice versa.
 *
 * The daemon files (shared/core.js, shared/session.js) are served by the
 * daemon itself and define lib_session.Session - the real protocol impl.
 */

/** Origin of the daemon that stores settings / manages wifi. */
export const DAEMON_ORIGIN = location.origin.endsWith("8081") ? "http://127.0.0.1:8081/api/v1" : "http://127.0.0.1/api/v1";

/** Daemon files common to ALL services (define lib_session.Session). */
const SESSION_SCRIPTS = [
  `${DAEMON_ORIGIN}/shared/core.js`,
  `${DAEMON_ORIGIN}/shared/session.js`,
];

let sessionPromise: Promise<any> | null = null;

/** Inject a single <script> tag and resolve when it has loaded. */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/** Load a list of scripts sequentially (order matters). */
export function loadScripts(srcs: string[]): Promise<void> {
  return srcs.reduce(
    (chain, src) => chain.then(() => loadScript(src)),
    Promise.resolve(),
  );
}

/**
 * Open the daemon WebSocket session. Generic - not tied to any service.
 * Replicates what shared.localhost's lib_session.js did, but inline.
 */
function openSession(): Promise<any> {
  return new Promise((resolve, reject) => {
    const session = new (window as any).lib_session.Session();
    const callbacks = {
      onsessionconnected: () => {
        (window as any).__session = session;
        resolve(session);
      },
      onsessiondisconnected: () => {
        // Daemon crashed / disconnected.
        (window as any).__session = null;
      },
    };

    try {
      (navigator as any).b2g.externalapi.getToken().then((token: string) => {
        session.open("websocket", "127.0.0.1", token, callbacks, true);
      });
    } catch {
      session.open("websocket", "127.0.0.1", "secrettoken", callbacks, true);
    }
  });
}

/**
 * Ensure the daemon WebSocket session is open. This is the heavy, generic
 * path (loads common daemon files, opens a WebSocket) and is shared by all
 * services. Safe to call multiple times - it only runs once and caches.
 */
export function ensureSession(): Promise<any> {
  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async () => {
    // 1. Load the common daemon session files (the real protocol impl).
    await loadScripts(SESSION_SCRIPTS);

    // 2. Open the WebSocket session.
    return openSession();
  })();

  return sessionPromise;
}

