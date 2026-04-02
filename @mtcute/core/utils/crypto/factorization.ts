import type { ICryptoProvider } from './abstract.js'

import { abs, euclideanGcd, fromBytes, min2, randomBigIntInRange, toBytes } from '../bigint-utils.js'
import BigInteger from '../bigint/BigInteger.js'

const BIGINT_ZERO = BigInteger.BigInt(0)
const BIGINT_ONE = BigInteger.BigInt(1)
const BIGINT_TWO = BigInteger.BigInt(2)

/**
 * Factorize `p*q` to `p` and `q` synchronously using Brent-Pollard rho algorithm
 * @param pq
 */
export function factorizePQSync(crypto: ICryptoProvider, pq: Uint8Array): [Uint8Array, Uint8Array] {
  const pq_ = fromBytes(pq)

  const n = PollardRhoBrent(crypto, pq_)
  const m = BigInteger.divide(pq_, n)

  let p
  let q

  if (BigInteger.lessThan(n, m)) {
    p = n
    q = m
  } else {
    p = m
    q = n
  }

  return [toBytes(p), toBytes(q)]
}

function PollardRhoBrent(crypto: ICryptoProvider, n: BigInteger): BigInteger {
  if (BigInteger.equal(BigInteger.remainder(n, BIGINT_TWO), BIGINT_ZERO)) return BIGINT_TWO

  const nMinusOne = BigInteger.subtract(n, BIGINT_ONE)
  let y = randomBigIntInRange(crypto, nMinusOne)
  const c = randomBigIntInRange(crypto, nMinusOne)
  const m = randomBigIntInRange(crypto, nMinusOne)
  let g = BIGINT_ONE
  let r = BIGINT_ONE
  let q = BIGINT_ONE

  let ys: BigInteger
  let x: BigInteger

  while (BigInteger.equal(g, BIGINT_ONE)) {
    x = y
    for (let i = BIGINT_ZERO; BigInteger.lessThanOrEqual(i, r); i = BigInteger.add(i, BIGINT_ONE)) {
      y = BigInteger.remainder(
        BigInteger.add(BigInteger.remainder(BigInteger.multiply(y, y), n), c),
        n,
      )
    }

    let k = BIGINT_ZERO

    while (BigInteger.lessThan(k, r) && BigInteger.equal(g, BIGINT_ONE)) {
      ys = y
      const maxSteps = min2(m, BigInteger.subtract(r, k))

      for (let i = BIGINT_ZERO; BigInteger.lessThan(i, maxSteps); i = BigInteger.add(i, BIGINT_ONE)) {
        y = BigInteger.remainder(
          BigInteger.add(BigInteger.remainder(BigInteger.multiply(y, y), n), c),
          n,
        )
        q = BigInteger.remainder(
          BigInteger.multiply(q, abs(BigInteger.subtract(x, y))),
          n,
        )
      }

      g = euclideanGcd(q, n)
      k = BigInteger.add(k, m)
    }

    r = BigInteger.leftShift(r, BIGINT_ONE)
  }

  if (BigInteger.equal(g, n)) {
    do {
      ys = BigInteger.remainder(
        BigInteger.add(BigInteger.remainder(BigInteger.multiply(ys!, ys!), n), c),
        n,
      )

      g = euclideanGcd(BigInteger.subtract(x!, ys!), n)
    } while (BigInteger.lessThanOrEqual(g, BIGINT_ONE))
  }

  return g
}
