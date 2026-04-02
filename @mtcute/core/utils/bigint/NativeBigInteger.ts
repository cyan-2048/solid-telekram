/**
 * Parse a string in an arbitrary radix into a native bigint
 */
export function fromRadix(n: string, radix: number): bigint {
  if (radix < 2 || radix > 36) {
    throw new RangeError('radix must be between 2 and 36')
  }

  let result = BigInt(0)
  const base = BigInt(radix)

  for (const char of n.toLowerCase()) {
    const digit = Number.parseInt(char, radix)
    if (Number.isNaN(digit)) {
      throw new TypeError(`Invalid digit '${char}' for radix ${radix}`)
    }
    result = result * base + BigInt(digit)
  }

  return result
}

export default class NativeBigInteger {
  static BigInt(arg: number | string | boolean | bigint): bigint {
    return BigInt(arg)
  }

  static is(val: unknown): val is bigint {
    return typeof val == 'bigint'
  }

  static toJSBN(n: bigint): bigint {
    return n
  }

  static toNumber(x: bigint): number {
    return Number(x)
  }

  static unaryMinus(x: bigint): bigint {
    return -x
  }

  static bitwiseNot(x: bigint): bigint {
    return ~x
  }

  static exponentiate(x: bigint, y: bigint): bigint {
    return x ** y
  }

  static multiply(x: bigint, y: bigint): bigint {
    return x * y
  }

  static divide(x: bigint, y: bigint): bigint {
    return x / y
  }

  static remainder(x: bigint, y: bigint): bigint {
    return x % y
  }

  static add(x: bigint, y: bigint): bigint {
    return x + y
  }

  static subtract(x: bigint, y: bigint): bigint {
    return x - y
  }

  static leftShift(x: bigint, y: bigint): bigint {
    return x << y
  }

  static signedRightShift(x: bigint, y: bigint): bigint {
    return x >> y
  }

  static lessThan(x: bigint, y: bigint): boolean {
    return x < y
  }

  static lessThanOrEqual(x: bigint, y: bigint): boolean {
    return x <= y
  }

  static greaterThan(x: bigint, y: bigint): boolean {
    return x > y
  }

  static greaterThanOrEqual(x: bigint, y: bigint): boolean {
    return x >= y
  }

  static equal(x: bigint, y: bigint): boolean {
    return x === y
  }

  static notEqual(x: bigint, y: bigint): boolean {
    return x !== y
  }

  static bitwiseAnd(x: bigint, y: bigint): bigint {
    return x & y
  }

  static bitwiseXor(x: bigint, y: bigint): bigint {
    return x ^ y
  }

  static bitwiseOr(x: bigint, y: bigint): bigint {
    return x | y
  }
}
