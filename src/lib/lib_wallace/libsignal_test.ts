/**
 * Integration tests for the libsignal module (lib_wallace/libsignal.ts).
 *
 * These tests run against the REAL daemon (127.0.0.1) - no mocks. The module's
 * ensureService() loads the real libsignal/service.js and opens a real
 * WebSocket session, so every call here exercises the actual daemon.
 *
 * Because real crypto output is unpredictable, we assert on shape, length and
 * round-trip correctness rather than exact values.
 *
 * Run in the Settings app / a KaiOS webview where the daemon is reachable.
 * Load this file as a module after libsignal.ts.
 */
import * as libsignal from "./libsignal";

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];
const pending: Promise<void>[] = [];

function assert(cond: unknown, msg: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
  }
}

function assertEq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

function assertEqLen(arr: Uint8Array, len: number, msg: string): void {
  if (arr instanceof Uint8Array && arr.length === len) {
    passed++;
  } else {
    failed++;
    failures.push(`${msg}: expected length ${len}, got ${arr?.length}`);
  }
}

/** Stringify an error (which may be a plain object) for readable output. */
function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/** Optional verbose logging for diagnosing daemon round-trips. */
const VERBOSE = true;
function log(...args: unknown[]): void {
  if (VERBOSE) console.log("  [diag]", ...args);
}

function test(name: string, fn: () => void | Promise<void>): void {
  const result = fn();
  if (result && typeof (result as Promise<void>).then === "function") {
    const p = (result as Promise<void>).then(
      () => console.log(`  ✓ ${name}`),
      (err) => {
        failed++;
        failures.push(`${name}: ${errText(err)}`);
        console.log(`  ✗ ${name}: ${errText(err)}`);
      },
    );
    pending.push(p);
  } else {
    console.log(`  ✓ ${name}`);
  }
}

function report(): void {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  if (typeof process !== "undefined") {
    process.exit(failed ? 1 : 0);
  }
}

// Wait for every async test to settle, then report.
Promise.all(pending).then(() => report());

// ---------------------------------------------------------------------------
// In-memory store implementations (backed by real *StoreBase classes)
// ---------------------------------------------------------------------------

/** A simple in-memory key/value store used by the real store base classes. */
function makeMemoryStore() {
  const map = new Map<string, Uint8Array>();
  return {
    get: (k: string) => map.get(k),
    set: (k: string, v: Uint8Array) => {
      map.set(k, v);
    },
    has: (k: string) => map.has(k),
    delete: (k: string) => map.delete(k),
  };
}

