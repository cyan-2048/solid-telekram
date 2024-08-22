import { bufferToReversed } from "./buffer-utils.js";
import type { ICryptoProvider } from "./crypto/abstract.js";
import { BigInteger } from "jsbn";

const native = typeof BigInt !== "undefined";

/**
 * Get the minimum number of bits required to represent a number
 */
export function bigIntBitLength(n: bigint | BigInteger): number {
    if (native) {
        // not the fastest way, but at least not .toString(2) and not too complex
        // taken from: https://stackoverflow.com/a/76616288/22656950

        const i = (n.toString(16).length - 1) * 4;

        return i + 32 - Math.clz32(Number((n as bigint) >> BigInt(i)));
    }

    return (n as BigInteger).bitLength();
}

/**
 * Convert a big integer to a buffer
 *
 * @param value  Value to convert
 * @param length  Length of the resulting buffer (by default it's the minimum required)
 * @param le  Whether to use little-endian encoding
 */
export function bigIntToBuffer(_value: bigint | BigInteger, length = 0, le = false): Uint8Array {
    if (native) {
        let value = _value as bigint;
        const bits = bigIntBitLength(value);
        const bytes = Math.ceil(bits / 8);

        if (length !== 0 && bytes > length) {
            throw new Error("Value out of bounds");
        }

        if (length === 0) length = bytes;

        const buf = new ArrayBuffer(length);
        const u8 = new Uint8Array(buf);

        const unaligned = length % 8;
        const dv = new DataView(buf, 0, length - unaligned);

        // it is faster to work with 64-bit words than with bytes directly
        for (let i = 0; i < dv.byteLength; i += 8) {
            dv.setBigUint64(i, value & BigInt("0xFFFFFFFFFFFFFFFF"), true);
            value >>= BigInt(64);
        }

        if (unaligned > 0) {
            for (let i = length - unaligned; i < length; i++) {
                u8[i] = Number(value & BigInt("0xff"));
                value >>= BigInt(8);
            }
        }

        if (!le) u8.reverse();

        return u8;
    }

    let value = _value as BigInteger;

    const array = value.toByteArray();

    if (length !== 0 && array.length > length) {
        throw new Error("Value out of bounds");
    }

    if (length !== 0) {
        // padding
        while (array.length !== length) array.unshift(0);
    }

    if (le) array.reverse();

    const buffer = new Uint8Array(length || array.length);
    buffer.set(array, 0);

    return buffer;
}

/**
 * Convert a buffer to a big integer
 *
 * @param buffer  Buffer to convert
 * @param le  Whether to use little-endian encoding
 */
export function bufferToBigInt(buffer: Uint8Array, le = false): bigint | BigInteger {
    if (le) buffer = bufferToReversed(buffer);

    if (native) {
        const unaligned = buffer.length % 8;
        const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength - unaligned);

        let res = BigInt(0);

        // it is faster to work with 64-bit words than with bytes directly
        for (let i = 0; i < dv.byteLength; i += 8) {
            res = (res << BigInt(64)) | BigInt(dv.getBigUint64(i, false));
        }

        if (unaligned > 0) {
            for (let i = buffer.length - unaligned; i < buffer.length; i++) {
                res = (res << BigInt(8)) | BigInt(buffer[i]);
            }
        }

        return res;
    }

    // seems like it does the same thing?
    return new BigInteger(Array.from(buffer));
}

/**
 * Generate a cryptographically safe random big integer of the given size (in bytes)
 * @param size  Size in bytes
 */
export function randomBigInt(crypto: ICryptoProvider, size: number): bigint | BigInteger {
    return bufferToBigInt(crypto.randomBytes(size));
}

/**
 * Generate a random big integer of the given size (in bits)
 * @param bits
 */
export function randomBigIntBits(crypto: ICryptoProvider, bits: number): bigint | BigInteger {
    let num = randomBigInt(crypto, Math.ceil(bits / 8));

    const bitLength = bigIntBitLength(num);

    if (bitLength > bits) {
        const toTrim = bitLength - bits;

        if (native) {
            (num as bigint) >>= BigInt(toTrim);
        } else {
            num = (num as BigInteger).shiftRight(toTrim);
        }
    }

    return num;
}

/**
 * Generate a random big integer in the range [min, max)
 *
 * @param max  Maximum value (exclusive)
 * @param min  Minimum value (inclusive)
 */
export function randomBigIntInRange(
    crypto: ICryptoProvider,
    max: bigint | BigInteger,
    min: BigInteger | bigint = native ? BigInt(1) : BigInteger.ONE
): bigint | BigInteger {
    if (native) {
        const interval = (max as bigint) - (min as bigint);
        if (interval < BigInt(0)) throw new Error("expected min < max");

        const byteSize = Math.ceil(bigIntBitLength(interval) / 8);

        let result = randomBigInt(crypto, byteSize) as bigint;
        while (result > interval) result -= interval;

        return (min as bigint) + result;
    }

    const interval = (max as BigInteger).subtract(min as BigInteger);
    if (interval.compareTo(BigInteger.ZERO) < 0) throw new Error("expected min < max");

    const byteSize = Math.ceil(bigIntBitLength(interval) / 8);

    let result = randomBigInt(crypto, byteSize) as BigInteger;
    while (result.compareTo(interval) > 0) result = result.subtract(interval);

    return (min as BigInteger).add(result);
}

/**
 * Compute the multiplicity of 2 in the prime factorization of n
 * @param n
 */
