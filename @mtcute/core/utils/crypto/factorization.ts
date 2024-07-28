import { bigIntToBuffer, bufferToBigInt, randomBigIntInRange } from '../bigint-utils.js'
import { ICryptoProvider } from './abstract.js'
import bigInt, { BigInteger } from 'big-integer'

/**
 * Factorize `p*q` to `p` and `q` synchronously using Brent-Pollard rho algorithm
 * @param pq
 */
export function factorizePQSync(crypto: ICryptoProvider, pq: Uint8Array): [Uint8Array, Uint8Array] {
    const pq_ = bufferToBigInt(pq)

    const n = PollardRhoBrent(crypto, pq_)
    const m = pq_.divide(n)

    let p
    let q

    if (n.lt(m)) {
        p = n
        q = m
    } else {
        p = m
        q = n
    }

    return [bigIntToBuffer(p), bigIntToBuffer(q)]
}

function PollardRhoBrent(crypto: ICryptoProvider, n: BigInteger): BigInteger {
    if (n.mod(2).eq(0)) return bigInt[2]

    let y = randomBigIntInRange(crypto, n.minus(1))
    const c = randomBigIntInRange(crypto, n.minus(1))
    const m = randomBigIntInRange(crypto, n.minus(1))
    let g = bigInt.one
    let r = bigInt.one
    let q = bigInt.one

    let ys: BigInteger
    let x: BigInteger

    while (g.eq(1)) {
        x = y
        for (let i = 0; r.geq(i); i++) y = y.times(y).mod(n).add(c).mod(n)

        let k = bigInt.zero

        while (k.lt(r) && g.eq(1)) {
            ys = y

            for (let i = bigInt.zero; i.lt(bigInt.min(m, r.minus(k))); i = i.add(bigInt.one)) {
                y = y.times(y).mod(n).add(c).mod(n)
                q = q.times(x.minus(y).abs()).mod(n)
                // y = (y * y % n + c) % n
                // q = q * abs(x - y) % n
            }

            g = bigInt.gcd(q, n)
            k = k.add(m)
        }

        r = r.shiftLeft(1)
    }

    if (g.eq(n)) {
        do {
            ys = ys!.times(ys!).mod(n).plus(c).mod(n)
            // ys = ((ys * ys) % n + c) % n

            g = bigInt.gcd(x!.minus(ys), n)
        } while (g.leq(bigInt.one))
    }

    return g
}
