/**
 * Wifi helpers for the KaiOS 3.0 settings library.
 *
 * Replaces shared.localhost's WifiHelper. Pure logic for inspecting and
 * connecting to wifi networks via navigator.b2g.wifiManager.
 */

/** The raw wifiManager (navigator.b2g.wifiManager). */
export function wifiManager(): any {
  return (navigator as any).b2g?.wifiManager;
}

/** Get the security string of a network. */
export function getSecurity(network: any): string {
  return network.security;
}

/** Determine the key management / security type of a network. */
export function getKeyManagement(network: any): string {
  const security = getSecurity(network) || "";
  if (/OPEN$/u.test(security)) return "OPEN";
  if (/WEP$/u.test(security)) return "WEP";
  if (/WAPI-PSK$/u.test(security)) return "WAPI-PSK";
  if (/PSK$/u.test(security)) return "WPA-PSK";
  if (/SAE$/u.test(security)) return "SAE";
  if (/EAP$/u.test(security)) return "WPA-EAP";
  if (/WAPI-CERT$/u.test(security)) return "WAPI-CERT";
  return "";
}

/** A stable key for a network (ssid + normalized key management). */
export function getCompositedKey(network: any): string {
  let km = getKeyManagement(network);
  if (km === "WPA-PSK" || km === "WPA2-PSK" || km === "WPA/WPA2-PSK") {
    km = "WPA-PSK";
  }
  return `${network.ssid}+${km}`;
}

/** Whether a network is open (no security). */
export function isOpen(network: any): boolean {
  return getKeyManagement(network) === "";
}

/** Whether a network supports WPS. */
export function isWpsAvailable(network: any): boolean {
  const caps = network.capabilities || [];
  for (const cap of caps) {
    if (/WPS/u.test(cap)) return true;
  }
  return false;
}

/** Whether the given network is the currently connected one. */
export function isConnected(network: any): boolean {
  const manager = wifiManager();
  const current = manager?.connection?.network;
  return (
    !!current &&
    !!network &&
    getCompositedKey(network) === getCompositedKey(current) &&
    current.connected
  );
}

/**
 * Apply credentials to a network object based on its security type.
 * Mirrors shared.localhost's WifiHelper.setPassword.
 */
export function setPassword(
  network: any,
  opts: {
    password?: string;
    identity?: string;
    eap?: string;
    phase2?: string;
    certificate?: string;
    keyIndex?: number;
  },
): void {
  switch (getKeyManagement(network)) {
    case "WPA-PSK":
    case "WPA2-PSK":
    case "WPA/WPA2-PSK":
    case "SAE":
      network.psk = opts.password;
      break;
    case "WAPI-PSK":
      network.wapi_psk = opts.password;
      break;
    case "WPA-EAP":
      network.eap = opts.eap;
      if (opts.password) network.password = opts.password;
      if (opts.identity) network.identity = opts.identity;
      if (opts.phase2 && opts.phase2 !== "No") network.phase2 = opts.phase2;
      if (opts.certificate && opts.certificate !== "none") {
        network.serverCertificate = opts.certificate;
      }
      break;
    case "WEP":
      network.wep = opts.password;
      if (opts.keyIndex !== undefined) network.keyIndex = opts.keyIndex;
      break;
    default:
      break;
  }
}

/**
 * Scan for available + known networks (de-duplicated).
 * Mirrors shared.localhost's WifiHelper.getAvailableAndKnownNetworks.
 */
export function getAvailableAndKnownNetworks(): Promise<any[]> {
  const manager = wifiManager();
  return new Promise((resolve, reject) => {
    const available = manager.getNetworks();
    available.onsuccess = () => {
      const known = manager.getKnownNetworks();
      known.onsuccess = () => {
        resolve(unionOfNetworks(available.result, known.result));
      };
      known.onerror = () => resolve(unionOfNetworks(available.result, []));
    };
    available.onerror = () => reject(available.error);
  });
}

/** Merge available + known networks, preferring the strongest signal. */
function unionOfNetworks(available: any[], known: any[]): any[] {
  const map: Record<string, any> = {};
  for (const n of available || []) {
    map[getCompositedKey(n)] = n;
  }
  for (const n of known || []) {
    const key = getCompositedKey(n);
    if (map[key]) {
      map[key].security = n.security;
      map[key].signalStrength = n.signalStrength;
      map[key].relSignalStrength = n.relSignalStrength;
      map[key] = n;
    } else {
      map[key] = n;
    }
  }
  return Object.keys(map).map((k) => map[k]);
}
