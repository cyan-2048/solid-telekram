// this is based off of webogram's implementation of pqFactorization
// fallback to mtcute if something fails(just like webogram)
// i guess that should be a main occuring theme here? use leemon if something is terribly slow?
// really hope this only applies to KaiOS 2.5

//@ts-ignore
import { getPlatform } from '@mtcute/core/platform'
import { bufferToBigInt, factorizePQSync, ICryptoProvider } from '../utils.js'

import {
    bigInt2str,
    divide_,
    copyInt_,
    copy_,
    greater,
    add_,
    isZero,
    sub_,
    rightShift_,
    bpe,
    eGCD_,
    equalsInt,
    str2bigInt,
    one,
    // @ts-ignore
} from 'leemon'

function bytesFromLeemonBigInt(bigInt: any) {
    var str = bigInt2str(bigInt, 16)

    return getPlatform().hexDecode(str)
}

function nextRandomInt(maxValue: number) {
    return Math.floor(Math.random() * maxValue)
}

function pqPrimeLeemon(what: any): [Uint8Array, Uint8Array] {
    var minBits = 64
    var minLen = Math.ceil(minBits / bpe) + 1
    var it = 0
    var i, q
    var j, lim
    var P
    var Q
    var a = new Array(minLen)
    var b = new Array(minLen)
    var c = new Array(minLen)
    var g = new Array(minLen)
    var z = new Array(minLen)
    var x = new Array(minLen)
    var y = new Array(minLen)

    for (i = 0; i < 3; i++) {
        q = (nextRandomInt(128) & 15) + 17
        copyInt_(x, nextRandomInt(1000000000) + 1)
        copy_(y, x)
        lim = 1 << (i + 18)

        for (j = 1; j < lim; j++) {
            ++it
            copy_(a, x)
            copy_(b, x)
            copyInt_(c, q)

            while (!isZero(b)) {
                if (b[0] & 1) {
                    add_(c, a)
                    if (greater(c, what)) {
                        sub_(c, what)
                    }
                }
                add_(a, a)
                if (greater(a, what)) {
                    sub_(a, what)
                }
                rightShift_(b, 1)
            }

            copy_(x, c)
            if (greater(x, y)) {
                copy_(z, x)
                sub_(z, y)
            } else {
                copy_(z, y)
                sub_(z, x)
            }
            eGCD_(z, what, g, a, b)
            if (!equalsInt(g, 1)) {
                break
            }
            if ((j & (j - 1)) == 0) {
                copy_(y, x)
            }
        }
        if (greater(g, one)) {
            break
        }
    }

    divide_(what, g, x, y)

    if (greater(g, x)) {
        P = x
        Q = g
    } else {
        P = g
        Q = x
    }

    // console.log(dT(), 'done', bigInt2str(what, 10), bigInt2str(P, 10), bigInt2str(Q, 10))

    return [bytesFromLeemonBigInt(P), bytesFromLeemonBigInt(Q)]
}

export function webogramFactorizePQSync(crypto: ICryptoProvider, pq: Uint8Array): [Uint8Array, Uint8Array] {
    const what = bufferToBigInt(pq)

    try {
        console.time('leemon pq')
        const result = pqPrimeLeemon(str2bigInt(what.toString(16), 16, Math.ceil(64 / bpe) + 1))
        console.timeEnd('leemon pq')
        return result
    } catch (e) {
        console.error('Leemon pq failed', e)
    }

    return factorizePQSync(crypto, pq)
}