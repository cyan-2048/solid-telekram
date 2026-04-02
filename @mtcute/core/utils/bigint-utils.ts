import type { ICryptoProvider } from './crypto/abstract.js'
import { u8 } from '@fuman/utils'
import { BigInteger as JSBN } from '@modern-dev/jsbn'
import BigInteger from './bigint/BigInteger.js'

// import { bigint } from '@fuman/utils'

const BIGINT_ZERO = BigInteger.BigInt(0)
// @ts-expect-error check kaios version
// eslint-disable-next-line eqeqeq
const IS_NATIVE = import.meta.env.KAIOS != 2 || typeof BIGINT_ZERO == 'bigint'
const BIGINT_ONE = BigInteger.BigInt(1)

// #region native bigint

function fromBytes_native(buffer: Uint8Array, le = false): BigInteger {
  if (le) buffer = u8.toReversed(buffer)

  const unaligned = buffer.length % 8
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength - unaligned)

  let res = BigInteger.BigInt(0)

  // it is faster to work with 64-bit words than with bytes directly
  for (let i = 0; i < dv.byteLength; i += 8) {
    res = BigInteger.bitwiseOr(
      BigInteger.leftShift(res, BigInteger.BigInt(64)),
      BigInteger.BigInt(dv.getBigUint64(i, false).toString()),
    )
  }

  if (unaligned > 0) {
    for (let i = buffer.length - unaligned; i < buffer.length; i++) {
      res = BigInteger.bitwiseOr(
        BigInteger.leftShift(res, BigInteger.BigInt(8)),
        BigInteger.BigInt(buffer[i]),
      )
    }
  }

  return res
}

function bitLength_native(n: BigInteger): number {
  if (BigInteger.equal(n, BigInteger.BigInt(0))) return 0

  // not the fastest way, but at least not .toString(2) and not too complex
  // taken from: https://stackoverflow.com/a/76616288/22656950

  const i = (n.toString(16).length - 1) * 4

  return i + 32 - Math.clz32(BigInteger.toNumber(BigInteger.signedRightShift(n, BigInteger.BigInt(i))))
}

function toBytes_native(value: BigInteger, length = 0, le = false): Uint8Array {
  const bits = bitLength_native(value)
  const bytes = Math.ceil(bits / 8)

  if (length !== 0 && bytes > length) {
    throw new Error('Value out of bounds')
  }

  if (length === 0) length = bytes

  const buf = new ArrayBuffer(length)
  const u8 = new Uint8Array(buf)

  const unaligned = length % 8
  const dv = new DataView(buf, 0, length - unaligned)

  // it is faster to work with 64-bit words than with bytes directly
  for (let i = 0; i < dv.byteLength; i += 8) {
    const word = BigInteger.bitwiseAnd(value, BigInteger.BigInt('0xFFFFFFFFFFFFFFFF'))
    dv.setBigUint64(i, BigInt(word.toString()), true)
    value = BigInteger.signedRightShift(value, BigInteger.BigInt(64))
  }

  if (unaligned > 0) {
    for (let i = length - unaligned; i < length; i++) {
      const byte = BigInteger.bitwiseAnd(value, BigInteger.BigInt(0xFF))
      u8[i] = BigInteger.toNumber(byte)
      value = BigInteger.signedRightShift(value, BigInteger.BigInt(8))
    }
  }

  if (!le) u8.reverse()

  return u8
}

function modPowBinary_native(base: BigInteger, exp: BigInteger, mod: BigInteger): BigInteger {
  // https://en.wikipedia.org/wiki/Modular_exponentiation#Right-to-left_binary_method

  base = BigInteger.remainder(base, mod)

  let result = BigInteger.BigInt(1)

  while (BigInteger.greaterThan(exp, BigInteger.BigInt(0))) {
    if (BigInteger.equal(BigInteger.remainder(exp, BigInteger.BigInt(2)), BigInteger.BigInt(1))) {
      result = BigInteger.remainder(BigInteger.multiply(result, base), mod)
    }

    exp = BigInteger.signedRightShift(exp, BigInteger.BigInt(1))
    base = BigInteger.remainder(BigInteger.exponentiate(base, BigInteger.BigInt(2)), mod)
  }

  return result
}

function eGcd_native(a: BigInteger, b: BigInteger): [BigInteger, BigInteger, BigInteger] {
  let x = BigInteger.BigInt(0)
  let y = BigInteger.BigInt(1)
  let u = BigInteger.BigInt(1)
  let v = BigInteger.BigInt(0)

  while (BigInteger.notEqual(a, BigInteger.BigInt(0))) {
    const q = BigInteger.divide(b, a)
    const r = BigInteger.remainder(b, a)
    const m = BigInteger.subtract(x, BigInteger.multiply(u, q))
    const n = BigInteger.subtract(y, BigInteger.multiply(v, q))
    b = a
    a = r
    x = u
    y = v
    u = m
    v = n
  }

  return [b, x, y]
}

function toZn_native(a: number | BigInteger, n: number | BigInteger): BigInteger {
  const aN = typeof a === 'number' ? BigInteger.BigInt(a) : a
  const nN = typeof n === 'number' ? BigInteger.BigInt(n) : n

  if (BigInteger.lessThanOrEqual(nN, BigInteger.BigInt(0))) {
    throw new RangeError('n must be > 0')
  }

  const aZn = BigInteger.remainder(aN, nN)

  return BigInteger.lessThan(aZn, BigInteger.BigInt(0)) ? BigInteger.add(aZn, nN) : aZn
}

