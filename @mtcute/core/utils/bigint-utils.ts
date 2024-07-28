import { ICryptoProvider } from "./crypto/abstract.js";
import bigInt, { BigInteger } from "big-integer";

/**
 * Get the minimum number of bits required to represent a number
 */
export function bigIntBitLength(n: BigInteger) {
	return n.bitLength().toJSNumber();
}

/**
 * Convert a big integer to a buffer
 *
 * @param value  Value to convert
 * @param length  Length of the resulting buffer (by default it's the minimum required)
 * @param le  Whether to use little-endian encoding
 */
export function bigIntToBuffer(value: BigInteger, length = 0, le = false): Uint8Array {
	const array = value.toArray(256).value;

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
export function bufferToBigInt(buffer: Uint8Array, le = false): BigInteger {
	const offset = 0;
	const length = buffer.length;
	const arr = [...buffer.subarray(offset, offset + length)];

	if (le) arr.reverse();

	return bigInt.fromArray(arr as unknown as number[], 256);
}

/**
 * Generate a cryptographically safe random big integer of the given size (in bytes)
 * @param size  Size in bytes
 */
export function randomBigInt(crypto: ICryptoProvider, size: number): BigInteger {
	return bufferToBigInt(crypto.randomBytes(size));
}

/**
 * Generate a random big integer of the given size (in bits)
 * @param bits
 */
export function randomBigIntBits(crypto: ICryptoProvider, bits: number): BigInteger {
	let num = randomBigInt(crypto, Math.ceil(bits / 8));

	const bitLength = bigIntBitLength(num);

	if (bitLength > bits) {
		const toTrim = bitLength - bits;
		num = num.shiftRight(toTrim);
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
	max: BigInteger,
	min = bigInt.one
): BigInteger {
	const interval = max.minus(min);
	if (interval.isNegative()) throw new Error("expected min < max");

	const byteSize = Math.ceil(bigIntBitLength(interval) / 8);

	let result = randomBigInt(crypto, byteSize);
	while (result.gt(interval)) result = result.minus(interval);

	return min.plus(result);
}

/**
 * Compute the multiplicity of 2 in the prime factorization of n
 * @param n
 */
export function twoMultiplicity(n: BigInteger): BigInteger {
	if (n.equals(bigInt.zero)) return bigInt.zero;

	let m = bigInt.zero;
	let pow = bigInt.one;

	while (true) {
		if (!n.and(pow).isZero()) return m;
		m = m.plus(bigInt.one);
		pow = pow.shiftLeft(1);
	}
}

export function bigIntMin(a: BigInteger, b: BigInteger): BigInteger {
	return bigInt.min(a, b);
}

export function bigIntAbs(a: BigInteger): BigInteger {
	return a.abs();
}

export function bigIntGcd(a: BigInteger, b: BigInteger): BigInteger {
	return bigInt.gcd(a, b);
}

export function bigIntModPow(base: BigInteger, exp: BigInteger, mod: BigInteger): BigInteger {
	return base.modPow(exp, mod);
}

// below code is based on https://github.com/juanelas/bigint-mod-arith, MIT license

function eGcd(a: BigInteger, b: BigInteger): [BigInteger, BigInteger, BigInteger] {
	let x = bigInt.zero; // 0n
	let y = bigInt.one; // 1n
	let u = bigInt.one; // 1n
	let v = bigInt.zero; // 0n

	while (a.neq(bigInt.zero)) {
		const q = b.divide(a);
		const r: BigInteger = b.mod(a);
		const m = x.minus(u.times(q));
		const n = y.minus(v.times(q)); // y - v * q
		b = a;
		a = r;
		x = u;
		y = v;
		u = m;
		v = n;
	}

	return [b, x, y];
}

function toZn(a: number | BigInteger, n: number | BigInteger): BigInteger {
	if (typeof a === "number") a = bigInt(a);
	if (typeof n === "number") n = bigInt(n);

	if (
		n.leq(bigInt.zero) // n <= 0n
	) {
		throw new RangeError("n must be > 0");
	}

	const aZn = a.mod(n);

	return aZn.lt(bigInt.zero) ? aZn.add(n) : aZn;
}

export function bigIntModInv(a: BigInteger, n: BigInteger): BigInteger {
	const [g, x] = eGcd(toZn(a, n), n);

	if (g.neq(bigInt.one)) {
		throw new RangeError(`${a.toString()} does not have inverse modulo ${n.toString()}`); // modular inverse does not exist
	} else {
		return toZn(x, n);
	}
}
