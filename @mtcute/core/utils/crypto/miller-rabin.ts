import type { ICryptoProvider } from './abstract.js'

import { bitLength, modPowBinary, randomBigIntBits, twoMultiplicity } from '../bigint-utils.js'
import BigInteger from '../bigint/BigInteger.js'

const BIGINT_ZERO = BigInteger.BigInt(0)
const BIGINT_ONE = BigInteger.BigInt(1)
const BIGINT_TWO = BigInteger.BigInt(2)
const BIGINT_FOUR = BigInteger.BigInt(4)

export function millerRabin(crypto: ICryptoProvider, n: BigInteger, rounds = 20): boolean {
  // small numbers: 0, 1 are not prime, 2, 3 are prime
  if (BigInteger.lessThan(n, BIGINT_FOUR)) {
    return BigInteger.greaterThan(n, BIGINT_ONE)
  }
  if (
    BigInteger.equal(BigInteger.remainder(n, BIGINT_TWO), BIGINT_ZERO)
    || BigInteger.lessThan(n, BIGINT_ZERO)
  ) {
    return false
  }

  const nBits = bitLength(n)
  const nSub = BigInteger.subtract(n, BIGINT_ONE)

  const r = twoMultiplicity(nSub)
  const d = BigInteger.signedRightShift(nSub, r)

  for (let round = 0; round < rounds; round++) {
    let base: BigInteger

    do {
      base = randomBigIntBits(crypto, nBits)
    } while (BigInteger.lessThanOrEqual(base, BIGINT_ONE) || BigInteger.greaterThanOrEqual(base, nSub))

    let x = modPowBinary(base, d, n)
    if (BigInteger.equal(x, BIGINT_ONE) || BigInteger.equal(x, nSub)) continue

    let i = BIGINT_ZERO
    let y: BigInteger

    while (BigInteger.lessThan(i, r)) {
      y = modPowBinary(x, BIGINT_TWO, n)

      if (BigInteger.equal(x, BIGINT_ONE)) return false
      if (BigInteger.equal(x, nSub)) break
      i = BigInteger.add(i, BIGINT_ONE)

      x = y
    }

    if (BigInteger.equal(i, r)) return false
  }

  return true
}
