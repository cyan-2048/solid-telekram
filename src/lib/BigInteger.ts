// @ts-nocheck
// this is basically JSBN but if it was using native BigInt under the hood
// this is for KaiOS 3.0/cloudphone support
// the methods available will only be parts where mtcute actually uses

import { bigint } from "@fuman/utils";

function _throw(): never {
	throw new Error("Method not implemented.");
}

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz".split("");

// let bigintCount = 0;

export class BigInteger {
	private value!: bigint;

	// static getCount() {
	// 	// returns how many bigints exists
	// 	return bigintCount;
	// }

	// mtcute only does new BigInteger(null)
	constructor(val: null | bigint) {
		// for simplicity reasons
		if (typeof val == "bigint") {
			this.value = val;
		}

		// ++bigintCount;
	}

	static get ZERO(): BigInteger {
		return _(0n);
	}

	static get ONE(): BigInteger {
		return _(1n);
	}

	// mtcute only uses this for converting buffer to bigint
	fromString(s: string | Array<number> | Uint8Array): void {
		// it should always be a u8
		const buffer = s as Uint8Array;
		this.value = bigint.fromBytes(buffer);
	}

	fromRadix(str: string, radix: number): void {
		switch (radix) {
			case 2:
				this.value = BigInt("0b" + str);
				return;
			case 8:
				this.value = BigInt("0o" + str);
				return;
			case 10:
				this.value = BigInt(str);
				return;
			case 16:
				this.value = BigInt("0x" + str);
				return;
		}

		// taken from https://github.com/tc39/proposal-bigint/issues/86#issuecomment-347757254
		if (radix < 2 || radix > alphabet.length || Math.floor(radix) !== radix) {
			throw new RangeError("radix out of range");
		}

		let val = 0n;
		for (const c of ("" + str).split("")) {
			const index = alphabet.indexOf(c);
			if (index < 0 || index >= radix) {
				throw new RangeError("character out of range");
			}
			val = val * BigInt(radix) + BigInt(index);
		}

		this.value = val;
	}

	fromInt(x: number): void {
		this.value = BigInt(x);
	}

	toString(b: number): string {
		return this.value.toString(b);
	}

	compareTo(a: BigInteger): number {
		if (this.value < a.value) return -1;
		if (this.value > a.value) return 1;
		return 0;
	}

	toByteArray(): Array<number> {
		return Array.from(bigint.toBytes(this.value));
	}

	// r = this + a
	addTo(a: BigInteger, _r: BigInteger): void {
		_r.value = this.value + a.value;
	}

	mod(a: BigInteger): BigInteger {
		return _(this.value % a.value);
	}

	// r = this << n
	lShiftTo(n: number, r: BigInteger): void {
		r.value = this.value << BigInt(n);
	}

	// r = this >> n
	rShiftTo(n: number, r: BigInteger): void {
		r.value = this.value >> BigInt(n);
	}

	// r = this - a
	subTo(a: BigInteger, r: BigInteger): void {
		r.value = this.value - a.value;
	}

	isEven(): boolean {
		return this.value % 2n === 0n;
	}

	abs(): BigInteger {
		return _(bigint.abs(this.value));
	}

	bitLength(): number {
		return bigint.bitLength(this.value);
	}

	intValue(): number {
		return Number(this.value);
	}

	equals(a: BigInteger): boolean {
		return this.value === a.value;
	}

	min(a: BigInteger): BigInteger {
		return this.compareTo(a) < 0 ? this : a;
	}

	add(a: BigInteger): BigInteger {
		return _(this.value + a.value);
	}

	subtract(a: BigInteger): BigInteger {
		return _(this.value - a.value);
	}

	multiply(a: BigInteger): BigInteger {
		return _(this.value * a.value);
	}

	divide(a: BigInteger): BigInteger {
		return _(this.value / a.value);
	}

	pow(e: number): BigInteger {
		return _(this.value ** BigInt(e));
	}

	modPow(e: BigInteger, m: BigInteger): BigInteger {
		return _(bigint.modPowBinary(this.value, e.value, m.value));
	}

	GCD(a: BigInteger): BigInteger {
		return _(bigint.euclideanGcd(this.value, a.value));
	}

	modInverse(m: BigInteger): BigInteger {
		return _(bigint.modInv(this.value, m.value));
	}

	and(a: BigInteger): BigInteger {
		return _(this.value & a.value);
	}

	// this << n
	shiftLeft(n: number): BigInteger {
		return _(this.value << BigInt(n));
	}

	// this >> n
	shiftRight(n: number): BigInteger {
		return _(this.value >> BigInt(n));
	}

	millerRabin() {
		_throw();
	}
}

function _(val: null | bigint) {
	return new BigInteger(val);
}