/** Build a full StoreContext backed by real daemon store objects. */
function makeStoreContext(opts?: {
  identityKeyPair?: libsignal.KeyPair;
  preKeys?: libsignal.PreKey[];
  signedPreKey?: libsignal.SignedPreKey;
}): libsignal.StoreContext {
  const sessionStore = makeMemoryStore();
  const preKeyStore = makeMemoryStore();
  const signedPreKeyStore = makeMemoryStore();
  const identityStore = makeMemoryStore();
  const senderKeyStore = makeMemoryStore();

  // Pre-populate the stores so the daemon can read them back.
  if (opts?.identityKeyPair) {
    const kp = opts.identityKeyPair;
    const raw = new Uint8Array(64);
    raw.set(kp.publicKey, 0);
    raw.set(kp.privateKey, 32);
    identityStore.set("keypair", raw);
  }
  for (const pk of opts?.preKeys ?? []) {
    const raw = new Uint8Array(64);
    raw.set(pk.keyPair.publicKey, 0);
    raw.set(pk.keyPair.privateKey, 32);
    preKeyStore.set(String(pk.id), raw);
  }
  if (opts?.signedPreKey) {
    const spk = opts.signedPreKey;
    const raw = new Uint8Array(64);
    raw.set(spk.keyPair.publicKey, 0);
    raw.set(spk.keyPair.privateKey, 32);
    signedPreKeyStore.set(String(spk.id), raw);
  }

  const identityKeyStore = libsignal.trackStore(
    libsignal.IdentityKeyStoreBase(),
    {
      getKeyPair: async () => {
        log("identity.getKeyPair");
        const raw = identityStore.get("keypair");
        if (raw) {
          return { publicKey: raw.slice(0, 32), privateKey: raw.slice(32) };
        }
        throw new Error("identity keypair not set");
      },
      getLocalRegistrationId: async () => {
        log("identity.getLocalRegistrationId");
        return 12345;
      },
      isTrustedIdentity: async (address: libsignal.SignalAddress, keyData: Uint8Array) => {
        log("identity.isTrustedIdentity", address, keyData.length);
        return true;
      },
      saveIdentity: async (address: libsignal.SignalAddress, keyData: Uint8Array) => {
        log("identity.saveIdentity", address, keyData.length);
        identityStore.set("remote", keyData);
      },
    },
  );

  const sessionStoreObj = libsignal.trackStore(libsignal.SessionStoreBase(), {
    contains: async (address: libsignal.SignalAddress) => {
      log("session.contains", address);
      return sessionStore.has(`${address.name}:${address.deviceId}`);
    },
    delete: async (address: libsignal.SignalAddress) => {
      log("session.delete", address);
      return sessionStore.delete(`${address.name}:${address.deviceId}`);
    },
    deleteAllSessions: async () => {
      log("session.deleteAllSessions");
      return 0;
    },
    getSubDeviceSessions: async () => {
      log("session.getSubDeviceSessions");
      return [];
    },
    load: async (address: libsignal.SignalAddress) => {
      log("session.load", address);
      // The daemon's SessionStoreBase.load callback encodes the result with
      // u8_array() unconditionally, so it MUST return a Uint8Array. An empty
      // array signals "no session yet" so ProcessPreKeyBundle creates one.
      return sessionStore.get(`${address.name}:${address.deviceId}`) ?? new Uint8Array(0);
    },
    store: async (address: libsignal.SignalAddress, record: Uint8Array) => {
      log("session.store", address, record.length);
      sessionStore.set(`${address.name}:${address.deviceId}`, record);
    },
  });

  const preKeyStoreObj = libsignal.trackStore(libsignal.KeyStoreBase(), {
    contains: async (id: number) => {
      log("preKey.contains", id);
      return preKeyStore.has(String(id));
    },
    load: async (id: number) => {
      log("preKey.load", id);
      return preKeyStore.get(String(id)) ?? new Uint8Array(0);
    },
    remove: async (id: number) => {
      log("preKey.remove", id);
      preKeyStore.delete(String(id));
    },
  });

  const signedPreKeyStoreObj = libsignal.trackStore(libsignal.KeyStoreBase(), {
    contains: async (id: number) => {
      log("signedPreKey.contains", id);
      return signedPreKeyStore.has(String(id));
    },
    load: async (id: number) => {
      log("signedPreKey.load", id);
      return signedPreKeyStore.get(String(id)) ?? new Uint8Array(0);
    },
    remove: async (id: number) => {
      log("signedPreKey.remove", id);
      signedPreKeyStore.delete(String(id));
    },
  });

  const senderKeyStoreObj = libsignal.trackStore(libsignal.SenderKeyStoreBase(), {
    load: async (name: libsignal.SenderKeyName) => {
      log("senderKey.load", name);
      return senderKeyStore.get(`${name.groupId}:${name.sender.name}`) ?? new Uint8Array(0);
    },
    store: async (name: libsignal.SenderKeyName, record: Uint8Array) => {
      log("senderKey.store", name, record.length);
      senderKeyStore.set(`${name.groupId}:${name.sender.name}`, record);
      return true;
    },
  });

  return {
    sessionStore: sessionStoreObj,
    preKeyStore: preKeyStoreObj,
    signedPreKeyStore: signedPreKeyStoreObj,
    identityKeyStore,
    senderKeyStore: senderKeyStoreObj,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log("libsignal integration tests (real daemon)");

// --- service / context ---
test("ready resolves", async () => {
  await libsignal.ready();
  assert(true, "ready resolves");
});

test("newGlobalContext returns a context", async () => {
  const ctx = await libsignal.newGlobalContext();
  assert(ctx && typeof ctx === "object", "context is an object");
  assert(
    typeof ctx.generateIdentityKeyPair === "function" &&
      typeof ctx.generatePreKeys === "function" &&
      typeof ctx.sessionCipher === "function",
    "context exposes key-generation and cipher methods",
  );
});

// --- key generation ---
test("generateIdentityKeyPair returns 32-byte keys", async () => {
  const ctx = await libsignal.newGlobalContext();
  const kp = await libsignal.generateIdentityKeyPair(ctx);
  assert(kp.publicKey instanceof Uint8Array, "publicKey is Uint8Array");
  assert(kp.privateKey instanceof Uint8Array, "privateKey is Uint8Array");
  assertEqLen(kp.publicKey, 32, "publicKey length");
  assertEqLen(kp.privateKey, 32, "privateKey length");
});

test("generatePreKeys returns the requested count", async () => {
  const ctx = await libsignal.newGlobalContext();
  const keys = await libsignal.generatePreKeys(ctx, 100, 5);
  assert(Array.isArray(keys), "returns an array");
  assertEq(keys.length, 5, "count");
  assertEq(keys[0].id, 100, "start id");
  assertEq(keys[4].id, 104, "last id");
  assertEqLen(keys[0].keyPair.publicKey, 32, "prekey publicKey length");
});

test("generateRegistrationId returns a number", async () => {
  const ctx = await libsignal.newGlobalContext();
  const id = await libsignal.generateRegistrationId(ctx, true);
  assert(typeof id === "number" && id > 0, "registration id is a positive number");
});

test("generateSenderKey / generateSenderKeyId", async () => {
  const ctx = await libsignal.newGlobalContext();
  const key = await libsignal.generateSenderKey(ctx);
  const id = await libsignal.generateSenderKeyId(ctx);
  assert(key instanceof Uint8Array && key.length > 0, "sender key is non-empty");
  assert(typeof id === "number", "sender key id is a number");
});

test("generateSenderSigningKey returns 32-byte keys", async () => {
  const ctx = await libsignal.newGlobalContext();
  const kp = await libsignal.generateSenderSigningKey(ctx);
  assertEqLen(kp.publicKey, 32, "publicKey length");
  assertEqLen(kp.privateKey, 32, "privateKey length");
});

test("generateSignedPreKey returns a signed prekey", async () => {
  const ctx = await libsignal.newGlobalContext();
  const identity = await libsignal.generateIdentityKeyPair(ctx);
  const spk = await libsignal.generateSignedPreKey(ctx, identity, 1, Date.now());
  assert(typeof spk.id === "number", "has an id");
  assertEqLen(spk.keyPair.publicKey, 32, "publicKey length");
  assert(spk.signature instanceof Uint8Array && spk.signature.length > 0, "has a signature");
});

// --- digests ---
test("HMAC-SHA256 produces a 32-byte digest", async () => {
  const digest = await libsignal.startHmacSha256(new Uint8Array(32).fill(1));
  await libsignal.digestUpdate(digest, new TextEncoder().encode("hello"));
  const out = await libsignal.digestFinalize(digest);
  assertEqLen(out, 32, "hmac length");
});

test("SHA-512 produces a 64-byte digest", async () => {
  const digest = await libsignal.startSha512Digest();
  await libsignal.digestUpdate(digest, new TextEncoder().encode("hello"));
  const out = await libsignal.digestFinalize(digest);
  assertEqLen(out, 64, "sha512 length");
});

// --- curve ---
test("curveCalculateAgreement is symmetric", async () => {
  const ctx = await libsignal.newGlobalContext();
  const a = await libsignal.generateIdentityKeyPair(ctx);
  const b = await libsignal.generateIdentityKeyPair(ctx);
  const ab = await libsignal.curveCalculateAgreement(b.publicKey, a.privateKey);
  const ba = await libsignal.curveCalculateAgreement(a.publicKey, b.privateKey);
  assert(ab instanceof Uint8Array, "agreement is Uint8Array");
  assertEqLen(ab, 32, "agreement length");
  assertEq(Array.from(ab), Array.from(ba), "agreement is symmetric");
});

test("curveVerifySignature returns a boolean", async () => {
  const ok = await libsignal.curveVerifySignature(
    new Uint8Array(32).fill(1),
    new TextEncoder().encode("msg"),
    new Uint8Array(64).fill(2),
  );
  assert(typeof ok === "boolean", "verify returns a boolean");
});

// --- session round-trip (the real Signal flow) ---
// Signal flow: the INITIATOR (A) processes the RECIPIENT's (B's) pre-key
// bundle to establish a session, then encrypts to B; B decrypts.
test("session round-trip: A encrypts, B decrypts", async () => {
  const ctxA = await libsignal.newGlobalContext();
  const ctxB = await libsignal.newGlobalContext();

  // B (recipient) publishes identity + prekeys.
  const identityB = await libsignal.generateIdentityKeyPair(ctxB);
  const preKeysB = await libsignal.generatePreKeys(ctxB, 1, 1);
  const signedPreKeyB = await libsignal.generateSignedPreKey(ctxB, identityB, 1, Date.now());
  const regIdB = await libsignal.generateRegistrationId(ctxB, true);

  // A (initiator) also needs its own identity for the session.
  const identityA = await libsignal.generateIdentityKeyPair(ctxA);

  // Build stores pre-populated with each side's own keys.
  const storeA = makeStoreContext({ identityKeyPair: identityA });
  const storeB = makeStoreContext({
    identityKeyPair: identityB,
    preKeys: preKeysB,
    signedPreKey: signedPreKeyB,
  });

  // Build B's pre-key bundle and process it on A (the initiator).
  const bundle: libsignal.PreKeyBundle = {
    registrationId: regIdB,
    deviceId: 1,
    preKeyId: preKeysB[0].id,
    preKeyPublic: preKeysB[0].keyPair.publicKey,
    signedPreKeyId: signedPreKeyB.id,
    signedPreKeyPublic: signedPreKeyB.keyPair.publicKey,
    signedPreKeySignature: signedPreKeyB.signature,
    identityKey: identityB.publicKey,
  };

  const builderA = await libsignal.sessionBuilder(ctxA, { name: "bob", deviceId: 1 }, storeA);
  log("processing pre-key bundle on A");
  await libsignal.processPreKeyBundle(builderA, bundle);
  log("pre-key bundle processed");

  // A encrypts a message to B.
  // NOTE: the daemon's SessionCipherRequest encoder reads e.callback.id
  // unconditionally, so sessionCipher REQUIRES a callback function (the
  // daemon wraps it into a tracked DecryptionCallbackBase).
  const cipherA = await libsignal.sessionCipher(
    ctxA,
    { name: "bob", deviceId: 1 },
    storeA,
    async () => {},
  );
  const padded = new TextEncoder().encode("hello signal");
  log("A encrypting");
  const ct = await libsignal.sessionEncrypt(cipherA, padded);
  log("A encrypted", ct.serialized.length, "bytes");
  assert(ct.serialized instanceof Uint8Array && ct.serialized.length > 0, "ciphertext non-empty");

  // B decrypts the message from A.
  // A's first message is a PRE-KEY message (messageType 1) because it was
  // sent right after A processed B's pre-key bundle, so B must use
  // decryptPreKeyMessage (not decryptMessage).
  const cipherB = await libsignal.sessionCipher(
    ctxB,
    { name: "alice", deviceId: 1 },
    storeB,
    async () => {},
  );
  log("B decrypting (pre-key message)");
  const plain = await libsignal.sessionDecryptPreKeyMessage(cipherB, ct.serialized);
  log("B decrypted", plain.length, "bytes");
  assertEq(Array.from(plain), Array.from(padded), "round-trip plaintext matches");
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

// Wait for every async test to settle, then report.
Promise.all(pending).then(() => report());
