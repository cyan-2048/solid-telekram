const u8 = Uint8Array,
	u16 = Uint16Array,
	i32 = Int32Array;
const fleb = new u8([
	0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
	/* unused */
	0, 0 /* impossible */, 0,
]);
const fdeb = new u8([
	0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
	/* unused */
	0, 0,
]);
const clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
const freb = (eb, start) => {
	const b = new u16(31);
	for (let i = 0; i < 31; ++i) {
		b[i] = start += 1 << eb[i - 1];
	}
	const r = new i32(b[30]);
	for (let i = 1; i < 30; ++i) {
		for (let j = b[i]; j < b[i + 1]; ++j) {
			r[j] = ((j - b[i]) << 5) | i;
		}
	}
	return { b, r };
};
const { b: fl, r: revfl } = freb(fleb, 2);
(fl[28] = 258), (revfl[258] = 28);
const { b: fd, r: revfd } = freb(fdeb, 0);
const rev = new u16(32768);
for (let i = 0; i < 32768; ++i) {
	let x = ((i & 43690) >> 1) | ((i & 21845) << 1);
	x = ((x & 52428) >> 2) | ((x & 13107) << 2);
	x = ((x & 61680) >> 4) | ((x & 3855) << 4);
	rev[i] = (((x & 65280) >> 8) | ((x & 255) << 8)) >> 1;
}
const hMap = (cd, mb, r) => {
	const s = cd.length;
	let i = 0;
	const l = new u16(mb);
	for (; i < s; ++i) {
		if (cd[i]) ++l[cd[i] - 1];
	}
	const le = new u16(mb);
	for (i = 1; i < mb; ++i) {
		le[i] = (le[i - 1] + l[i - 1]) << 1;
	}
	let co;
	if (r) {
		co = new u16(1 << mb);
		const rvb = 15 - mb;
		for (i = 0; i < s; ++i) {
			if (cd[i]) {
				const sv = (i << 4) | cd[i];
				const r2 = mb - cd[i];
				let v = le[cd[i] - 1]++ << r2;
				for (const m = v | ((1 << r2) - 1); v <= m; ++v) {
					co[rev[v] >> rvb] = sv;
				}
			}
		}
	} else {
		co = new u16(s);
		for (i = 0; i < s; ++i) {
			if (cd[i]) {
				co[i] = rev[le[cd[i] - 1]++] >> (15 - cd[i]);
			}
		}
	}
	return co;
};
const flt = new u8(288);
for (let i = 0; i < 144; ++i) flt[i] = 8;
for (let i = 144; i < 256; ++i) flt[i] = 9;
for (let i = 256; i < 280; ++i) flt[i] = 7;
for (let i = 280; i < 288; ++i) flt[i] = 8;
const fdt = new u8(32);
for (let i = 0; i < 32; ++i) fdt[i] = 5;
const flm = /* @__PURE__ */ hMap(flt, 9, 0),
	flrm = /* @__PURE__ */ hMap(flt, 9, 1);
const fdm = /* @__PURE__ */ hMap(fdt, 5, 0),
	fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