export function twoMultiplicity(_n: bigint | BigInteger): bigint | BigInteger {
    if (native) {
        const n = _n as bigint;
        if (n === BigInt(0)) return BigInt(0);

        let m = BigInt(0);
        let pow = BigInt(1);

        while (true) {
            if ((n & pow) !== BigInt(0)) return m;
            m += BigInt(1);
            pow <<= BigInt(1);
        }
    }

    const n = _n as BigInteger;

    if (n.equals(BigInteger.ZERO)) return BigInteger.ZERO;

    let m = BigInteger.ZERO;
    let pow = BigInteger.ONE;

    while (true) {
        if (!n.and(pow).equals(BigInteger.ZERO)) return m;

        m = m.add(BigInteger.ONE);
        pow = pow.shiftLeft(1);
    }
}

export function bigIntMin(a: bigint | BigInteger, b: bigint | BigInteger): bigint | BigInteger {
    if (native) {
        return a < b ? a : b;
    }
    return (a as BigInteger).min(b as BigInteger);
}

export function bigIntAbs(a: bigint | BigInteger): bigint | BigInteger {
    if (native) {
        return (a as bigint) < BigInt(0) ? -a : a;
    }

    return (a as BigInteger).abs();
}

export function bigIntGcd(a: bigint | BigInteger, b: bigint | BigInteger): bigint | BigInteger {
    if (native) {
        // using euclidean algorithm is fast enough on smaller numbers
        // https://en.wikipedia.org/wiki/Euclidean_algorithm#Implementations

        while (b !== BigInt(0)) {
            const t = b;
            b = (a as bigint) % (b as bigint);
            a = t;
        }

        return a;
    }

    return (a as BigInteger).gcd(b as BigInteger);
}

export function bigIntModPow(
    _base: bigint | BigInteger,
    _exp: bigint | BigInteger,
    _mod: bigint | BigInteger
): bigint | BigInteger {
    if (native) {
        let base = _base as bigint;
        let exp = _exp as bigint;
        let mod = _mod as bigint;

        // using the binary method is good enough for our use case
        // https://en.wikipedia.org/wiki/Modular_exponentiation#Right-to-left_binary_method

        base %= mod;

        let result = BigInt(1);

        while (exp > BigInt(0)) {
            if (exp % BigInt(2) === BigInt(1)) {
                result = (result * base) % mod;
            }

            exp >>= BigInt(1);
            base = base ** BigInt(2) % mod;
        }

        return result;
    }

    let base = _base as BigInteger;
    let exp = _exp as BigInteger;
    let mod = _mod as BigInteger;

    return base.modPow(exp, mod);
}

// below code is based on https://github.com/juanelas/bigint-mod-arith, MIT license

function eGcd(a: BigInteger, b: BigInteger): [BigInteger, BigInteger, BigInteger];
function eGcd(a: bigint, b: bigint): [bigint, bigint, bigint];
function eGcd(
    a: bigint | BigInteger,
    b: bigint | BigInteger
): [bigint, bigint, bigint] | [BigInteger, BigInteger, BigInteger] {
    if (native) {
        let x = BigInt(0);
        let y = BigInt(1);
        let u = BigInt(1);
        let v = BigInt(0);

        while (a !== BigInt(0)) {
            const q = (b as bigint) / (a as bigint);
            const r: bigint = (b as bigint) % (a as bigint);
            const m = x - u * q;
            const n = y - v * q;
            b = a;
            a = r;
            x = u;
            y = v;
            u = m;
            v = n;
        }

        return [b as bigint, x, y];
    }

    let x = BigInteger.ZERO; // 0n
    let y = BigInteger.ONE; // 1n
    let u = BigInteger.ONE; // 1n
    let v = BigInteger.ZERO; // 0n

    while (!(a as BigInteger).equals(BigInteger.ZERO)) {
        const q = (b as BigInteger).divide(a as BigInteger);
        const r: BigInteger = (b as BigInteger).remainder(a as BigInteger);
        const m = x.subtract(u.multiply(q));
        const n = y.subtract(v.multiply(q)); // y - v * q
        b = a;
        a = r;
        x = u;
        y = v;
        u = m;
        v = n;
    }

    return [b as BigInteger, x, y];
}
function toZn(a: number | BigInteger, n: number | BigInteger): BigInteger;
function toZn(a: number | bigint, n: number | bigint): bigint;
function toZn(a: number | bigint | BigInteger, n: number | bigint | BigInteger): bigint | BigInteger {
    if (native) {
        if (typeof a === "number") a = BigInt(a);
        if (typeof n === "number") n = BigInt(n);

        if ((n as bigint) <= BigInt(0)) {
            throw new RangeError("n must be > 0");
        }

        const aZn = (a as bigint) % (n as bigint);

        return aZn < BigInt(0) ? aZn + (n as bigint) : aZn;
    }

    if (typeof a === "number") a = new BigInteger(a.toString());
    if (typeof n === "number") n = new BigInteger(n.toString());

    if (
        (n as BigInteger).compareTo(BigInteger.ZERO) <= 0 // n <= 0n
    ) {
        throw new RangeError("n must be > 0");
    }

    const aZn = (a as BigInteger).remainder(n as BigInteger);

    return aZn.compareTo(BigInteger.ZERO) < 0 ? aZn.add(n as BigInteger) : aZn;
}

export function bigIntModInv(a: BigInteger, n: BigInteger): BigInteger;
export function bigIntModInv(a: bigint, n: bigint): bigint;
export function bigIntModInv(a: bigint | BigInteger, n: bigint | BigInteger): bigint | BigInteger {
    if (native) {
        const [g, x] = eGcd(toZn(a as bigint, n as bigint), n as bigint);

        if (g !== BigInt(1)) {
            throw new RangeError(`${a.toString()} does not have inverse modulo ${n.toString()}`); // modular inverse does not exist
        } else {
            return toZn(x as bigint, n as bigint);
        }
    }

    // hmmm
    return (a as BigInteger).modInverse(n as BigInteger);
}
