/**
 * Core shared module for the Wallace library.
 *
 * This is a thin re-export facade for the GENERIC infrastructure only:
 *
 *   - ./session  - daemon session (no service-specific knowledge)
 *   - ./service  - generic per-service initializer helper
 *
 * Service-specific modules (settings, audio_volume, wifi) are self-contained
 * and NOT re-exported here - import them from their own files so tree-shaking
 * never pulls in code you don't use.
 */

export { DAEMON_ORIGIN, ensureSession } from "./session";
export { ensureService } from "./service";
