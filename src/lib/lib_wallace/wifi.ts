/**
 * Wifi module for the Wallace library.
 *
 * Provides wifi enable/disable, scanning, connecting, disconnecting and
 * forgetting networks, with NO dependency on shared.localhost.
 *
 * It uses navigator.b2g.wifiManager directly (via wifi_helpers) and the
 * settings module for the `wifi.enabled` toggle.
 */
import {
  getAvailableAndKnownNetworks,
  getKeyManagement as coreGetKeyManagement,
  isConnected as coreIsConnected,
  isOpen as coreIsOpen,
  isWpsAvailable as coreIsWpsAvailable,
  setPassword,
  wifiManager,
} from "./wifi_helpers";
import { getBoolean, setBoolean } from "./settings";

/** A wifi network as returned by the daemon's wifiManager. */
export interface WifiNetwork {
  ssid: string;
  security?: string;
  capabilities?: string[];
  psk?: string;
  wep?: string;
  wapi_psk?: string;
  eap?: string;
  password?: string;
  identity?: string;
  phase2?: string;
  serverCertificate?: string;
  keyIndex?: number;
  connected?: boolean;
  known?: boolean;
  signalStrength?: number;
  relSignalStrength?: number;
  [key: string]: any;
}

/** Security / key management types understood by the daemon. */
export type KeyManagement =
  | "OPEN"
  | "WEP"
  | "WPA-PSK"
  | "WPA2-PSK"
  | "WPA/WPA2-PSK"
  | "WPA-EAP"
  | "WAPI-PSK"
  | "WAPI-CERT"
  | "SAE"
  | "";

/** Options for connecting to a secured network. */
export interface ConnectOptions {
  password?: string;
  identity?: string;
  eap?: string;
  phase2?: string;
  certificate?: string;
  keyIndex?: number;
}

/** Wrap a DOMRequest-style object into a Promise. */
function requestToPromise<T>(request: any): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enable or disable the wifi radio.
 * @param enabled - true to turn wifi on, false to turn it off
 */
export async function setEnabled(enabled: boolean): Promise<boolean> {
  return setBoolean("wifi.enabled", enabled);
}

/** Whether the wifi radio is currently enabled. */
export async function isEnabled(): Promise<boolean> {
  return getBoolean("wifi.enabled");
}

/**
 * Scan for available + known networks.
 * @returns a list of networks (available and known, de-duplicated)
 */
export async function scan(): Promise<WifiNetwork[]> {
  return getAvailableAndKnownNetworks();
}

/**
 * Get the list of known (saved) networks.
 */
export async function getKnownNetworks(): Promise<WifiNetwork[]> {
  const manager = wifiManager();
  return requestToPromise<WifiNetwork[]>(manager.getKnownNetworks());
}

/**
 * Determine the key management / security type of a network.
 */
export function getKeyManagement(network: WifiNetwork): KeyManagement {
  return coreGetKeyManagement(network) as KeyManagement;
}

/**
 * Whether a network is open (no security).
 */
export function isOpen(network: WifiNetwork): boolean {
  return coreIsOpen(network);
}

/**
 * Whether a network supports WPS.
 */
export function isWpsAvailable(network: WifiNetwork): boolean {
  return coreIsWpsAvailable(network);
}

/**
 * Whether the given network is the currently connected one.
 */
export function isConnected(network: WifiNetwork): boolean {
  return coreIsConnected(network);
}

/**
 * Connect to a wifi network.
 *
 * For secured networks, pass the password (and optionally identity/eap/etc.)
 * in `options`. The network object is mutated with the credentials before
 * being associated, matching the Settings app's behaviour.
 *
 * @param network - the network to connect to (from scan())
 * @param options - credentials for secured networks
 */
export async function connect(
  network: WifiNetwork,
  options: ConnectOptions = {},
): Promise<void> {
  const manager = wifiManager();

  // Apply credentials to the network object based on its security type.
  setPassword(network, options);

  const request = manager.associate(network);
  await requestToPromise<void>(request);
}

/**
 * Forget (remove) a saved network.
 * @param network - the network to forget
 */
export async function forget(network: WifiNetwork): Promise<void> {
  const manager = wifiManager();
  network.keyManagement = getKeyManagement(network);
  const request = manager.forget(network);
  await requestToPromise<void>(request);
}

/** The current connection status ("connected", "connecting", "disconnected"). */
export function connectionStatus(): string {
  const manager = wifiManager();
  return manager?.connection?.status ?? "disconnected";
}

/** The currently connected network, if any. */
export function currentNetwork(): WifiNetwork | null {
  const manager = wifiManager();
  return manager?.connection?.network ?? null;
}

/**
 * Subscribe to wifi status changes.
 * @param event - "enabled" | "disabled" | "statuschange" | "connectioninfoupdate"
 * @param callback - called with the event
 * @returns a function to unsubscribe
 */
export function onStatusChange(
  event: "enabled" | "disabled" | "statuschange" | "connectioninfoupdate",
  callback: (event: any) => void,
): () => void {
  const manager = wifiManager();
  if (!manager) {
    return () => {};
  }
  const handlerName = `on${event}`;
  manager[handlerName] = callback;
  return () => {
    manager[handlerName] = null;
  };
}