function modInv_native(a: BigInteger, n: BigInteger): BigInteger {
  const [g, x] = eGcd_native(toZn_native(a, n), n)

  if (BigInteger.notEqual(g, BigInteger.BigInt(1))) {
    throw new RangeError(`${a.toString()} does not have inverse modulo ${n.toString()}`)
  } else {
    return toZn_native(x, n)
  }
}

function abs_native(a: BigInteger): BigInteger {
  return BigInteger.lessThan(a, BigInteger.BigInt(0))
    ? BigInteger.unaryMinus(a)
    : a
}

function euclideanGcd_native(a: BigInteger, b: BigInteger): BigInteger {
  while (BigInteger.notEqual(b, BigInteger.BigInt(0))) {
    const t = b
    b = BigInteger.remainder(a, b)
    a = t
  }

  return a
}

// #endregion

/**
 * Convert a big integer to a buffer
 *
 * @param value  Value to convert
 * @param length  Length of the resulting buffer (by default it's computed automatically)
 * @param le  Whether to use little-endian encoding
 */
export function toBytes(value: BigInteger, length = 0, le = false): Uint8Array {
  if (IS_NATIVE) return toBytes_native(value, length, le)

  const jsbn = BigInteger.toJSBN(value)
  const array = jsbn.toByteArray(false)

  if (length !== 0 && array.length > length) {
    // weird? could this be a bug?
    if (array[0] === 0) array.shift()
    else throw new Error('Value out of bounds')
  }

  if (length !== 0) {
    // padding
    while (array.length !== length) array.unshift(0)
  }

  if (le) array.reverse()

  const buffer = new Uint8Array(length || array.length)
  buffer.set(array, 0)

  return buffer
}

export function bitLength(n: BigInteger): number {
  if (IS_NATIVE) return bitLength_native(n)

  return BigInteger.toJSBN(n).bitLength()
}

export function fromBytes(buffer: Uint8Array, le = false): BigInteger {
  if (IS_NATIVE) return fromBytes_native(buffer, le)

  if (le) buffer = u8.toReversed(buffer)

  // empty
  const bn = new JSBN(null)

  // yes you read that right
  // in the source code
  // when b is set to 256
  // it will loop through an array of numbers
  // it doesn't use any Array methods
  // therefore, TypedArrays should work fine
  bn.fromString(buffer as any, 256, false)

  return BigInteger.BigInt(bn)
}

export function modPowBinary(base: BigInteger, exp: BigInteger, mod: BigInteger): BigInteger {
  if (IS_NATIVE) return modPowBinary_native(base, exp, mod)

  const g = BigInteger.toJSBN(base)
  const a = BigInteger.toJSBN(exp)
  const p = BigInteger.toJSBN(mod)

  return BigInteger.BigInt(g.modPow(a, p))
}

export function modInv(a: BigInteger, n: BigInteger): BigInteger {
  if (IS_NATIVE) return modInv_native(a, n)

  return BigInteger.BigInt(BigInteger.toJSBN(a).modInverse(BigInteger.toJSBN(n)))
}

export function min2(a: BigInteger, b: BigInteger): BigInteger {
  return BigInteger.lessThan(a, b) ? a : b
}

export function abs(a: BigInteger): BigInteger {
  if (IS_NATIVE) return abs_native(a)
  return BigInteger.BigInt(BigInteger.toJSBN(a).abs())
}

/**
 * Compute the multiplicity of 2 in the prime factorization of n
 * @param n
 */
export function twoMultiplicity(n: BigInteger): BigInteger {
  if (BigInteger.equal(n, BIGINT_ZERO)) return BIGINT_ZERO

  let m = BIGINT_ZERO
  let pow = BIGINT_ONE

  while (true) {
    if (BigInteger.notEqual(BigInteger.bitwiseAnd(n, pow), BIGINT_ZERO)) return m
    m = BigInteger.add(m, BIGINT_ONE)
    pow = BigInteger.leftShift(pow, BIGINT_ONE)
  }
}

export function euclideanGcd(a: BigInteger, b: BigInteger): BigInteger {
  if (IS_NATIVE) return euclideanGcd_native(a, b)

  const q = BigInteger.toJSBN(a)
  const n = BigInteger.toJSBN(b)

  return BigInteger.BigInt(q.GCD(n))
}

/**
 * Generate a cryptographically safe random big integer of the given size (in bytes)
 * @param size  Size in bytes
 */
export function randomBigInt(crypto: ICryptoProvider, size: number): BigInteger {
  return fromBytes(crypto.randomBytes(size))
}

/**
 * Generate a random big integer of the given size (in bits)
 * @param bits
 */
export function randomBigIntBits(crypto: ICryptoProvider, bits: number): BigInteger {
  let num = randomBigInt(crypto, Math.ceil(bits / 8))

  const _bitLength = bitLength(num)

  if (_bitLength > bits) {
    const toTrim = _bitLength - bits
    num = BigInteger.signedRightShift(num, BigInteger.BigInt(toTrim))
  }

  return num
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
  min: BigInteger = BIGINT_ONE,
): BigInteger {
  const interval = BigInteger.subtract(max, min)
  if (BigInteger.lessThan(interval, BIGINT_ZERO)) throw new Error('expected min < max')

  const byteSize = Math.ceil(bitLength(interval) / 8)

  let result = randomBigInt(crypto, byteSize)
  while (BigInteger.greaterThan(result, interval)) {
    result = BigInteger.subtract(result, interval)
  }

  return BigInteger.add(min, result)
}