const max = (a) => {
	let m = a[0];
	for (let i = 1; i < a.length; ++i) {
		if (a[i] > m) m = a[i];
	}
	return m;
};
const bits = (d, p, m) => {
	const o = (p / 8) | 0;
	return ((d[o] | (d[o + 1] << 8)) >> (p & 7)) & m;
};
const bits16 = (d, p) => {
	const o = (p / 8) | 0;
	return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) >> (p & 7);
};
const shft = (p) => ((p + 7) / 8) | 0;
const slc = (v, s, e) => {
	if (s == null || s < 0) s = 0;
	if (e == null || e > v.length) e = v.length;
	return new u8(v.subarray(s, e));
};
export const FlateErrorCode = {
	UnexpectedEOF: 0,
	InvalidBlockType: 1,
	InvalidLengthLiteral: 2,
	InvalidDistance: 3,
	StreamFinished: 4,
	NoStreamHandler: 5,
	InvalidHeader: 6,
	NoCallback: 7,
	InvalidUTF8: 8,
	ExtraFieldTooLong: 9,
	InvalidDate: 10,
	FilenameTooLong: 11,
	StreamFinishing: 12,
	InvalidZipData: 13,
	UnknownCompressionMethod: 14,
};
const ec = [
	"unexpected EOF",
	"invalid block type",
	"invalid length/literal",
	"invalid distance",
	"stream finished",
	"no stream handler",
	,
	// determined by compression function
	"no callback",
	"invalid UTF-8 data",
	"extra field too long",
	"date not in range 1980-2099",
	"filename too long",
	"stream finishing",
	"invalid zip data",
	// determined by unknown compression method
];
const err = (ind, msg, nt) => {
	const e = new Error(msg || ec[ind]);
	e.code = ind;
	if (Error.captureStackTrace) Error.captureStackTrace(e, err);
	if (!nt) throw e;
	return e;
};
const inflt = (dat, st, buf, dict) => {
	const sl = dat.length,
		dl = dict ? dict.length : 0;
	if (!sl || (st.f && !st.l)) return buf || new u8(0);
	const noBuf = !buf;
	const resize = noBuf || st.i != 2;
	const noSt = st.i;
	if (noBuf) buf = new u8(sl * 3);
	const cbuf = (l) => {
		let bl = buf.length;
		if (l > bl) {
			const nbuf = new u8(Math.max(bl * 2, l));
			nbuf.set(buf);
			buf = nbuf;
		}
	};
	let final = st.f || 0,
		pos = st.p || 0,
		bt = st.b || 0,
		lm = st.l,
		dm = st.d,
		lbt = st.m,
		dbt = st.n;
	const tbts = sl * 8;
	do {
		if (!lm) {
			final = bits(dat, pos, 1);
			const type = bits(dat, pos + 1, 3);
			pos += 3;
			if (!type) {
				const s = shft(pos) + 4,
					l = dat[s - 4] | (dat[s - 3] << 8),
					t = s + l;
				if (t > sl) {
					if (noSt) err(0);
					break;
				}
				if (resize) cbuf(bt + l);
				buf.set(dat.subarray(s, t), bt);
				(st.b = bt += l), (st.p = pos = t * 8), (st.f = final);
				continue;
			} else if (type == 1) (lm = flrm), (dm = fdrm), (lbt = 9), (dbt = 5);
			else if (type == 2) {
				const hLit = bits(dat, pos, 31) + 257,
					hcLen = bits(dat, pos + 10, 15) + 4;
				const tl = hLit + bits(dat, pos + 5, 31) + 1;
				pos += 14;
				const ldt = new u8(tl);
				const clt = new u8(19);
				for (let i = 0; i < hcLen; ++i) {
					clt[clim[i]] = bits(dat, pos + i * 3, 7);
				}
				pos += hcLen * 3;
				const clb = max(clt),
					clbmsk = (1 << clb) - 1;
				const clm = hMap(clt, clb, 1);
				for (let i = 0; i < tl; ) {
					const r = clm[bits(dat, pos, clbmsk)];
					pos += r & 15;
					const s = r >> 4;
					if (s < 16) {
						ldt[i++] = s;
					} else {
						let c = 0,
							n = 0;
						if (s == 16) (n = 3 + bits(dat, pos, 3)), (pos += 2), (c = ldt[i - 1]);
						else if (s == 17) (n = 3 + bits(dat, pos, 7)), (pos += 3);
						else if (s == 18) (n = 11 + bits(dat, pos, 127)), (pos += 7);
						while (n--) ldt[i++] = c;
					}
				}
				const lt = ldt.subarray(0, hLit),
					dt = ldt.subarray(hLit);
				lbt = max(lt);
				dbt = max(dt);
				lm = hMap(lt, lbt, 1);
				dm = hMap(dt, dbt, 1);
			} else err(1);
			if (pos > tbts) {
				if (noSt) err(0);
				break;
			}
		}
		if (resize) cbuf(bt + 131072);
		const lms = (1 << lbt) - 1,
			dms = (1 << dbt) - 1;
		let lpos = pos;
		for (; ; lpos = pos) {
			const c = lm[bits16(dat, pos) & lms],
				sym = c >> 4;
			pos += c & 15;
			if (pos > tbts) {
				if (noSt) err(0);
				break;
			}
			if (!c) err(2);
			if (sym < 256) buf[bt++] = sym;
			else if (sym == 256) {
				(lpos = pos), (lm = null);
				break;
			} else {
				let add = sym - 254;
				if (sym > 264) {
					const i = sym - 257,
						b = fleb[i];
					add = bits(dat, pos, (1 << b) - 1) + fl[i];
					pos += b;
				}
				const d = dm[bits16(dat, pos) & dms],
					dsym = d >> 4;
				if (!d) err(3);
				pos += d & 15;
				let dt = fd[dsym];
				if (dsym > 3) {
					const b = fdeb[dsym];
					(dt += bits16(dat, pos) & ((1 << b) - 1)), (pos += b);
				}
				if (pos > tbts) {
					if (noSt) err(0);
					break;
				}
				if (resize) cbuf(bt + 131072);
				const end = bt + add;
				if (bt < dt) {
					const shift = dl - dt,
						dend = Math.min(dt, end);
					if (shift + bt < 0) err(3);
					for (; bt < dend; ++bt) buf[bt] = dict[shift + bt];
				}
				for (; bt < end; ++bt) buf[bt] = buf[bt - dt];
			}
		}
		(st.l = lm), (st.p = lpos), (st.b = bt), (st.f = final);
		if (lm) (final = 1), (st.m = lbt), (st.d = dm), (st.n = dbt);
	} while (!final);
	return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
const wbits = (d, p, v) => {
	v <<= p & 7;
	const o = (p / 8) | 0;
	d[o] |= v;
	d[o + 1] |= v >> 8;
};
const wbits16 = (d, p, v) => {
	v <<= p & 7;
	const o = (p / 8) | 0;
	d[o] |= v;
	d[o + 1] |= v >> 8;
	d[o + 2] |= v >> 16;
};
const hTree = (d, mb) => {
	const t = [];
	for (let i = 0; i < d.length; ++i) {
		if (d[i]) t.push({ s: i, f: d[i] });
	}
	const s = t.length;
	const t2 = t.slice();
	if (!s) return { t: et, l: 0 };
	if (s == 1) {
		const v = new u8(t[0].s + 1);
		v[t[0].s] = 1;
		return { t: v, l: 1 };
	}
	t.sort((a, b) => a.f - b.f);
	t.push({ s: -1, f: 25001 });
	let l = t[0],
		r = t[1],
		i0 = 0,
		i1 = 1,
		i2 = 2;
	t[0] = { s: -1, f: l.f + r.f, l, r };
	while (i1 != s - 1) {
		l = t[t[i0].f < t[i2].f ? i0++ : i2++];
		r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
		t[i1++] = { s: -1, f: l.f + r.f, l, r };
	}
	let maxSym = t2[0].s;
	for (let i = 1; i < s; ++i) {
		if (t2[i].s > maxSym) maxSym = t2[i].s;
	}
	const tr = new u16(maxSym + 1);
	let mbt = ln(t[i1 - 1], tr, 0);
	if (mbt > mb) {
		let i = 0,
			dt = 0;
		const lft = mbt - mb,
			cst = 1 << lft;
		t2.sort((a, b) => tr[b.s] - tr[a.s] || a.f - b.f);
		for (; i < s; ++i) {
			const i22 = t2[i].s;
			if (tr[i22] > mb) {
				dt += cst - (1 << (mbt - tr[i22]));
				tr[i22] = mb;
			} else break;
		}
		dt >>= lft;
		while (dt > 0) {
			const i22 = t2[i].s;
			if (tr[i22] < mb) dt -= 1 << (mb - tr[i22]++ - 1);
			else ++i;
		}
		for (; i >= 0 && dt; --i) {
			const i22 = t2[i].s;
			if (tr[i22] == mb) {
				--tr[i22];
				++dt;
			}
		}
		mbt = mb;
	}
	return { t: new u8(tr), l: mbt };
};
const ln = (n, l, d) => {
	return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : (l[n.s] = d);
};
const lc = (c) => {
	let s = c.length;
	while (s && !c[--s]);
	const cl = new u16(++s);
	let cli = 0,
		cln = c[0],
		cls = 1;
	const w = (v) => {
		cl[cli++] = v;
	};
	for (let i = 1; i <= s; ++i) {
		if (c[i] == cln && i != s) ++cls;
		else {
			if (!cln && cls > 2) {
				for (; cls > 138; cls -= 138) w(32754);
				if (cls > 2) {
					w(cls > 10 ? ((cls - 11) << 5) | 28690 : ((cls - 3) << 5) | 12305);
					cls = 0;
				}
			} else if (cls > 3) {
				w(cln), --cls;
				for (; cls > 6; cls -= 6) w(8304);
				if (cls > 2) w(((cls - 3) << 5) | 8208), (cls = 0);
			}
			while (cls--) w(cln);
			cls = 1;
			cln = c[i];
		}
	}
	return { c: cl.subarray(0, cli), n: s };
};
const clen = (cf, cl) => {
	let l = 0;
	for (let i = 0; i < cl.length; ++i) l += cf[i] * cl[i];
	return l;
};
const wfblk = (out, pos, dat) => {
	const s = dat.length;
	const o = shft(pos + 2);
	out[o] = s & 255;
	out[o + 1] = s >> 8;
	out[o + 2] = out[o] ^ 255;
	out[o + 3] = out[o + 1] ^ 255;
	for (let i = 0; i < s; ++i) out[o + i + 4] = dat[i];
	return (o + 4 + s) * 8;
};
const wblk = (dat, out, final, syms, lf, df, eb, li, bs, bl, p) => {
	wbits(out, p++, final);
	++lf[256];
	const { t: dlt, l: mlb } = hTree(lf, 15);
	const { t: ddt, l: mdb } = hTree(df, 15);
	const { c: lclt, n: nlc } = lc(dlt);
	const { c: lcdt, n: ndc } = lc(ddt);
	const lcfreq = new u16(19);
	for (let i = 0; i < lclt.length; ++i) ++lcfreq[lclt[i] & 31];
	for (let i = 0; i < lcdt.length; ++i) ++lcfreq[lcdt[i] & 31];
	const { t: lct, l: mlcb } = hTree(lcfreq, 7);
	let nlcc = 19;
	for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc);
	const flen = (bl + 5) << 3;
	const ftlen = clen(lf, flt) + clen(df, fdt) + eb;
	const dtlen =
		clen(lf, dlt) +
		clen(df, ddt) +
		eb +
		14 +
		3 * nlcc +
		clen(lcfreq, lct) +
		2 * lcfreq[16] +
		3 * lcfreq[17] +
		7 * lcfreq[18];
	if (bs >= 0 && flen <= ftlen && flen <= dtlen) return wfblk(out, p, dat.subarray(bs, bs + bl));
	let lm, ll, dm, dl;
	wbits(out, p, 1 + (dtlen < ftlen)), (p += 2);
	if (dtlen < ftlen) {
		(lm = hMap(dlt, mlb, 0)), (ll = dlt), (dm = hMap(ddt, mdb, 0)), (dl = ddt);
		const llm = hMap(lct, mlcb, 0);
		wbits(out, p, nlc - 257);
		wbits(out, p + 5, ndc - 1);
		wbits(out, p + 10, nlcc - 4);
		p += 14;
		for (let i = 0; i < nlcc; ++i) wbits(out, p + 3 * i, lct[clim[i]]);
		p += 3 * nlcc;
		const lcts = [lclt, lcdt];
		for (let it = 0; it < 2; ++it) {
			const clct = lcts[it];
			for (let i = 0; i < clct.length; ++i) {
				const len = clct[i] & 31;
				wbits(out, p, llm[len]), (p += lct[len]);
				if (len > 15) wbits(out, p, (clct[i] >> 5) & 127), (p += clct[i] >> 12);
			}
		}
	} else {
		(lm = flm), (ll = flt), (dm = fdm), (dl = fdt);
	}
	for (let i = 0; i < li; ++i) {
		const sym = syms[i];
		if (sym > 255) {
			const len = (sym >> 18) & 31;
			wbits16(out, p, lm[len + 257]), (p += ll[len + 257]);
			if (len > 7) wbits(out, p, (sym >> 23) & 31), (p += fleb[len]);
			const dst = sym & 31;
			wbits16(out, p, dm[dst]), (p += dl[dst]);
			if (dst > 3) wbits16(out, p, (sym >> 5) & 8191), (p += fdeb[dst]);
		} else {
			wbits16(out, p, lm[sym]), (p += ll[sym]);
		}
	}
	wbits16(out, p, lm[256]);
	return p + ll[256];
};
const deo = /* @__PURE__ */ new i32([
	65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632,
]);
const et = /* @__PURE__ */ new u8(0);
const dflt = (dat, lvl, plvl, pre, post, st) => {
	const s = st.z || dat.length;
	const o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
	const w = o.subarray(pre, o.length - post);
	const lst = st.l;
	let pos = (st.r || 0) & 7;
	if (lvl) {
		if (pos) w[0] = st.r >> 3;
		const opt = deo[lvl - 1];
		const n = opt >> 13,
			c = opt & 8191;
		const msk = (1 << plvl) - 1;
		const prev = st.p || new u16(32768),
			head = st.h || new u16(msk + 1);
		const bs1 = Math.ceil(plvl / 3),
			bs2 = 2 * bs1;
		const hsh = (i2) => (dat[i2] ^ (dat[i2 + 1] << bs1) ^ (dat[i2 + 2] << bs2)) & msk;
		const syms = new i32(25e3);
		const lf = new u16(288),
			df = new u16(32);
		let lc2 = 0,
			eb = 0,
			i = st.i || 0,
			li = 0,
			wi = st.w || 0,
			bs = 0;
		for (; i + 2 < s; ++i) {
			const hv = hsh(i);
			let imod = i & 32767,
				pimod = head[hv];
			prev[imod] = pimod;
			head[hv] = imod;
			if (wi <= i) {
				const rem = s - i;
				if ((lc2 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
					pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
					(li = lc2 = eb = 0), (bs = i);
					for (let j = 0; j < 286; ++j) lf[j] = 0;
					for (let j = 0; j < 30; ++j) df[j] = 0;
				}
				let l = 2,
					d = 0,
					ch2 = c,
					dif = (imod - pimod) & 32767;
				if (rem > 2 && hv == hsh(i - dif)) {
					const maxn = Math.min(n, rem) - 1;
					const maxd = Math.min(32767, i);
					const ml = Math.min(258, rem);
					while (dif <= maxd && --ch2 && imod != pimod) {
						if (dat[i + l] == dat[i + l - dif]) {
							let nl = 0;
							for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl);
							if (nl > l) {
								(l = nl), (d = dif);
								if (nl > maxn) break;
								const mmd = Math.min(dif, nl - 2);
								let md = 0;
								for (let j = 0; j < mmd; ++j) {
									const ti = (i - dif + j) & 32767;
									const pti = prev[ti];
									const cd = (ti - pti) & 32767;
									if (cd > md) (md = cd), (pimod = ti);
								}
							}
						}
						(imod = pimod), (pimod = prev[imod]);
						dif += (imod - pimod) & 32767;
					}
				}
				if (d) {
					syms[li++] = 268435456 | (revfl[l] << 18) | revfd[d];
					const lin = revfl[l] & 31,
						din = revfd[d] & 31;
					eb += fleb[lin] + fdeb[din];
					++lf[257 + lin];
					++df[din];
					wi = i + l;
					++lc2;
				} else {
					syms[li++] = dat[i];
					++lf[dat[i]];
				}
			}
		}
		for (i = Math.max(i, wi); i < s; ++i) {
			syms[li++] = dat[i];
			++lf[dat[i]];
		}
		pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
		if (!lst) {
			st.r = (pos & 7) | (w[(pos / 8) | 0] << 3);
			pos -= 7;
			(st.h = head), (st.p = prev), (st.i = i), (st.w = wi);
		}
	} else {
		for (let i = st.w || 0; i < s + lst; i += 65535) {
			let e = i + 65535;
			if (e >= s) {
				w[(pos / 8) | 0] = lst;
				e = s;
			}
			pos = wfblk(w, pos + 1, dat.subarray(i, e));
		}
		st.i = s;
	}
	return slc(o, 0, pre + shft(pos) + post);
};
const crct = /* @__PURE__ */ (() => {
	const t = new Int32Array(256);
	for (let i = 0; i < 256; ++i) {
		let c = i,
			k = 9;
		while (--k) c = (c & 1 && -306674912) ^ (c >>> 1);
		t[i] = c;
	}
	return t;
})();
const crc = () => {
	let c = -1;
	return {
		p(d) {
			let cr = c;
			for (let i = 0; i < d.length; ++i) cr = crct[(cr & 255) ^ d[i]] ^ (cr >>> 8);
			c = cr;
		},
		d() {
			return ~c;
		},
	};
};
const dopt = (dat, opt, pre, post, st) => {
	if (!st) {
		st = { l: 1 };
		if (opt.dictionary) {
			const dict = opt.dictionary.subarray(-32768);
			const newDat = new u8(dict.length + dat.length);
			newDat.set(dict);
			newDat.set(dat, dict.length);
			dat = newDat;
			st.w = dict.length;
		}
	}
	return dflt(
		dat,
		opt.level == null ? 6 : opt.level,
		opt.mem == null
			? st.l
				? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5)
				: 20
			: 12 + opt.mem,
		pre,
		post,
		st
	);
};
const mrg = (a, b) => {
	const o = {};
	for (const k in a) o[k] = a[k];
	for (const k in b) o[k] = b[k];
	return o;
};
const wbytes = (d, b, v) => {
	for (; v; ++b) (d[b] = v), (v >>>= 8);
};
const gzh = (c, o) => {
	const fn = o.filename;
	(c[0] = 31),
		(c[1] = 139),
		(c[2] = 8),
		(c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0),
		(c[9] = 3);
	if (o.mtime != 0) wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1e3));
	if (fn) {
		c[3] = 8;
		for (let i = 0; i <= fn.length; ++i) c[i + 10] = fn.charCodeAt(i);
	}
};
const gzs = (d) => {
	if (d[0] != 31 || d[1] != 139 || d[2] != 8) err(6, "invalid gzip data");
	const flg = d[3];
	let st = 10;
	if (flg & 4) st += (d[10] | (d[11] << 8)) + 2;
	for (let zs = ((flg >> 3) & 1) + ((flg >> 4) & 1); zs > 0; zs -= !d[st++]);
	return st + (flg & 2);
};
const gzl = (d) => {
	const l = d.length;
	return (d[l - 4] | (d[l - 3] << 8) | (d[l - 2] << 16) | (d[l - 1] << 24)) >>> 0;
};
const gzhl = (o) => 10 + (o.filename ? o.filename.length + 1 : 0);
export function gzipSync(data, opts) {
	if (!opts) opts = {};
	const c = crc(),
		l = data.length;
	c.p(data);
	const d = dopt(data, opts, gzhl(opts), 8),
		s = d.length;
	return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;
}
export function gunzipSync(data, opts) {
	const st = gzs(data);
	if (st + 8 > data.length) err(6, "invalid gzip data");
	return inflt(
		data.subarray(st, -8),
		{ i: 2 },
		(opts && opts.out) || new u8(gzl(data)),
		opts && opts.dictionary
	);
}

const fltn = (d, p, t, o) => {
	for (const k in d) {
		let val = d[k],
			n = p + k,
			op = o;
		if (Array.isArray(val)) (op = mrg(o, val[1])), (val = val[0]);
		if (val instanceof u8) t[n] = [val, op];
		else {
			t[(n += "/")] = [new u8(0), op];
			fltn(val, n, t, o);
		}
	}
};
