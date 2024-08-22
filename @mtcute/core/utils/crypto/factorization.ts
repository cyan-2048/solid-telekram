import {
    bigIntAbs,
    bigIntGcd,
    bigIntMin,
    bigIntToBuffer,
    bufferToBigInt,
    randomBigIntInRange,
} from "../bigint-utils.js";

import type { ICryptoProvider } from "./abstract.js";

import { BigInteger } from "jsbn";

const native = typeof BigInt !== "undefined";

/**
 * Factorize `p*q` to `p` and `q` synchronously using Brent-Pollard rho algorithm
 * @param pq
 */
export function factorizePQSync(crypto: ICryptoProvider, pq: Uint8Array): [Uint8Array, Uint8Array] {
    const pq_ = bufferToBigInt(pq);

    const n = PollardRhoBrent(crypto, pq_);

    let p;
    let q;

    if (native) {
        const m = (pq_ as bigint) / (n as bigint);

        if ((n as bigint) < m) {
            p = n;
            q = m;
        } else {
            p = m;
            q = n;
        }
    } else {
        const m = (pq_ as BigInteger).divide(n as BigInteger);

        if ((n as BigInteger).compareTo(m) < 0) {
            p = n;
            n;
            q = m;
        } else {
            p = m;
            q = n;
        }
    }

    return [bigIntToBuffer(p), bigIntToBuffer(q)];
}

function PollardRhoBrent(crypto: ICryptoProvider, n: bigint | BigInteger): bigint | BigInteger {
    if (native) {
        if ((n as bigint) % BigInt(2) === BigInt(0)) return BigInt(2);

        let y = randomBigIntInRange(crypto, (n as bigint) - BigInt(1)) as bigint;
        const c = randomBigIntInRange(crypto, (n as bigint) - BigInt(1)) as bigint;
        const m = randomBigIntInRange(crypto, (n as bigint) - BigInt(1)) as bigint;
        let g = BigInt(1);
        let r = BigInt(1);
        let q = BigInt(1);

        let ys: bigint;
        let x: bigint;

        while (g === BigInt(1)) {
            x = y;
            for (let i = 0; r >= i; i++) y = (((y * y) % (n as bigint)) + c) % (n as bigint);

            let k = BigInt(0);

            while (k < r && g === BigInt(1)) {
                ys = y;

                for (let i = BigInt(0); i < (bigIntMin(m, r - k) as bigint); i++) {
                    y = (((y * y) % (n as bigint)) + c) % (n as bigint);
                    q = (q * (bigIntAbs(x - y) as bigint)) % (n as bigint);
                }

                g = bigIntGcd(q, n) as bigint;
                k = k + m;
            }

            r <<= BigInt(1);
        }

        if (g === n) {
            do {
                ys = (((ys! * ys!) % n) + c) % n;

                g = bigIntGcd(x! - ys!, n) as bigint;
            } while (g <= BigInt(1));
        }

        return g;
    } else {
        const TWO = new BigInteger("2");
        if ((n as BigInteger).remainder(TWO).equals(BigInteger.ZERO)) return TWO;

        let y = randomBigIntInRange(crypto, (n as BigInteger).subtract(BigInteger.ONE));
        const c = randomBigIntInRange(crypto, (n as BigInteger).subtract(BigInteger.ONE));
        const m = randomBigIntInRange(crypto, (n as BigInteger).subtract(BigInteger.ONE));
        let g = BigInteger.ONE;
        let r = BigInteger.ONE;
        let q = BigInteger.ONE;

        let ys: BigInteger;
        let x: BigInteger;

        while (g.equals(BigInteger.ONE)) {
            x = y as BigInteger;
            for (let i = BigInteger.ZERO; r.compareTo(i); i = i.add(BigInteger.ONE))
                y = (y as BigInteger)
                    .multiply(y as BigInteger)
                    .remainder(n as BigInteger)
                    .add(c as BigInteger)
                    .remainder(n as BigInteger);

            let k = BigInteger.ZERO;

            while (k.compareTo(r) < 0 && g.equals(BigInteger.ONE)) {
                ys = y as BigInteger;

                for (
                    let i = BigInteger.ZERO;
                    i.compareTo((m as BigInteger).min(r.subtract(k))) < 0;
                    i = i.add(BigInteger.ONE)
                ) {
                    y = (y as BigInteger)
                        .multiply(y as BigInteger)
                        .remainder(n as BigInteger)
                        .add(c as BigInteger)
                        .remainder(n as BigInteger);
                    q = (q as BigInteger).multiply(x.subtract(y as BigInteger).abs()).remainder(n as BigInteger);
                    // y = (y * y % n + c) % n
                    // q = q * abs(x - y) % n
                }

                g = q.gcd(n as BigInteger);
                k = k.add(m as BigInteger);
            }

            r = r.shiftLeft(1);
        }

        if (g.equals(n as BigInteger)) {
            do {
                ys = ys!
                    .multiply(ys!)
                    .remainder(n as BigInteger)
                    .add(c as BigInteger)
                    .remainder(n as BigInteger);
                // ys = ((ys * ys) % n + c) % n

                g = x!.subtract(ys).gcd(n as BigInteger);
            } while (g.compareTo(BigInteger.ONE) <= 0);
        }

        return g;
    }
}
