/* eslint-disable ts/no-use-before-define */
/**
 * this is basically JSBI but using JSBN because JSBI is so fucking slow
 */

import { BigInteger as JSBN } from '@modern-dev/jsbn'

/**
 * a < b
 */
function lt(a: JSBN, b: JSBN): boolean {
  return a.compareTo(b) < 0
}

/**
 * a > b
 */
function gt(a: JSBN, b: JSBN): boolean {
  return a.compareTo(b) > 0
}

/**
 * a <= b
 */
function leq(a: JSBN, b: JSBN): boolean {
  return a.compareTo(b) <= 0
}

/**
 * a >= b
 */
function geq(a: JSBN, b: JSBN): boolean {
  return a.compareTo(b) >= 0
}

/**
 * Helper function to quickly create a JSBN from an int
 * @param n
 */
function fromInt(n: number): JSBN {
  const bi = new JSBN(null)

  // this property will be missing if being replaced with native impl
  const DV = bi.DV
  if (DV) {
    if (!(-DV <= n && n < DV)) {
      // if it is outside the range we will use fromRadix
      bi.fromRadix(n.toString(16), 16)
      // console.error("bigint out of bounds ", bi.bitLength());
      return bi
    }
  }

  bi.fromInt(n)
  return bi
}

/**
 * Helper function to quickly create a JSBN from a radix string
 */
export function fromRadix(n: string, radix: number): JSBN {
  const bi = new JSBN(null)
  bi.fromRadix(n, radix)
  return bi
}

function switchRadix(prefix: string) {
  switch (prefix) {
    case '0b':
      return 2
    case '0o':
      return 8
    case '0x':
      return 16
    default:
      return 10
  }
}

// const maxBitLength = new JSBN(null).DB;

function isBigInt(val: any): val is BigInteger {
  return val instanceof BigInteger
}

class BigInteger {
  private value: JSBN

  private constructor(val: number | string | JSBN) {
    if (typeof val == 'object') {
      this.value = val
      return
    }

    if (typeof val == 'number') {
      this.value = fromInt(val)
      return
    }

    const prefix = val.slice(0, 2).toLowerCase()
    const radix = switchRadix(prefix)
    if (radix !== 10) {
      this.value = fromRadix(val.slice(2), radix)
    } else {
      this.value = fromRadix(val, 10)
    }
  }

  static is(val: unknown): val is BigInteger {
    return isBigInt(val)
  }

  /**
   * !!! must clone if using _To() methods
   */
  static toJSBN(n: BigInteger): JSBN {
    return n.value
  }

  static BigInt(val: number | string | BigInteger | JSBN): BigInteger {
    return isBigInt(val) ? val : new BigInteger(val)
  }

  static toNumber(x: BigInteger): number {
    const outOfBounds = x.value.bitLength() >= x.value.DB

    return outOfBounds
      ? Number.parseInt(
          // https://cyan-2048.github.io/bn-benchmark/
          // apparently toString(16) is faster?
          x.value.toString(16),
          16,
        )
      : x.value.intValue()
  }

  static lessThan(x: BigInteger, y: BigInteger): boolean {
    return lt(x.value, y.value)
  }

  static lessThanOrEqual(x: BigInteger, y: BigInteger): boolean {
    return leq(x.value, y.value)
  }

  static greaterThan(x: BigInteger, y: BigInteger): boolean {
    return gt(x.value, y.value)
  }

  static greaterThanOrEqual(x: BigInteger, y: BigInteger): boolean {
    return geq(x.value, y.value)
  }

  static equal(x: BigInteger, y: BigInteger): boolean {
    return x.value.equals(y.value)
  }

  static notEqual(x: BigInteger, y: BigInteger): boolean {
    return !x.value.equals(y.value)
  }

  static bitwiseXor(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.xor(y.value))
  }

  static bitwiseOr(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.or(y.value))
  }

  static bitwiseAnd(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.and(y.value))
  }

  static leftShift(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.shiftLeft(y.value.intValue()))
  }

  static signedRightShift(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.shiftRight(y.value.intValue()))
  }

  static exponentiate(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.pow(y.value.intValue()))
  }

  static multiply(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.multiply(y.value))
  }

  static divide(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.divide(y.value))
  }

  static remainder(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.mod(y.value))
  }

  static add(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.add(y.value))
  }

  static subtract(x: BigInteger, y: BigInteger): BigInteger {
    return _(x.value.subtract(y.value))
  }

  static unaryMinus(x: BigInteger): BigInteger {
    return _(x.value.negate())
  }

  static bitwiseNot(x: BigInteger): BigInteger {
    return _(x.value.not())
  }

  valueOf(): void {
    throw new TypeError("can't convert BigInt to number")
  }

  toString(radix = 10): string {
    return this.value.toString(radix)
  }
}

const _ = BigInteger.BigInt

export type { JSBN }

export default BigInteger
// import JSBI from "jsbi";
// export default JSBI;
