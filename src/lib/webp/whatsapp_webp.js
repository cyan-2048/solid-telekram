function i(r) {
	for (
		var a = r.rgba,
			n = r.width,
			i = r.height,
			t = Math.floor(n / 2),
			e = Math.floor(i / 2),
			f = new Uint8Array(t * e * 4),
			u = 0,
			l = 0;
		l + 1 < i;
		l += 2
	)
		for (var c = 0; c + 1 < n; u += 4, c += 2)
			(f[u] =
				(a[4 * (c + l * n)] +
					a[4 * (c + 1 + l * n)] +
					a[4 * (c + (l + 1) * n)] +
					a[4 * (c + 1 + (l + 1) * n)]) /
				4),
				(f[u + 1] =
					(a[4 * (c + l * n) + 1] +
						a[4 * (c + 1 + l * n) + 1] +
						a[4 * (c + (l + 1) * n) + 1] +
						a[4 * (c + 1 + (l + 1) * n) + 1]) /
					4),
				(f[u + 2] =
					(a[4 * (c + l * n) + 2] +
						a[4 * (c + 1 + l * n) + 2] +
						a[4 * (c + (l + 1) * n) + 2] +
						a[4 * (c + 1 + (l + 1) * n) + 2]) /
					4),
				(f[u + 3] =
					(a[4 * (c + l * n) + 3] +
						a[4 * (c + 1 + l * n) + 3] +
						a[4 * (c + (l + 1) * n) + 3] +
						a[4 * (c + 1 + (l + 1) * n) + 3]) /
					4);
	return { rgba: f, width: t, height: e };
}

var t = {};
function e(r) {
	if (!r) throw Error("assert :P");
}
function f(r, a, n) {
	for (var i = 0; 4 > i; i++) if (r[a + i] != n.charCodeAt(i)) return !0;
	return !1;
}
function u(r, a, n, i, t) {
	for (var e = 0; e < t; e++) r[a + e] = n[i + e];
}
function l(r, a, n, i) {
	for (var t = 0; t < i; t++) r[a + t] = n;
}
function c(r) {
	return new Int32Array(r);
}
function o(r, a) {
	for (var n = [], i = 0; i < r; i++) n.push(new a());
	return n;
}
function s(r, a) {
	var n = [];
	return (
		(function r(n, i, t) {
			for (
				var e = t[i], f = 0;
				f < e && (n.push(t.length > i + 1 ? [] : new a()), !(t.length < i + 1));
				f++
			)
				r(n[f], i + 1, t);
		})(n, 0, r),
		n
	);
}
var h = function () {
	function r() {
		c(55);
	}
	function a(r, a) {
		for (var n = (1 << (a - 1)) >>> 0; r & n; ) n >>>= 1;
		return n ? (r & (n - 1)) + n : r;
	}
	function n(r, a, n, i, t) {
		e(!(i % n));
		do {
			r[a + (i -= n)] = t;
		} while (0 < i);
	}
	function i(r, i, t, f, u) {
		if ((e(2328 >= u), 512 >= u)) var l = c(512);
		else if (null == (l = c(u))) return 0;
		return (function (r, i, t, f, u, l) {
			var o,
				s,
				b = i,
				d = 1 << t,
				v = c(16),
				w = c(16);
			for (e(0 != u), e(null != f), e(null != r), e(0 < t), s = 0; s < u; ++s) {
				if (15 < f[s]) return 0;
				++v[f[s]];
			}
			if (v[0] == u) return 0;
			for (w[1] = 0, o = 1; 15 > o; ++o) {
				if (v[o] > 1 << o) return 0;
				w[o + 1] = w[o] + v[o];
			}
			for (s = 0; s < u; ++s) (o = f[s]), 0 < f[s] && (l[w[o]++] = s);
			if (1 == w[15]) return ((f = new h()).g = 0), (f.value = l[0]), n(r, b, 1, d, f), d;
			var g,
				P = -1,
				k = d - 1,
				m = 0,
				p = 1,
				A = 1,
				L = 1 << t;
			for (s = 0, o = 1, u = 2; o <= t; ++o, u <<= 1) {
				if (((p += A <<= 1), 0 > (A -= v[o]))) return 0;
				for (; 0 < v[o]; --v[o])
					((f = new h()).g = o), (f.value = l[s++]), n(r, b + m, u, L, f), (m = a(m, o));
			}
			for (o = t + 1, u = 2; 15 >= o; ++o, u <<= 1) {
				if (((p += A <<= 1), 0 > (A -= v[o]))) return 0;
				for (; 0 < v[o]; --v[o]) {
					if (((f = new h()), (m & k) != P)) {
						for (b += L, g = 1 << ((P = o) - t); 15 > P && !(0 >= (g -= v[P])); ) ++P, (g <<= 1);
						(d += L = 1 << (g = P - t)),
							(r[i + (P = m & k)].g = g + t),
							(r[i + P].value = b - i - P);
					}
					(f.g = o - t), (f.value = l[s++]), n(r, b + (m >> t), u, L, f), (m = a(m, o));
				}
			}
			return p != 2 * w[15] - 1 ? 0 : d;
		})(r, i, t, f, u, l);
	}
	function h() {
		this.value = this.g = 0;
	}
	function b() {
		this.value = this.g = 0;
	}
	function d() {
		(this.G = o(5, h)),
			(this.H = c(5)),
			(this.jc = this.Qb = this.qb = this.nd = 0),
			(this.pd = o(Hn, b));
	}
	function v(r, a, n, i) {
		e(null != r),
			e(null != a),
			e(2147483648 > i),
			(r.Ca = 254),
			(r.I = 0),
			(r.b = -8),
			(r.Ka = 0),
			(r.oa = a),
			(r.pa = n),
			(r.Jd = a),
			(r.Yc = n + i),
			(r.Zc = 4 <= i ? n + i - 4 + 1 : n),
			V(r);
	}
	function w(r, a) {
		for (var n = 0; 0 < a--; ) n |= G(r, 128) << a;
		return n;
	}
	function g(r, a) {
		var n = w(r, a);
		return B(r) ? -n : n;
	}
	function P(r, a, n, i) {
		var t,
			f = 0;
		for (
			e(null != r),
				e(null != a),
				e(4294967288 > i),
				r.Sb = i,
				r.Ra = 0,
				r.u = 0,
				r.h = 0,
				4 < i && (i = 4),
				t = 0;
			t < i;
			++t
		)
			f += a[n + t] << (8 * t);
		(r.Ra = f), (r.bb = i), (r.oa = a), (r.pa = n);
	}
	function k(r) {
		for (; 8 <= r.u && r.bb < r.Sb; )
			(r.Ra >>>= 8), (r.Ra += (r.oa[r.pa + r.bb] << (Kn - 8)) >>> 0), ++r.bb, (r.u -= 8);
		R(r) && ((r.h = 1), (r.u = 0));
	}
	function m(r, a) {
		if ((e(0 <= a), !r.h && a <= Wn)) {
			var n = L(r) & Dn[a];
			return (r.u += a), k(r), n;
		}
		return (r.h = 1), (r.u = 0);
	}
	function p() {
		(this.b = this.Ca = this.I = 0),
			(this.oa = []),
			(this.pa = 0),
			(this.Jd = []),
			(this.Yc = 0),
			(this.Zc = []),
			(this.Ka = 0);
	}
	function A() {
		(this.Ra = 0), (this.oa = []), (this.h = this.u = this.bb = this.Sb = this.pa = 0);
	}
	function L(r) {
		return (r.Ra >>> (r.u & (Kn - 1))) >>> 0;
	}
	function R(r) {
		return e(r.bb <= r.Sb), r.h || (r.bb == r.Sb && r.u > Kn);
	}
	function y(r, a) {
		(r.u = a), (r.h = R(r));
	}
	function _(r) {
		r.u >= Nn && (e(r.u >= Nn), k(r));
	}
	function V(r) {
		e(null != r && null != r.oa),
			r.pa < r.Zc
				? ((r.I = (r.oa[r.pa++] | (r.I << 8)) >>> 0), (r.b += 8))
				: (e(null != r && null != r.oa),
				  r.pa < r.Yc
						? ((r.b += 8), (r.I = r.oa[r.pa++] | (r.I << 8)))
						: r.Ka
						? (r.b = 0)
						: ((r.I <<= 8), (r.b += 8), (r.Ka = 1)));
	}
	function B(r) {
		return w(r, 1);
	}
	function G(r, a) {
		var n = r.Ca;
		0 > r.b && V(r);
		var i = r.b,
			t = (n * a) >>> 8,
			e = (r.I >>> i > t) + 0;
		for (e ? ((n -= t), (r.I -= ((t + 1) << i) >>> 0)) : (n = t + 1), i = n, t = 0; 256 <= i; )
			(t += 8), (i >>= 8);
		return (i = 7 ^ (t + Yn[i])), (r.b -= i), (r.Ca = (n << i) - 1), e;
	}
	function C(r, a, n) {
		(r[a + 0] = (n >> 24) & 255),
			(r[a + 1] = (n >> 16) & 255),
			(r[a + 2] = (n >> 8) & 255),
			(r[a + 3] = (n >> 0) & 255);
	}
	function I(r, a) {
		return (r[a + 0] << 0) | (r[a + 1] << 8);
	}
	function U(r, a) {
		return I(r, a) | (r[a + 2] << 16);
	}
	function M(r, a) {
		return I(r, a) | (I(r, a + 2) << 16);
	}
	function F(r, a) {
		var n = 1 << a;
		return e(null != r), e(0 < a), (r.X = c(n)), null == r.X ? 0 : ((r.Mb = 32 - a), (r.Xa = a), 1);
	}
	function j(r, a) {
		e(null != r), e(null != a), e(r.Xa == a.Xa), u(a.X, 0, r.X, 0, 1 << a.Xa);
	}
	function O() {
		(this.X = []), (this.Xa = this.Mb = 0);
	}
	function S(r, a, n, i) {
		e(null != n), e(null != i);
		var t = n[0],
			f = i[0];
		return (
			0 == t && (t = (r * f + a / 2) / a),
			0 == f && (f = (a * t + r / 2) / r),
			0 >= t || 0 >= f ? 0 : ((n[0] = t), (i[0] = f), 1)
		);
	}
	function T(r, a) {
		return (r + (1 << a) - 1) >>> a;
	}
	function H(r, a) {
		return (
			(((((4278255360 & r) + (4278255360 & a)) >>> 0) & 4278255360) +
				((((16711935 & r) + (16711935 & a)) >>> 0) & 16711935)) >>>
			0
		);
	}
	function D(r, a) {
		t[a] = function (a, n, i, e, f, u, l) {
			var c;
			for (c = 0; c < f; ++c) {
				var o = t[r](u[l + c - 1], i, e + c);
				u[l + c] = H(a[n + c], o);
			}
		};
	}
	function W() {
		this.ud = this.hd = this.jd = 0;
	}
	function K(r, a) {
		return (((4278124286 & (r ^ a)) >>> 1) + (r & a)) >>> 0;
	}
	function N(r) {
		return 0 <= r && 256 > r ? r : 0 > r ? 0 : 255 < r ? 255 : void 0;
	}
	function Y(r, a) {
		return N(r + ((r - a + 0.5) >> 1));
	}
	function J(r, a, n) {
		return Math.abs(a - n) - Math.abs(r - n);
	}
	function x(r, a, n, i, t, e, f) {
		for (i = e[f - 1], n = 0; n < t; ++n) e[f + n] = i = H(r[a + n], i);
	}
	function z(r, a, n, i, t) {
		var e;
		for (e = 0; e < n; ++e) {
			var f = r[a + e],
				u = (f >> 8) & 255,
				l = 16711935 & (l = (l = 16711935 & f) + ((u << 16) + u));
			i[t + e] = ((4278255360 & f) + l) >>> 0;
		}
	}
	function E(r, a) {
		(a.jd = (r >> 0) & 255), (a.hd = (r >> 8) & 255), (a.ud = (r >> 16) & 255);
	}
	function X(r, a, n, i, t, e) {
		var f;
		for (f = 0; f < i; ++f) {
			var u = a[n + f],
				l = u >>> 8,
				c = u,
				o = 255 & (o = (o = u >>> 16) + ((((r.jd << 24) >> 24) * ((l << 24) >> 24)) >>> 5));
			(c =
				255 &
				(c =
					(c += (((r.hd << 24) >> 24) * ((l << 24) >> 24)) >>> 5) +
					((((r.ud << 24) >> 24) * ((o << 24) >> 24)) >>> 5))),
				(t[e + f] = (4278255360 & u) + (o << 16) + c);
		}
	}
	function $(r, a, n, i, e) {
		(t[a] = function (r, a, n, t, f, u, l, c, o) {
			for (t = l; t < c; ++t) for (l = 0; l < o; ++l) f[u++] = e(n[i(r[a++])]);
		}),
			(t[r] = function (r, a, f, u, l, c, o) {
				var s = 8 >> r.b,
					h = r.Ea,
					b = r.K[0],
					d = r.w;
				if (8 > s)
					for (r = (1 << r.b) - 1, d = (1 << s) - 1; a < f; ++a) {
						var v,
							w = 0;
						for (v = 0; v < h; ++v) v & r || (w = i(u[l++])), (c[o++] = e(b[w & d])), (w >>= s);
					}
				else t["VP8LMapColor" + n](u, l, b, d, c, o, a, f, h);
			});
	}
	function Z(r, a, n, i, t) {
		for (n = a + n; a < n; ) {
			var e = r[a++];
			(i[t++] = (e >> 16) & 255), (i[t++] = (e >> 8) & 255), (i[t++] = (e >> 0) & 255);
		}
	}
	function q(r, a, n, i, t) {
		for (n = a + n; a < n; ) {
			var e = r[a++];
			(i[t++] = (e >> 16) & 255),
				(i[t++] = (e >> 8) & 255),
				(i[t++] = (e >> 0) & 255),
				(i[t++] = (e >> 24) & 255);
		}
	}
	function Q(r, a, n, i, t) {
		for (n = a + n; a < n; ) {
			var e = (((f = r[a++]) >> 16) & 240) | ((f >> 12) & 15),
				f = ((f >> 0) & 240) | ((f >> 28) & 15);
			(i[t++] = e), (i[t++] = f);
		}
	}
	function rr(r, a, n, i, t) {
		for (n = a + n; a < n; ) {
			var e = (((f = r[a++]) >> 16) & 248) | ((f >> 13) & 7),
				f = ((f >> 5) & 224) | ((f >> 3) & 31);
			(i[t++] = e), (i[t++] = f);
		}
	}
	function ar(r, a, n, i, t) {
		for (n = a + n; a < n; ) {
			var e = r[a++];
			(i[t++] = (e >> 0) & 255), (i[t++] = (e >> 8) & 255), (i[t++] = (e >> 16) & 255);
		}
	}
	function nr(r, a, n, i, t, e) {
		if (0 == e)
			for (n = a + n; a < n; )
				C(
					i,
					(((e = r[a++])[0] >> 24) |
						((e[1] >> 8) & 65280) |
						((e[2] << 8) & 16711680) |
						(e[3] << 24)) >>>
						0
				),
					(t += 32);
		else u(i, t, r, a, n);
	}
	function ir(r, a) {
		(t[a][0] = t[r + "0"]),
			(t[a][1] = t[r + "1"]),
			(t[a][2] = t[r + "2"]),
			(t[a][3] = t[r + "3"]),
			(t[a][4] = t[r + "4"]),
			(t[a][5] = t[r + "5"]),
			(t[a][6] = t[r + "6"]),
			(t[a][7] = t[r + "7"]),
			(t[a][8] = t[r + "8"]),
			(t[a][9] = t[r + "9"]),
			(t[a][10] = t[r + "10"]),
			(t[a][11] = t[r + "11"]),
			(t[a][12] = t[r + "12"]),
			(t[a][13] = t[r + "13"]),
			(t[a][14] = t[r + "0"]),
			(t[a][15] = t[r + "0"]);
	}
	function tr(r) {
		return r == Ni || r == Yi || r == Ji || r == xi;
	}
	function er() {
		(this.eb = []), (this.size = this.A = this.fb = 0);
	}
	function fr() {
		(this.y = []),
			(this.f = []),
			(this.ea = []),
			(this.F = []),
			(this.Tc =
				this.Ed =
				this.Cd =
				this.Fd =
				this.lb =
				this.Db =
				this.Ab =
				this.fa =
				this.J =
				this.W =
				this.N =
				this.O =
					0);
	}
	function ur() {
		(this.Rd = this.height = this.width = this.S = 0),
			(this.f = {}),
			(this.f.RGBA = new er()),
			(this.f.kb = new fr()),
			(this.sd = null);
	}
	function lr() {
		(this.width = [0]), (this.height = [0]), (this.Pd = [0]), (this.Qd = [0]), (this.format = [0]);
	}
	function cr() {
		this.Id =
			this.fd =
			this.Md =
			this.hb =
			this.ib =
			this.da =
			this.bd =
			this.cd =
			this.j =
			this.v =
			this.Da =
			this.Sd =
			this.ob =
				0;
	}
	function or(r) {
		// (3)`Stickers decoder: WebPSamplerProcessPlane`;
		console.info("Stickers decoder: WebPSamplerProcessPlane");
		return r.T;
	}
	function sr(r, a) {
		var n = r.T,
			i = a.ba.f.RGBA,
			t = i.eb,
			e = i.fb + r.ka * i.A,
			f = gt[a.ba.S],
			l = r.y,
			c = r.O,
			o = r.f,
			s = r.N,
			h = r.ea,
			b = r.W,
			d = a.cc,
			v = a.dc,
			w = a.Mc,
			g = a.Nc,
			P = r.ka,
			k = r.ka + r.T,
			m = r.U,
			p = (m + 1) >> 1;
		for (
			0 == P
				? f(l, c, null, null, o, s, h, b, o, s, h, b, t, e, null, null, m)
				: (f(a.ec, a.fc, l, c, d, v, w, g, o, s, h, b, t, e - i.A, t, e, m), ++n);
			P + 2 < k;
			P += 2
		)
			(d = o),
				(v = s),
				(w = h),
				(g = b),
				(s += r.Rc),
				(b += r.Rc),
				(e += 2 * i.A),
				f(l, (c += 2 * r.fa) - r.fa, l, c, d, v, w, g, o, s, h, b, t, e - i.A, t, e, m);
		return (
			(c += r.fa),
			r.j + k < r.o
				? (u(a.ec, a.fc, l, c, m), u(a.cc, a.dc, o, s, p), u(a.Mc, a.Nc, h, b, p), n--)
				: 1 & k || f(l, c, null, null, o, s, h, b, o, s, h, b, t, e + i.A, null, null, m),
			n
		);
	}
	function hr(r, a, n) {
		var i = r.F,
			t = [r.J];
		if (null != i) {
			var f = r.U,
				u = a.ba.S,
				l = u == Di || u == Ji;
			a = a.ba.f.RGBA;
			var c = [0],
				o = r.ka;
			(c[0] = r.T),
				r.Kb &&
					(0 == o ? --c[0] : (--o, (t[0] -= r.width)),
					r.j + r.ka + r.T == r.o && (c[0] = r.o - r.j - o));
			var s = a.eb;
			(o = a.fb + o * a.A),
				(r = yi(i, t[0], r.width, f, c, s, o + (l ? 0 : 3), a.A)),
				e(n == c),
				r && tr(u) && Li(s, o, l, f, c, a.A);
		}
		return 0;
	}
	function br(r) {
		var a = r.ma,
			n = a.ba.S,
			i = 11 > n,
			t = n == Si || n == Hi || n == Di || n == Wi || 12 == n || tr(n);
		if (((a.memory = null), (a.Ib = null), (a.Jb = null), (a.Nd = null), !On(a.Oa, r, t ? 11 : 12)))
			return 0;
		if ((t && tr(n) && kn(), r.da)) {
			// (3)`Stickers decoder: use_scaling`;
			console.info("Stickers decoder: use_scaling");
		} else {
			if (i) {
				if (((a.Ib = or), r.Kb)) {
					if (((n = (r.U + 1) >> 1), (a.memory = c(r.U + 2 * n)), null == a.memory)) return 0;
					(a.ec = a.memory),
						(a.fc = 0),
						(a.cc = a.ec),
						(a.dc = a.fc + r.U),
						(a.Mc = a.cc),
						(a.Nc = a.dc + n),
						(a.Ib = sr),
						kn();
				}
			} else {
				// (3)`Stickers decoder: EmitYUV`;
				console.info("Stickers decoder: EmitYUV");
			}
			t && ((a.Jb = hr), i && gn());
		}
		if (i && !It) {
			for (r = 0; 256 > r; ++r)
				(Ut[r] = (89858 * (r - 128) + _t) >> yt),
					(jt[r] = -22014 * (r - 128) + _t),
					(Ft[r] = -45773 * (r - 128)),
					(Mt[r] = (113618 * (r - 128) + _t) >> yt);
			for (r = Vt; r < Bt; ++r)
				(a = (76283 * (r - 16) + _t) >> yt),
					(Ot[r - Vt] = xr(a, 255)),
					(St[r - Vt] = xr((a + 8) >> 4, 15));
			It = 1;
		}
		return 1;
	}
	function dr(r) {
		var a = r.ma,
			n = r.U,
			i = r.T;
		return (
			e(!(1 & r.ka)),
			0 >= n || 0 >= i ? 0 : ((n = a.Ib(r, a)), null != a.Jb && a.Jb(r, a, n), (a.Dc += n), 1)
		);
	}
	function vr(r) {
		r.ma.memory = null;
	}
	function wr(r, a, n, i) {
		return 47 != m(r, 8)
			? 0
			: ((a[0] = m(r, 14) + 1), (n[0] = m(r, 14) + 1), (i[0] = m(r, 1)), 0 != m(r, 3) ? 0 : !r.h);
	}
	function gr(r, a) {
		if (4 > r) return r + 1;
		var n = (r - 2) >> 1;
		return ((2 + (1 & r)) << n) + m(a, n) + 1;
	}
	function Pr(r, a) {
		return 120 < a ? a - 120 : 1 <= (n = ((n = qi[a - 1]) >> 4) * r + (8 - (15 & n))) ? n : 1;
		var n;
	}
	function kr(r, a, n) {
		var i = L(n),
			t = r[(a += 255 & i)].g - 8;
		return (
			0 < t && (y(n, n.u + 8), (i = L(n)), (a += r[a].value), (a += i & ((1 << t) - 1))),
			y(n, n.u + r[a].g),
			r[a].value
		);
	}
	function mr(r, a, n) {
		return (n.g += r.g), (n.value += (r.value << a) >>> 0), e(8 >= n.g), r.g;
	}
	function pr(r, a, n) {
		var i = r.xc;
		return e((a = 0 == i ? 0 : r.vc[r.md * (n >> i) + (a >> i)]) < r.Wb), r.Ya[a];
	}
	function Ar(r, a, n, i) {
		var t = r.ab,
			f = r.c * a,
			l = r.C;
		a = l + a;
		var c = n,
			o = i;
		for (i = r.Ta, n = r.Ua; 0 < t--; ) {
			var s = r.gc[t],
				h = l,
				b = a,
				d = c,
				v = o,
				w = ((o = i), (c = n), s.Ea);
			switch ((e(h < b), e(b <= s.nc), s.hc)) {
				case 2:
					zn(d, v, (b - h) * w, o, c);
					break;
				case 0:
					var g = h,
						P = b,
						k = o,
						m = c,
						p = (_ = s).Ea;
					0 == g &&
						(Jn(d, v, null, null, 1, k, m),
						x(d, v + 1, 0, 0, p - 1, k, m + 1),
						(v += p),
						(m += p),
						++g);
					for (
						var A = 1 << _.b, L = A - 1, R = T(p, _.b), y = _.K, _ = _.w + (g >> _.b) * R;
						g < P;

					) {
						var V = y,
							B = _,
							G = 1;
						for (xn(d, v, k, m - p, 1, k, m); G < p; ) {
							var C = (G & ~L) + A;
							C > p && (C = p),
								(0, qn[(V[B++] >> 8) & 15])(d, v + +G, k, m + G - p, C - G, k, m + G),
								(G = C);
						}
						(v += p), (m += p), ++g & L || (_ += R);
					}
					b != s.nc && u(o, c - w, o, c + (b - h - 1) * w, w);
					break;
				case 1:
					for (
						w = d,
							P = v,
							p = (d = s.Ea) - (m = d & ~(k = (v = 1 << s.b) - 1)),
							g = T(d, s.b),
							A = s.K,
							s = s.w + (h >> s.b) * g;
						h < b;

					) {
						for (L = A, R = s, y = new W(), _ = P + m, V = P + d; P < _; )
							E(L[R++], y), Qn(y, w, P, v, o, c), (P += v), (c += v);
						P < V && (E(L[R++], y), Qn(y, w, P, p, o, c), (P += p), (c += p)), ++h & k || (s += g);
					}
					break;
				case 3:
					if (d == o && v == c && 0 < s.b) {
						for (
							P = o,
								d = w = c + (b - h) * w - (m = (b - h) * T(s.Ea, s.b)),
								v = o,
								k = c,
								g = [],
								m = (p = m) - 1;
							0 <= m;
							--m
						)
							g[m] = v[k + m];
						for (m = p - 1; 0 <= m; --m) P[d + m] = g[m];
						En(s, h, b, o, w, o, c);
					} else En(s, h, b, d, v, o, c);
			}
			(c = i), (o = n);
		}
		o != n && u(i, n, c, o, f);
	}
	function Lr(r, a) {
		var n = r.V,
			i = r.Ba + r.c * r.C,
			t = a - r.C;
		if ((e(a <= r.l.o), e(16 >= t), 0 < t)) {
			var f = r.l,
				u = r.Ta,
				l = r.Ua,
				c = f.width;
			if (
				(Ar(r, t, n, i),
				(t = l = [l]),
				e((n = r.C) < (i = a)),
				e(f.v < f.va),
				i > f.o && (i = f.o),
				n < f.j)
			) {
				var o = f.j - n;
				(n = f.j), (t[0] += o * c);
			}
			if (
				(n >= i
					? (n = 0)
					: ((t[0] += 4 * f.v), (f.ka = n - f.j), (f.U = f.va - f.v), (f.T = i - n), (n = 1)),
				n)
			) {
				if (((l = l[0]), 11 > (n = r.ca).S)) {
					var s = n.f.RGBA,
						h = ((i = n.S), (t = f.U), (f = f.T), (o = s.eb), s.A),
						b = f;
					for (s = s.fb + r.Ma * s.A; 0 < b--; ) {
						var d = u,
							v = l,
							w = t,
							g = o,
							P = s;
						switch (i) {
							case Oi:
								ri(d, v, w, g, P);
								break;
							case Si:
								ai(d, v, w, g, P);
								break;
							case Ni:
								ai(d, v, w, g, P), Li(g, P, 0, w, 1, 0);
								break;
							case Ti:
								ti(d, v, w, g, P);
								break;
							case Hi:
								nr(d, v, w, g, P, 1);
								break;
							case Yi:
								nr(d, v, w, g, P, 1), Li(g, P, 0, w, 1, 0);
								break;
							case Di:
								nr(d, v, w, g, P, 0);
								break;
							case Ji:
								nr(d, v, w, g, P, 0), Li(g, P, 1, w, 1, 0);
								break;
							case Wi:
								ni(d, v, w, g, P);
								break;
							case xi:
								ni(d, v, w, g, P), Ri(g, P, w, 1, 0);
								break;
							case Ki:
								ii(d, v, w, g, P);
								break;
							default:
								e(0);
						}
						(l += c), (s += h);
					}
					r.Ma += f;
				} else {
					// (3)`Stickers decoder: EmitRescaledRowsYUVA`;
					console.info(`Stickers decoder: EmitRescaledRowsYUVA`);
				}
				e(r.Ma <= n.height);
			}
		}
		(r.C = a), e(r.C <= r.i);
	}
	function Rr(r) {
		var a;
		if (0 < r.ua) return 0;
		for (a = 0; a < r.Wb; ++a) {
			var n = r.Ya[a].G,
				i = r.Ya[a].H;
			if (0 < n[1][i[1] + 0].g || 0 < n[2][i[2] + 0].g || 0 < n[3][i[3] + 0].g) return 0;
		}
		return 1;
	}
	function yr(r, a, n, i, t, f) {
		if (0 != r.Z) {
			var u = r.qd,
				l = r.rd;
			for (e(null != wt[r.Z]); a < n; ++a) wt[r.Z](u, l, i, t, i, t, f), (u = i), (l = t), (t += f);
			(r.qd = u), (r.rd = l);
		}
	}
	function _r(r, a) {
		var n = r.l.ma,
			i = 0 == n.Z || 1 == n.Z ? r.l.j : r.C;
		if (((i = r.C < i ? i : r.C), e(a <= r.l.o), a > i)) {
			var t = r.l.width,
				f = n.ca,
				u = n.tb + t * i,
				l = r.V,
				c = r.Ba + r.c * i,
				o = r.gc;
			e(1 == r.ab), e(3 == o[0].hc), $n(o[0], i, a, l, c, f, u), yr(n, i, a, f, u, t);
		}
		r.C = r.Ma = a;
	}
	function Vr(r, a, n, i, t, f, u) {
		var l = r.$ / i,
			c = r.$ % i,
			o = r.m,
			s = r.s,
			h = n + r.$,
			b = h;
		t = n + i * t;
		var d = n + i * f,
			v = 280 + s.ua,
			w = r.Pb ? l : 16777216,
			g = 0 < s.ua ? s.Wa : null,
			P = s.wc,
			k = h < d ? pr(s, c, l) : null;
		e(r.C < f), e(d <= t);
		var m = !1;
		r: for (;;) {
			for (; m || h < d; ) {
				var p = 0;
				if (l >= w) {
					var A = h - n;
					e((w = r).Pb), (w.wd = w.m), (w.xd = A), 0 < w.s.ua && j(w.s.Wa, w.s.vb), (w = l + rt);
				}
				if ((c & P || (k = pr(s, c, l)), e(null != k), k.Qb && ((a[h] = k.qb), (m = !0)), !m))
					if ((_(o), k.jc)) {
						(p = o), (A = a);
						var V = h,
							B = k.pd[L(p) & (Hn - 1)];
						e(k.jc),
							256 > B.g
								? (y(p, p.u + B.g), (A[V] = B.value), (p = 0))
								: (y(p, p.u + B.g - 256), e(256 <= B.value), (p = B.value)),
							0 == p && (m = !0);
					} else p = kr(k.G[0], k.H[0], o);
				if (o.h) break;
				if (m || 256 > p) {
					if (!m)
						if (k.nd) a[h] = (k.qb | (p << 8)) >>> 0;
						else {
							if (
								(_(o),
								(m = kr(k.G[1], k.H[1], o)),
								_(o),
								(A = kr(k.G[2], k.H[2], o)),
								(V = kr(k.G[3], k.H[3], o)),
								o.h)
							)
								break;
							a[h] = ((V << 24) | (m << 16) | (p << 8) | A) >>> 0;
						}
					if (
						((m = !1),
						++h,
						++c >= i && ((c = 0), ++l, null != u && l <= f && !(l % 16) && u(r, l), null != g))
					)
						for (; b < h; ) (p = a[b++]), (g.X[((506832829 * p) & 4294967295) >>> g.Mb] = p);
				} else if (280 > p) {
					if (
						((p = gr(p - 256, o)),
						(A = kr(k.G[4], k.H[4], o)),
						_(o),
						(A = Pr(i, (A = gr(A, o)))),
						o.h)
					)
						break;
					if (h - n < A || t - h < p) break r;
					for (V = 0; V < p; ++V) a[h + V] = a[h + V - A];
					for (h += p, c += p; c >= i; ) (c -= i), ++l, null != u && l <= f && !(l % 16) && u(r, l);
					if ((e(h <= t), c & P && (k = pr(s, c, l)), null != g))
						for (; b < h; ) (p = a[b++]), (g.X[((506832829 * p) & 4294967295) >>> g.Mb] = p);
				} else {
					if (!(p < v)) break r;
					for (m = p - 280, e(null != g); b < h; )
						(p = a[b++]), (g.X[((506832829 * p) & 4294967295) >>> g.Mb] = p);
					(p = h), e(!(m >>> (A = g).Xa)), (a[p] = A.X[m]), (m = !0);
				}
				m || e(o.h == R(o));
			}
			if (r.Pb && o.h && h < t)
				e(r.m.h), (r.a = 5), (r.m = r.wd), (r.$ = r.xd), 0 < r.s.ua && j(r.s.vb, r.s.Wa);
			else {
				if (o.h) break r;
				null != u && u(r, l > f ? f : l), (r.a = 0), (r.$ = h - n);
			}
			return 1;
		}
		return (r.a = 3), 0;
	}
	function Br(r) {
		e(null != r), (r.vc = null), (r.yc = null), (r.Ya = null);
		var a = r.Wa;
		null != a && (a.X = null), (r.vb = null), e(null != r);
	}
	function Gr() {
		var r = new un();
		return null == r
			? null
			: ((r.a = 0),
			  (r.xb = vt),
			  ir("Predictor", "VP8LPredictors"),
			  ir("Predictor", "VP8LPredictors_C"),
			  ir("PredictorAdd", "VP8LPredictorsAdd"),
			  ir("PredictorAdd", "VP8LPredictorsAdd_C"),
			  (zn = z),
			  (Qn = X),
			  (ri = Z),
			  (ai = q),
			  (ni = Q),
			  (ii = rr),
			  (ti = ar),
			  (t.VP8LMapColor32b = Xn),
			  (t.VP8LMapColor8b = Zn),
			  r);
	}
	function Cr(r, a, n, t, f) {
		var u = 1,
			s = [r],
			b = [a],
			v = t.m,
			w = t.s,
			g = null,
			P = 0;
		r: for (;;) {
			if (n)
				for (; u && m(v, 1); ) {
					var k = s,
						p = b,
						A = t,
						R = 1,
						V = A.m,
						B = A.gc[A.ab],
						G = m(V, 2);
					if (A.Oc & (1 << G)) u = 0;
					else {
						switch (
							((A.Oc |= 1 << G),
							(B.hc = G),
							(B.Ea = k[0]),
							(B.nc = p[0]),
							(B.K = [null]),
							++A.ab,
							e(4 >= A.ab),
							G)
						) {
							case 0:
							case 1:
								(B.b = m(V, 3) + 2),
									(R = Cr(T(B.Ea, B.b), T(B.nc, B.b), 0, A, B.K)),
									(B.K = B.K[0]);
								break;
							case 3:
								var C,
									I = m(V, 8) + 1,
									U = 16 < I ? 0 : 4 < I ? 1 : 2 < I ? 2 : 3;
								if (((k[0] = T(B.Ea, U)), (B.b = U), (C = R = Cr(I, 1, 0, A, B.K)))) {
									var M,
										j = I,
										O = B,
										S = 1 << (8 >> O.b),
										D = c(S);
									if (null == D) C = 0;
									else {
										var W = O.K[0],
											K = O.w;
										for (D[0] = O.K[0][0], M = 1; M < 1 * j; ++M) D[M] = H(W[K + M], D[M - 1]);
										for (; M < 4 * S; ++M) D[M] = 0;
										(O.K[0] = null), (O.K[0] = D), (C = 1);
									}
								}
								R = C;
								break;
							case 2:
								break;
							default:
								e(0);
						}
						u = R;
					}
				}
			if (((s = s[0]), (b = b[0]), u && m(v, 1) && !(u = 1 <= (P = m(v, 4)) && 11 >= P))) {
				t.a = 3;
				break r;
			}
			var N;
			if ((N = u))
				a: {
					var Y,
						J,
						x,
						z = t,
						E = s,
						X = b,
						$ = P,
						Z = n,
						q = z.m,
						Q = z.s,
						rr = [null],
						ar = 1,
						nr = 0,
						ir = Qi[$];
					n: for (;;) {
						if (Z && m(q, 1)) {
							var tr = m(q, 3) + 2,
								er = T(E, tr),
								fr = T(X, tr),
								ur = er * fr;
							if (!Cr(er, fr, 0, z, rr)) break n;
							for (rr = rr[0], Q.xc = tr, Y = 0; Y < ur; ++Y) {
								var lr = (rr[Y] >> 8) & 65535;
								(rr[Y] = lr), lr >= ar && (ar = lr + 1);
							}
						}
						if (q.h) break n;
						for (J = 0; 5 > J; ++J) {
							var cr = Xi[J];
							!J && 0 < $ && (cr += 1 << $), nr < cr && (nr = cr);
						}
						var or = o(ar * ir, h),
							sr = ar,
							hr = o(sr, d);
						if (null == hr) var br = null;
						else e(65536 >= sr), (br = hr);
						var dr = c(nr);
						if (null == br || null == dr || null == or) {
							z.a = 1;
							break n;
						}
						var vr = or;
						for (Y = x = 0; Y < ar; ++Y) {
							var wr = br[Y],
								gr = wr.G,
								Pr = wr.H,
								kr = 0,
								pr = 1,
								Ar = 0;
							for (J = 0; 5 > J; ++J) {
								(cr = Xi[J]), (gr[J] = vr), (Pr[J] = x), !J && 0 < $ && (cr += 1 << $);
								i: {
									var Lr,
										Rr = cr,
										yr = z,
										_r = dr,
										Gr = vr,
										Ir = x,
										Ur = 0,
										Mr = yr.m,
										Fr = m(Mr, 1);
									if ((l(_r, 0, 0, Rr), Fr)) {
										var jr = m(Mr, 1) + 1,
											Or = m(Mr, 1),
											Sr = m(Mr, 0 == Or ? 1 : 8);
										(_r[Sr] = 1), 2 == jr && (_r[(Sr = m(Mr, 8))] = 1);
										var Tr = 1;
									} else {
										var Hr = c(19),
											Dr = m(Mr, 4) + 4;
										if (19 < Dr) {
											yr.a = 3;
											var Wr = 0;
											break i;
										}
										for (Lr = 0; Lr < Dr; ++Lr) Hr[Zi[Lr]] = m(Mr, 3);
										var Kr = void 0,
											Nr = void 0,
											Yr = yr,
											Jr = Hr,
											xr = Rr,
											zr = _r,
											Er = 0,
											Xr = Yr.m,
											$r = 8,
											Zr = o(128, h);
										t: for (; i(Zr, 0, 7, Jr, 19); ) {
											if (m(Xr, 1)) {
												var qr = 2 + 2 * m(Xr, 3);
												if ((Kr = 2 + m(Xr, qr)) > xr) break t;
											} else Kr = xr;
											for (Nr = 0; Nr < xr && Kr--; ) {
												_(Xr);
												var Qr = Zr[0 + (127 & L(Xr))];
												y(Xr, Xr.u + Qr.g);
												var ra = Qr.value;
												if (16 > ra) (zr[Nr++] = ra), 0 != ra && ($r = ra);
												else {
													var aa = 16 == ra,
														na = ra - 16,
														ia = Ei[na],
														ta = m(Xr, zi[na]) + ia;
													if (Nr + ta > xr) break t;
													for (var ea = aa ? $r : 0; 0 < ta--; ) zr[Nr++] = ea;
												}
											}
											Er = 1;
											break t;
										}
										Er || (Yr.a = 3), (Tr = Er);
									}
									(Tr = Tr && !Mr.h) && (Ur = i(Gr, Ir, 8, _r, Rr)),
										Tr && 0 != Ur ? (Wr = Ur) : ((yr.a = 3), (Wr = 0));
								}
								if (0 == Wr) break n;
								if ((pr && 1 == $i[J] && (pr = 0 == vr[x].g), (kr += vr[x].g), (x += Wr), 3 >= J)) {
									var fa,
										ua = dr[0];
									for (fa = 1; fa < cr; ++fa) dr[fa] > ua && (ua = dr[fa]);
									Ar += ua;
								}
							}
							if (
								((wr.nd = pr),
								(wr.Qb = 0),
								pr &&
									((wr.qb =
										((gr[3][Pr[3] + 0].value << 24) |
											(gr[1][Pr[1] + 0].value << 16) |
											gr[2][Pr[2] + 0].value) >>>
										0),
									0 == kr &&
										256 > gr[0][Pr[0] + 0].value &&
										((wr.Qb = 1), (wr.qb += gr[0][Pr[0] + 0].value << 8))),
								(wr.jc = !wr.Qb && 6 > Ar),
								wr.jc)
							) {
								var la,
									ca = wr;
								for (la = 0; la < Hn; ++la) {
									var oa = la,
										sa = ca.pd[oa],
										ha = ca.G[0][ca.H[0] + oa];
									256 <= ha.value
										? ((sa.g = ha.g + 256), (sa.value = ha.value))
										: ((sa.g = 0),
										  (sa.value = 0),
										  (oa >>= mr(ha, 8, sa)),
										  (oa >>= mr(ca.G[1][ca.H[1] + oa], 16, sa)),
										  (oa >>= mr(ca.G[2][ca.H[2] + oa], 0, sa)),
										  mr(ca.G[3][ca.H[3] + oa], 24, sa));
								}
							}
						}
						(Q.vc = rr), (Q.Wb = ar), (Q.Ya = br), (Q.yc = or), (N = 1);
						break a;
					}
					N = 0;
				}
			if (!(u = N)) {
				t.a = 3;
				break r;
			}
			if (0 < P) {
				if (((w.ua = 1 << P), !F(w.Wa, P))) {
					(t.a = 1), (u = 0);
					break r;
				}
			} else w.ua = 0;
			var ba = t,
				da = s,
				va = b,
				wa = ba.s,
				ga = wa.xc;
			if (
				((ba.c = da), (ba.i = va), (wa.md = T(da, ga)), (wa.wc = 0 == ga ? -1 : (1 << ga) - 1), n)
			) {
				t.xb = dt;
				break r;
			}
			if (null == (g = c(s * b))) {
				(t.a = 1), (u = 0);
				break r;
			}
			u = (u = Vr(t, g, 0, s, b, b, null)) && !v.h;
			break r;
		}
		return u ? (null != f ? (f[0] = g) : (e(null == g), e(n)), (t.$ = 0), n || Br(w)) : Br(w), u;
	}
	function Ir(r, a) {
		var n = r.c * r.i,
			i = n + a + 16 * a;
		return (
			e(r.c <= a),
			(r.V = c(i)),
			null == r.V
				? ((r.Ta = null), (r.Ua = 0), (r.a = 1), 0)
				: ((r.Ta = r.V), (r.Ua = r.Ba + n + a), 1)
		);
	}
	function Ur(r, a) {
		var n = r.C,
			i = a - n,
			t = r.V,
			f = r.Ba + r.c * n;
		for (e(a <= r.l.o); 0 < i; ) {
			var u = 16 < i ? 16 : i,
				l = r.l.ma,
				c = r.l.width,
				o = c * u,
				s = l.ca,
				h = l.tb + c * n,
				b = r.Ta,
				d = r.Ua;
			Ar(r, u, t, f),
				_i(b, d, s, h, o),
				yr(l, n, n + u, s, h, c),
				(i -= u),
				(t += u * r.c),
				(n += u);
		}
		e(n == a), (r.C = r.Ma = a);
	}
	function Mr() {
		this.ub = this.yd = this.td = this.Rb = 0;
	}
	function Fr() {
		this.Kd = this.Ld = this.Ud = this.Td = this.i = this.c = 0;
	}
	function jr() {
		(this.Fb = this.Bb = this.Cb = 0), (this.Zb = c(4)), (this.Lb = c(4));
	}
	function Or() {
		this.Yb = (function () {
			var r = [];
			return (
				(function r(a, n, i) {
					for (
						var t = i[n], e = 0;
						e < t && (a.push(i.length > n + 1 ? [] : 0), !(i.length < n + 1));
						e++
					)
						r(a[e], n + 1, i);
				})(r, 0, [3, 11]),
				r
			);
		})();
	}
	function Sr() {
		(this.jb = c(3)), (this.Wc = s([4, 8], Or)), (this.Xc = s([4, 17], Or));
	}
	function Tr() {
		(this.Pc = this.wb = this.Tb = this.zd = 0), (this.vd = new c(4)), (this.od = new c(4));
	}
	function Hr() {
		this.ld = this.La = this.dd = this.tc = 0;
	}
	function Dr() {
		this.Na = this.la = 0;
	}
	function Wr() {
		(this.Sc = [0, 0]), (this.Eb = [0, 0]), (this.Qc = [0, 0]), (this.ia = this.lc = 0);
	}
	function Kr() {
		(this.ad = c(384)),
			(this.Za = 0),
			(this.Ob = c(16)),
			(this.$b = this.Ad = this.ia = this.Gc = this.Hc = this.Dd = 0);
	}
	function Nr() {
		(this.uc = this.M = this.Nb = 0),
			(this.wa = Array(new Hr())),
			(this.Y = 0),
			(this.ya = Array(new Kr())),
			(this.aa = 0),
			(this.l = new zr());
	}
	function Yr() {
		(this.y = c(16)), (this.f = c(8)), (this.ea = c(8));
	}
	function Jr() {
		(this.cb = this.a = 0),
			(this.sc = ""),
			(this.m = new p()),
			(this.Od = new Mr()),
			(this.Kc = new Fr()),
			(this.ed = new Tr()),
			(this.Qa = new jr()),
			(this.Ic = this.$c = this.Aa = 0),
			(this.D = new Nr()),
			(this.Xb = this.Va = this.Hb = this.zb = this.yb = this.Ub = this.za = 0),
			(this.Jc = o(8, p)),
			(this.ia = 0),
			new r(),
			(this.pb = o(4, Wr)),
			(this.Pa = new Sr()),
			(this.Bd = this.kc = 0),
			(this.Ac = []),
			(this.Bc = 0),
			(this.zc = [0, 0, 0, 0]),
			(this.Gd = Array(new Yr())),
			(this.Hd = 0),
			(this.rb = Array(new Dr())),
			(this.sb = 0),
			(this.wa = Array(new Hr())),
			(this.Y = 0),
			(this.oc = []),
			(this.pc = 0),
			(this.sa = []),
			(this.ta = 0),
			(this.qa = []),
			(this.ra = 0),
			(this.Ha = []),
			(this.B = this.R = this.Ia = 0),
			(this.Ec = []),
			(this.M = this.ja = this.Vb = this.Fc = 0),
			(this.ya = Array(new Kr())),
			(this.L = this.aa = 0),
			(this.gd = s([4, 2], Hr)),
			(this.ga = null),
			(this.Fa = []),
			(this.Cc = this.qc = this.P = 0),
			(this.Gb = []),
			(this.Uc = 0),
			(this.mb = []),
			(this.nb = 0),
			(this.rc = []),
			(this.Ga = this.Vc = 0);
	}
	function xr(r, a) {
		return 0 > r ? 0 : r > a ? a : r;
	}
	function zr() {
		(this.T = this.U = this.ka = this.height = this.width = 0),
			(this.y = []),
			(this.f = []),
			(this.ea = []),
			(this.Rc = this.fa = this.W = this.N = this.O = 0),
			(this.ma = "void"),
			(this.put = "VP8IoPutHook"),
			(this.ac = "VP8IoSetupHook"),
			(this.bc = "VP8IoTeardownHook"),
			(this.ha = this.Kb = 0),
			(this.data = []),
			(this.hb =
				this.ib =
				this.da =
				this.o =
				this.j =
				this.va =
				this.v =
				this.Da =
				this.ob =
				this.w =
					0),
			(this.F = []),
			(this.J = 0);
	}
	function Er() {
		var r = new Jr();
		return null != r && ((r.a = 0), (r.sc = "OK"), (r.cb = 0), (r.Xb = 0), it || (it = qr)), r;
	}
	function Xr(r, a, n) {
		return 0 == r.a && ((r.a = a), (r.sc = n), (r.cb = 0)), 0;
	}
	function $r(r, a, n) {
		return 3 <= n && 157 == r[a + 0] && 1 == r[a + 1] && 42 == r[a + 2];
	}
	function Zr(r, a) {
		if (null == r) return 0;
		if (((r.a = 0), (r.sc = "OK"), null == a))
			return Xr(r, 2, "null VP8Io passed to VP8GetHeaders()");
		var n = a.data,
			i = a.w,
			t = a.ha;
		if (4 > t) return Xr(r, 7, "Truncated header.");
		var f = n[i + 0] | (n[i + 1] << 8) | (n[i + 2] << 16),
			u = r.Od;
		if (
			((u.Rb = !(1 & f)), (u.td = (f >> 1) & 7), (u.yd = (f >> 4) & 1), (u.ub = f >> 5), 3 < u.td)
		)
			return Xr(r, 3, "Incorrect keyframe parameters.");
		if (!u.yd) return Xr(r, 4, "Frame not displayable.");
		(i += 3), (t -= 3);
		var c = r.Kc;
		if (u.Rb) {
			if (7 > t) return Xr(r, 7, "cannot parse picture header");
			if (!$r(n, i, t)) return Xr(r, 3, "Bad code word");
			(c.c = 16383 & ((n[i + 4] << 8) | n[i + 3])),
				(c.Td = n[i + 4] >> 6),
				(c.i = 16383 & ((n[i + 6] << 8) | n[i + 5])),
				(c.Ud = n[i + 6] >> 6),
				(i += 7),
				(t -= 7),
				(r.za = (c.c + 15) >> 4),
				(r.Ub = (c.i + 15) >> 4),
				(a.width = c.c),
				(a.height = c.i),
				(a.Da = 0),
				(a.j = 0),
				(a.v = 0),
				(a.va = a.width),
				(a.o = a.height),
				(a.da = 0),
				(a.ib = a.width),
				(a.hb = a.height),
				(a.U = a.width),
				(a.T = a.height),
				l((f = r.Pa).jb, 0, 255, f.jb.length),
				e(null != (f = r.Qa)),
				(f.Cb = 0),
				(f.Bb = 0),
				(f.Fb = 1),
				l(f.Zb, 0, 0, f.Zb.length),
				l(f.Lb, 0, 0, f.Lb);
		}
		if (u.ub > t) return Xr(r, 7, "bad partition length");
		v((f = r.m), n, i, u.ub),
			(i += u.ub),
			(t -= u.ub),
			u.Rb && ((c.Ld = B(f)), (c.Kd = B(f))),
			(c = r.Qa);
		var o,
			s = r.Pa;
		if ((e(null != f), e(null != c), (c.Cb = B(f)), c.Cb)) {
			if (((c.Bb = B(f)), B(f))) {
				for (c.Fb = B(f), o = 0; 4 > o; ++o) c.Zb[o] = B(f) ? g(f, 7) : 0;
				for (o = 0; 4 > o; ++o) c.Lb[o] = B(f) ? g(f, 6) : 0;
			}
			if (c.Bb) for (o = 0; 3 > o; ++o) s.jb[o] = B(f) ? w(f, 8) : 255;
		} else c.Bb = 0;
		if (f.Ka) return Xr(r, 3, "cannot parse segment header");
		if ((((c = r.ed).zd = B(f)), (c.Tb = w(f, 6)), (c.wb = w(f, 3)), (c.Pc = B(f)), c.Pc && B(f))) {
			for (s = 0; 4 > s; ++s) B(f) && (c.vd[s] = g(f, 6));
			for (s = 0; 4 > s; ++s) B(f) && (c.od[s] = g(f, 6));
		}
		if (((r.L = 0 == c.Tb ? 0 : c.zd ? 1 : 2), f.Ka)) return Xr(r, 3, "cannot parse filter header");
		var h = t;
		if (((t = o = i), (i = o + h), (c = h), (r.Xb = (1 << w(r.m, 2)) - 1), h < 3 * (s = r.Xb)))
			n = 7;
		else {
			for (o += 3 * s, c -= 3 * s, h = 0; h < s; ++h) {
				var b = n[t + 0] | (n[t + 1] << 8) | (n[t + 2] << 16);
				b > c && (b = c), v(r.Jc[+h], n, o, b), (o += b), (c -= b), (t += 3);
			}
			v(r.Jc[+s], n, o, c), (n = o < i ? 0 : 5);
		}
		if (0 != n) return Xr(r, n, "cannot parse partitions");
		for (
			n = w((o = r.m), 7),
				t = B(o) ? g(o, 4) : 0,
				i = B(o) ? g(o, 4) : 0,
				c = B(o) ? g(o, 4) : 0,
				s = B(o) ? g(o, 4) : 0,
				o = B(o) ? g(o, 4) : 0,
				h = r.Qa,
				b = 0;
			4 > b;
			++b
		) {
			if (h.Cb) {
				var d = h.Zb[b];
				h.Fb || (d += n);
			} else {
				if (0 < b) {
					r.pb[b] = r.pb[0];
					continue;
				}
				d = n;
			}
			var P = r.pb[b];
			(P.Sc[0] = at[xr(d + t, 127)]),
				(P.Sc[1] = nt[xr(d + 0, 127)]),
				(P.Eb[0] = 2 * at[xr(d + i, 127)]),
				(P.Eb[1] = (101581 * nt[xr(d + c, 127)]) >> 16),
				8 > P.Eb[1] && (P.Eb[1] = 8),
				(P.Qc[0] = at[xr(d + s, 117)]),
				(P.Qc[1] = nt[xr(d + o, 127)]),
				(P.lc = d + o);
		}
		if (!u.Rb) return Xr(r, 4, "Not a key frame.");
		for (B(f), u = r.Pa, n = 0; 4 > n; ++n) {
			for (t = 0; 8 > t; ++t)
				for (i = 0; 3 > i; ++i)
					for (c = 0; 11 > c; ++c)
						(s = G(f, ct[n][t][i][c]) ? w(f, 8) : ut[n][t][i][c]), (u.Wc[n][t].Yb[i][c] = s);
			for (t = 0; 17 > t; ++t) u.Xc[n][t] = u.Wc[n][ot[t]];
		}
		return (r.kc = B(f)), r.kc && (r.Bd = w(f, 8)), (r.cb = 1);
	}
	function qr(r, a, n, i, t, e, f) {
		var u = a[t].Yb[n];
		for (n = 0; 16 > t; ++t) {
			if (!G(r, u[n + 0])) return t;
			for (; !G(r, u[n + 1]); ) if (((u = a[++t].Yb[0]), (n = 0), 16 == t)) return 16;
			var l = a[t + 1].Yb;
			if (G(r, u[n + 2])) {
				var c = r,
					o = 0;
				if (G(c, (h = u)[(s = n) + 3]))
					if (G(c, h[s + 6])) {
						for (
							u = 0, s = 2 * (o = G(c, h[s + 8])) + (h = G(c, h[s + 9 + o])), o = 0, h = tt[s];
							h[u];
							++u
						)
							o += o + G(c, h[u]);
						o += 3 + (8 << s);
					} else G(c, h[s + 7]) ? ((o = 7 + 2 * G(c, 165)), (o += G(c, 145))) : (o = 5 + G(c, 159));
				else o = G(c, h[s + 4]) ? 3 + G(c, h[s + 5]) : 2;
				u = l[2];
			} else (o = 1), (u = l[1]);
			(l = f + et[t]), 0 > (c = r).b && V(c);
			var s,
				h = c.b,
				b = ((s = c.Ca >> 1) - (c.I >> h)) >> 31;
			--c.b,
				(c.Ca += b),
				(c.Ca |= 1),
				(c.I -= ((s + 1) & b) << h),
				(e[l] = ((o ^ b) - b) * i[(0 < t) + 0]);
		}
		return 16;
	}
	function Qr(r) {
		var a = r.rb[r.sb - 1];
		(a.la = 0), (a.Na = 0), l(r.zc, 0, 0, r.zc.length), (r.ja = 0);
	}
	function ra(r, a, n, i, t) {
		(t = r[a + n + 32 * i] + (t >> 3)), (r[a + n + 32 * i] = -256 & t ? (0 > t ? 0 : 255) : t);
	}
	function aa(r, a, n, i, t, e) {
		ra(r, a, 0, n, i + t), ra(r, a, 1, n, i + e), ra(r, a, 2, n, i - e), ra(r, a, 3, n, i - t);
	}
	function na(r) {
		return ((20091 * r) >> 16) + r;
	}
	function ia(r, a, n, i) {
		var t,
			e = 0,
			f = c(16);
		for (t = 0; 4 > t; ++t) {
			var u = r[a + 0] + r[a + 8],
				l = r[a + 0] - r[a + 8],
				o = ((35468 * r[a + 4]) >> 16) - na(r[a + 12]),
				s = na(r[a + 4]) + ((35468 * r[a + 12]) >> 16);
			(f[e + 0] = u + s), (f[e + 1] = l + o), (f[e + 2] = l - o), (f[e + 3] = u - s), (e += 4), a++;
		}
		for (t = e = 0; 4 > t; ++t)
			(u = (r = f[e + 0] + 4) + f[e + 8]),
				(l = r - f[e + 8]),
				(o = ((35468 * f[e + 4]) >> 16) - na(f[e + 12])),
				ra(n, i, 0, 0, u + (s = na(f[e + 4]) + ((35468 * f[e + 12]) >> 16))),
				ra(n, i, 1, 0, l + o),
				ra(n, i, 2, 0, l - o),
				ra(n, i, 3, 0, u - s),
				e++,
				(i += 32);
	}
	function ta(r, a, n, i) {
		var t = r[a + 0] + 4,
			e = (35468 * r[a + 4]) >> 16,
			f = na(r[a + 4]),
			u = (35468 * r[a + 1]) >> 16;
		aa(n, i, 0, t + f, (r = na(r[a + 1])), u),
			aa(n, i, 1, t + e, r, u),
			aa(n, i, 2, t - e, r, u),
			aa(n, i, 3, t - f, r, u);
	}
	function ea(r, a, n, i, t) {
		ia(r, a, n, i), t && ia(r, a + 16, n, i + 4);
	}
	function fa(r, a, n, i) {
		fi(r, a + 0, n, i, 1), fi(r, a + 32, n, i + 128, 1);
	}
	function ua(r, a, n, i) {
		var t;
		for (r = r[a + 0] + 4, t = 0; 4 > t; ++t) for (a = 0; 4 > a; ++a) ra(n, i, a, t, r);
	}
	function la(r, a, n, i) {
		r[a + 0] && ci(r, a + 0, n, i),
			r[a + 16] && ci(r, a + 16, n, i + 4),
			r[a + 32] && ci(r, a + 32, n, i + 128),
			r[a + 48] && ci(r, a + 48, n, i + 128 + 4);
	}
	function ca(r, a, n, i) {
		var t,
			e = c(16);
		for (t = 0; 4 > t; ++t) {
			var f = r[a + 0 + t] + r[a + 12 + t],
				u = r[a + 4 + t] + r[a + 8 + t],
				l = r[a + 4 + t] - r[a + 8 + t],
				o = r[a + 0 + t] - r[a + 12 + t];
			(e[0 + t] = f + u), (e[8 + t] = f - u), (e[4 + t] = o + l), (e[12 + t] = o - l);
		}
		for (t = 0; 4 > t; ++t)
			(f = (r = e[0 + 4 * t] + 3) + e[3 + 4 * t]),
				(u = e[1 + 4 * t] + e[2 + 4 * t]),
				(l = e[1 + 4 * t] - e[2 + 4 * t]),
				(o = r - e[3 + 4 * t]),
				(n[i + 0] = (f + u) >> 3),
				(n[i + 16] = (o + l) >> 3),
				(n[i + 32] = (f - u) >> 3),
				(n[i + 48] = (o - l) >> 3),
				(i += 64);
	}
	function oa(r, a, n) {
		var i,
			t = a - 32,
			e = Fi,
			f = 255 - r[t - 1];
		for (i = 0; i < n; ++i) {
			var u,
				l = e,
				c = f + r[a - 1];
			for (u = 0; u < n; ++u) r[a + u] = l[c + r[t + u]];
			a += 32;
		}
	}
	function sa(r, a) {
		oa(r, a, 4);
	}
	function ha(r, a) {
		oa(r, a, 8);
	}
	function ba(r, a) {
		oa(r, a, 16);
	}
	function da(r, a) {
		var n;
		for (n = 0; 16 > n; ++n) u(r, a + 32 * n, r, a - 32, 16);
	}
	function va(r, a) {
		var n;
		for (n = 16; 0 < n; --n) l(r, a, r[a - 1], 16), (a += 32);
	}
	function wa(r, a, n) {
		var i;
		for (i = 0; 16 > i; ++i) l(a, n + 32 * i, r, 16);
	}
	function ga(r, a) {
		var n,
			i = 16;
		for (n = 0; 16 > n; ++n) i += r[a - 1 + 32 * n] + r[a + n - 32];
		wa(i >> 5, r, a);
	}
	function Pa(r, a) {
		var n,
			i = 8;
		for (n = 0; 16 > n; ++n) i += r[a - 1 + 32 * n];
		wa(i >> 4, r, a);
	}
	function ka(r, a) {
		var n,
			i = 8;
		for (n = 0; 16 > n; ++n) i += r[a + n - 32];
		wa(i >> 4, r, a);
	}
	function ma(r, a) {
		wa(128, r, a);
	}
	function pa(r, a, n) {
		return (r + 2 * a + n + 2) >> 2;
	}
	function Aa(r, a) {
		var n,
			i = a - 32;
		for (
			i = new Uint8Array([
				pa(r[i - 1], r[i + 0], r[i + 1]),
				pa(r[i + 0], r[i + 1], r[i + 2]),
				pa(r[i + 1], r[i + 2], r[i + 3]),
				pa(r[i + 2], r[i + 3], r[i + 4]),
			]),
				n = 0;
			4 > n;
			++n
		)
			u(r, a + 32 * n, i, 0, i.length);
	}
	function La(r, a) {
		var n = r[a - 1],
			i = r[a - 1 + 32],
			t = r[a - 1 + 64],
			e = r[a - 1 + 96];
		C(r, a + 0, 16843009 * pa(r[a - 1 - 32], n, i)),
			C(r, a + 32, 16843009 * pa(n, i, t)),
			C(r, a + 64, 16843009 * pa(i, t, e)),
			C(r, a + 96, 16843009 * pa(t, e, e));
	}
	function Ra(r, a) {
		var n,
			i = 4;
		for (n = 0; 4 > n; ++n) i += r[a + n - 32] + r[a - 1 + 32 * n];
		for (i >>= 3, n = 0; 4 > n; ++n) l(r, a + 32 * n, i, 4);
	}
	function ya(r, a) {
		var n = r[a - 1 + 0],
			i = r[a - 1 + 32],
			t = r[a - 1 + 64],
			e = r[a - 1 - 32],
			f = r[a + 0 - 32],
			u = r[a + 1 - 32],
			l = r[a + 2 - 32],
			c = r[a + 3 - 32];
		(r[a + 0 + 96] = pa(i, t, r[a - 1 + 96])),
			(r[a + 1 + 96] = r[a + 0 + 64] = pa(n, i, t)),
			(r[a + 2 + 96] = r[a + 1 + 64] = r[a + 0 + 32] = pa(e, n, i)),
			(r[a + 3 + 96] = r[a + 2 + 64] = r[a + 1 + 32] = r[a + 0 + 0] = pa(f, e, n)),
			(r[a + 3 + 64] = r[a + 2 + 32] = r[a + 1 + 0] = pa(u, f, e)),
			(r[a + 3 + 32] = r[a + 2 + 0] = pa(l, u, f)),
			(r[a + 3 + 0] = pa(c, l, u));
	}
	function _a(r, a) {
		var n = r[a + 1 - 32],
			i = r[a + 2 - 32],
			t = r[a + 3 - 32],
			e = r[a + 4 - 32],
			f = r[a + 5 - 32],
			u = r[a + 6 - 32],
			l = r[a + 7 - 32];
		(r[a + 0 + 0] = pa(r[a + 0 - 32], n, i)),
			(r[a + 1 + 0] = r[a + 0 + 32] = pa(n, i, t)),
			(r[a + 2 + 0] = r[a + 1 + 32] = r[a + 0 + 64] = pa(i, t, e)),
			(r[a + 3 + 0] = r[a + 2 + 32] = r[a + 1 + 64] = r[a + 0 + 96] = pa(t, e, f)),
			(r[a + 3 + 32] = r[a + 2 + 64] = r[a + 1 + 96] = pa(e, f, u)),
			(r[a + 3 + 64] = r[a + 2 + 96] = pa(f, u, l)),
			(r[a + 3 + 96] = pa(u, l, l));
	}
	function Va(r, a) {
		var n = r[a - 1 + 0],
			i = r[a - 1 + 32],
			t = r[a - 1 + 64],
			e = r[a - 1 - 32],
			f = r[a + 0 - 32],
			u = r[a + 1 - 32],
			l = r[a + 2 - 32],
			c = r[a + 3 - 32];
		(r[a + 0 + 0] = r[a + 1 + 64] = (e + f + 1) >> 1),
			(r[a + 1 + 0] = r[a + 2 + 64] = (f + u + 1) >> 1),
			(r[a + 2 + 0] = r[a + 3 + 64] = (u + l + 1) >> 1),
			(r[a + 3 + 0] = (l + c + 1) >> 1),
			(r[a + 0 + 96] = pa(t, i, n)),
			(r[a + 0 + 64] = pa(i, n, e)),
			(r[a + 0 + 32] = r[a + 1 + 96] = pa(n, e, f)),
			(r[a + 1 + 32] = r[a + 2 + 96] = pa(e, f, u)),
			(r[a + 2 + 32] = r[a + 3 + 96] = pa(f, u, l)),
			(r[a + 3 + 32] = pa(u, l, c));
	}
	function Ba(r, a) {
		var n = r[a + 0 - 32],
			i = r[a + 1 - 32],
			t = r[a + 2 - 32],
			e = r[a + 3 - 32],
			f = r[a + 4 - 32],
			u = r[a + 5 - 32],
			l = r[a + 6 - 32],
			c = r[a + 7 - 32];
		(r[a + 0 + 0] = (n + i + 1) >> 1),
			(r[a + 1 + 0] = r[a + 0 + 64] = (i + t + 1) >> 1),
			(r[a + 2 + 0] = r[a + 1 + 64] = (t + e + 1) >> 1),
			(r[a + 3 + 0] = r[a + 2 + 64] = (e + f + 1) >> 1),
			(r[a + 0 + 32] = pa(n, i, t)),
			(r[a + 1 + 32] = r[a + 0 + 96] = pa(i, t, e)),
			(r[a + 2 + 32] = r[a + 1 + 96] = pa(t, e, f)),
			(r[a + 3 + 32] = r[a + 2 + 96] = pa(e, f, u)),
			(r[a + 3 + 64] = pa(f, u, l)),
			(r[a + 3 + 96] = pa(u, l, c));
	}
	function Ga(r, a) {
		var n = r[a - 1 + 0],
			i = r[a - 1 + 32],
			t = r[a - 1 + 64],
			e = r[a - 1 + 96];
		(r[a + 0 + 0] = (n + i + 1) >> 1),
			(r[a + 2 + 0] = r[a + 0 + 32] = (i + t + 1) >> 1),
			(r[a + 2 + 32] = r[a + 0 + 64] = (t + e + 1) >> 1),
			(r[a + 1 + 0] = pa(n, i, t)),
			(r[a + 3 + 0] = r[a + 1 + 32] = pa(i, t, e)),
			(r[a + 3 + 32] = r[a + 1 + 64] = pa(t, e, e)),
			(r[a + 3 + 64] =
				r[a + 2 + 64] =
				r[a + 0 + 96] =
				r[a + 1 + 96] =
				r[a + 2 + 96] =
				r[a + 3 + 96] =
					e);
	}
	function Ca(r, a) {
		var n = r[a - 1 + 0],
			i = r[a - 1 + 32],
			t = r[a - 1 + 64],
			e = r[a - 1 + 96],
			f = r[a - 1 - 32],
			u = r[a + 0 - 32],
			l = r[a + 1 - 32],
			c = r[a + 2 - 32];
		(r[a + 0 + 0] = r[a + 2 + 32] = (n + f + 1) >> 1),
			(r[a + 0 + 32] = r[a + 2 + 64] = (i + n + 1) >> 1),
			(r[a + 0 + 64] = r[a + 2 + 96] = (t + i + 1) >> 1),
			(r[a + 0 + 96] = (e + t + 1) >> 1),
			(r[a + 3 + 0] = pa(u, l, c)),
			(r[a + 2 + 0] = pa(f, u, l)),
			(r[a + 1 + 0] = r[a + 3 + 32] = pa(n, f, u)),
			(r[a + 1 + 32] = r[a + 3 + 64] = pa(i, n, f)),
			(r[a + 1 + 64] = r[a + 3 + 96] = pa(t, i, n)),
			(r[a + 1 + 96] = pa(e, t, i));
	}
	function Ia(r, a) {
		var n;
		for (n = 0; 8 > n; ++n) u(r, a + 32 * n, r, a - 32, 8);
	}
	function Ua(r, a) {
		var n;
		for (n = 0; 8 > n; ++n) l(r, a, r[a - 1], 8), (a += 32);
	}
	function Ma(r, a, n) {
		var i;
		for (i = 0; 8 > i; ++i) l(a, n + 32 * i, r, 8);
	}
	function Fa(r, a) {
		var n,
			i = 8;
		for (n = 0; 8 > n; ++n) i += r[a + n - 32] + r[a - 1 + 32 * n];
		Ma(i >> 4, r, a);
	}
	function ja(r, a) {
		var n,
			i = 4;
		for (n = 0; 8 > n; ++n) i += r[a + n - 32];
		Ma(i >> 3, r, a);
	}
	function Oa(r, a) {
		var n,
			i = 4;
		for (n = 0; 8 > n; ++n) i += r[a - 1 + 32 * n];
		Ma(i >> 3, r, a);
	}
	function Sa(r, a) {
		Ma(128, r, a);
	}
	function Ta(r, a, n) {
		var i = r[a - n],
			t = r[a + 0],
			e = 3 * (t - i) + Ui[1020 + r[a - 2 * n] - r[a + n]],
			f = Mi[112 + ((e + 4) >> 3)];
		(r[a - n] = Fi[255 + i + Mi[112 + ((e + 3) >> 3)]]), (r[a + 0] = Fi[255 + t - f]);
	}
	function Ha(r, a, n, i) {
		var t = r[a + 0],
			e = r[a + n];
		return ji[255 + r[a - 2 * n] - r[a - n]] > i || ji[255 + e - t] > i;
	}
	function Da(r, a, n, i) {
		return 4 * ji[255 + r[a - n] - r[a + 0]] + ji[255 + r[a - 2 * n] - r[a + n]] <= i;
	}
	function Wa(r, a, n, i, t) {
		var e = r[a - 3 * n],
			f = r[a - 2 * n],
			u = r[a - n],
			l = r[a + 0],
			c = r[a + n],
			o = r[a + 2 * n],
			s = r[a + 3 * n];
		return 4 * ji[255 + u - l] + ji[255 + f - c] > i
			? 0
			: ji[255 + r[a - 4 * n] - e] <= t &&
					ji[255 + e - f] <= t &&
					ji[255 + f - u] <= t &&
					ji[255 + s - o] <= t &&
					ji[255 + o - c] <= t &&
					ji[255 + c - l] <= t;
	}
	function Ka(r, a, n, i) {
		var t = 2 * i + 1;
		for (i = 0; 16 > i; ++i) Da(r, a + i, n, t) && Ta(r, a + i, n);
	}
	function Na(r, a, n, i) {
		var t = 2 * i + 1;
		for (i = 0; 16 > i; ++i) Da(r, a + i * n, 1, t) && Ta(r, a + i * n, 1);
	}
	function Ya(r, a, n, i) {
		var t;
		for (t = 3; 0 < t; --t) Ka(r, (a += 4 * n), n, i);
	}
	function Ja(r, a, n, i) {
		var t;
		for (t = 3; 0 < t; --t) Na(r, (a += 4), n, i);
	}
	function xa(r, a, n, i, t, e, f, u) {
		for (e = 2 * e + 1; 0 < t--; ) {
			if (Wa(r, a, n, e, f))
				if (Ha(r, a, n, u)) Ta(r, a, n);
				else {
					var l = r,
						c = a,
						o = n,
						s = l[c - 2 * o],
						h = l[c - o],
						b = l[c + 0],
						d = l[c + o],
						v = l[c + 2 * o],
						w = (27 * (P = Ui[1020 + 3 * (b - h) + Ui[1020 + s - d]]) + 63) >> 7,
						g = (18 * P + 63) >> 7,
						P = (9 * P + 63) >> 7;
					(l[c - 3 * o] = Fi[255 + l[c - 3 * o] + P]),
						(l[c - 2 * o] = Fi[255 + s + g]),
						(l[c - o] = Fi[255 + h + w]),
						(l[c + 0] = Fi[255 + b - w]),
						(l[c + o] = Fi[255 + d - g]),
						(l[c + 2 * o] = Fi[255 + v - P]);
				}
			a += i;
		}
	}
	function za(r, a, n, i, t, e, f, u) {
		for (e = 2 * e + 1; 0 < t--; ) {
			if (Wa(r, a, n, e, f))
				if (Ha(r, a, n, u)) Ta(r, a, n);
				else {
					var l = r,
						c = a,
						o = n,
						s = l[c - o],
						h = l[c + 0],
						b = l[c + o],
						d = Mi[112 + ((4 + (v = 3 * (h - s))) >> 3)],
						v = Mi[112 + ((v + 3) >> 3)],
						w = (d + 1) >> 1;
					(l[c - 2 * o] = Fi[255 + l[c - 2 * o] + w]),
						(l[c - o] = Fi[255 + s + v]),
						(l[c + 0] = Fi[255 + h - d]),
						(l[c + o] = Fi[255 + b - w]);
				}
			a += i;
		}
	}
	function Ea(r, a, n, i, t, e) {
		xa(r, a, n, 1, 16, i, t, e);
	}
	function Xa(r, a, n, i, t, e) {
		xa(r, a, 1, n, 16, i, t, e);
	}
	function $a(r, a, n, i, t, e) {
		var f;
		for (f = 3; 0 < f; --f) za(r, (a += 4 * n), n, 1, 16, i, t, e);
	}
	function Za(r, a, n, i, t, e) {
		var f;
		for (f = 3; 0 < f; --f) za(r, (a += 4), 1, n, 16, i, t, e);
	}
	function qa(r, a, n, i, t, e, f, u) {
		xa(r, a, t, 1, 8, e, f, u), xa(n, i, t, 1, 8, e, f, u);
	}
	function Qa(r, a, n, i, t, e, f, u) {
		xa(r, a, 1, t, 8, e, f, u), xa(n, i, 1, t, 8, e, f, u);
	}
	function rn(r, a, n, i, t, e, f, u) {
		za(r, a + 4 * t, t, 1, 8, e, f, u), za(n, i + 4 * t, t, 1, 8, e, f, u);
	}
	function an(r, a, n, i, t, e, f, u) {
		za(r, a + 4, 1, t, 8, e, f, u), za(n, i + 4, 1, t, 8, e, f, u);
	}
	function nn() {
		(this.ba = new ur()),
			(this.ec = []),
			(this.cc = []),
			(this.Mc = []),
			(this.Dc = this.Nc = this.dc = this.fc = 0),
			(this.Oa = new cr()),
			(this.memory = 0),
			(this.Ib = "OutputFunc"),
			(this.Jb = "OutputAlphaFunc"),
			(this.Nd = "OutputRowFunc");
	}
	function tn() {
		(this.data = []),
			(this.offset = this.kd = this.ha = this.w = 0),
			(this.na = []),
			(this.xa = this.gb = this.Ja = this.Sa = this.P = 0);
	}
	function en() {
		(this.nc = this.Ea = this.b = this.hc = 0), (this.K = []), (this.w = 0);
	}
	function fn() {
		(this.ua = 0),
			(this.Wa = new O()),
			(this.vb = new O()),
			(this.md = this.xc = this.wc = 0),
			(this.vc = []),
			(this.Wb = 0),
			(this.Ya = new d()),
			(this.yc = new h());
	}
	function un() {
		(this.xb = this.a = 0),
			(this.l = new zr()),
			(this.ca = new ur()),
			(this.V = []),
			(this.Ba = 0),
			(this.Ta = []),
			(this.Ua = 0),
			(this.m = new A()),
			(this.Pb = 0),
			(this.wd = new A()),
			(this.Ma = this.$ = this.C = this.i = this.c = this.xd = 0),
			(this.s = new fn()),
			(this.ab = 0),
			(this.gc = o(4, en)),
			(this.Oc = 0);
	}
	function ln() {
		(this.Lc = this.Z = this.$a = this.i = this.c = 0),
			(this.l = new zr()),
			(this.ic = 0),
			(this.ca = []),
			(this.tb = 0),
			(this.qd = null),
			(this.rd = 0);
	}
	function cn(r, a, n, i, t, e, f) {
		for (r = null == r ? 0 : r[a + 0], a = 0; a < f; ++a)
			(t[e + a] = (r + n[i + a]) & 255), (r = t[e + a]);
	}
	function on(r, a, n, i, t, e, f) {
		var u;
		if (null == r) cn(null, null, n, i, t, e, f);
		else for (u = 0; u < f; ++u) t[e + u] = (r[a + u] + n[i + u]) & 255;
	}
	function sn(r, a, n, i, t, e, f) {
		if (null == r) cn(null, null, n, i, t, e, f);
		else {
			var u,
				l = r[a + 0],
				c = l,
				o = l;
			for (u = 0; u < f; ++u)
				(c = o + (l = r[a + u]) - c),
					(o = (n[i + u] + (-256 & c ? (0 > c ? 0 : 255) : c)) & 255),
					(c = l),
					(t[e + u] = o);
		}
	}
	function hn(r, a, n, i) {
		var t = a.width,
			f = a.o;
		if ((e(null != r && null != a), 0 > n || 0 >= i || n + i > f)) return null;
		if (!r.Cc) {
			if (null == r.ga) {
				var l;
				if (
					((r.ga = new ln()),
					(l = null == r.ga) ||
						((l = a.width * a.o),
						e(0 == r.Gb.length),
						(r.Gb = c(l)),
						(r.Uc = 0),
						null == r.Gb ? (l = 0) : ((r.mb = r.Gb), (r.nb = r.Uc), (r.rc = null), (l = 1)),
						(l = !l)),
					!l)
				) {
					l = r.ga;
					var o = r.Fa,
						s = r.P,
						h = r.qc,
						b = r.mb,
						d = r.nb,
						v = s + 1,
						w = h - 1,
						g = l.l;
					if (
						(e(null != o && null != b && null != a),
						(wt[0] = null),
						(wt[1] = cn),
						(wt[2] = on),
						(wt[3] = sn),
						(l.ca = b),
						(l.tb = d),
						(l.c = a.width),
						(l.i = a.height),
						e(0 < l.c && 0 < l.i),
						1 >= h)
					)
						a = 0;
					else if (
						((l.$a = (o[s + 0] >> 0) & 3),
						(l.Z = (o[s + 0] >> 2) & 3),
						(l.Lc = (o[s + 0] >> 4) & 3),
						(s = (o[s + 0] >> 6) & 3),
						0 > l.$a || 1 < l.$a || 4 <= l.Z || 1 < l.Lc || s)
					)
						a = 0;
					else if (
						((g.put = dr),
						(g.ac = br),
						(g.bc = vr),
						(g.ma = l),
						(g.width = a.width),
						(g.height = a.height),
						(g.Da = a.Da),
						(g.v = a.v),
						(g.va = a.va),
						(g.j = a.j),
						(g.o = a.o),
						l.$a)
					)
						r: {
							e(1 == l.$a), (a = Gr());
							a: for (;;) {
								if (null == a) {
									a = 0;
									break r;
								}
								if (
									(e(null != l),
									(l.mc = a),
									(a.c = l.c),
									(a.i = l.i),
									(a.l = l.l),
									(a.l.ma = l),
									(a.l.width = l.c),
									(a.l.height = l.i),
									(a.a = 0),
									P(a.m, o, v, w),
									!Cr(l.c, l.i, 1, a, null))
								)
									break a;
								if (
									(1 == a.ab && 3 == a.gc[0].hc && Rr(a.s)
										? ((l.ic = 1),
										  (o = a.c * a.i),
										  (a.Ta = null),
										  (a.Ua = 0),
										  (a.V = c(o)),
										  (a.Ba = 0),
										  null == a.V ? ((a.a = 1), (a = 0)) : (a = 1))
										: ((l.ic = 0), (a = Ir(a, l.c))),
									!a)
								)
									break a;
								a = 1;
								break r;
							}
							(l.mc = null), (a = 0);
						}
					else a = w >= l.c * l.i;
					l = !a;
				}
				if (l) return null;
				1 != r.ga.Lc ? (r.Ga = 0) : (i = f - n);
			}
			e(null != r.ga), e(n + i <= f);
			r: {
				if (((a = (o = r.ga).c), (f = o.l.o), 0 == o.$a)) {
					if (
						((v = r.rc),
						(w = r.Vc),
						(g = r.Fa),
						(s = r.P + 1 + n * a),
						(h = r.mb),
						(b = r.nb + n * a),
						e(s <= r.P + r.qc),
						0 != o.Z)
					)
						for (e(null != wt[o.Z]), l = 0; l < i; ++l)
							wt[o.Z](v, w, g, s, h, b, a), (v = h), (w = b), (b += a), (s += a);
					else for (l = 0; l < i; ++l) u(h, b, g, s, a), (v = h), (w = b), (b += a), (s += a);
					(r.rc = v), (r.Vc = w);
				} else {
					if ((e(null != o.mc), (a = n + i), e(null != (l = o.mc)), e(a <= l.i), l.C >= a)) a = 1;
					else if ((o.ic || gn(), o.ic)) {
						(o = l.V), (v = l.Ba), (w = l.c);
						var k = l.i,
							m = ((g = 1), (s = l.$ / w), (h = l.$ % w), (b = l.m), (d = l.s), l.$),
							p = w * k,
							A = w * a,
							L = d.wc,
							y = m < A ? pr(d, h, s) : null;
						e(m <= p), e(a <= k), e(Rr(d));
						a: for (;;) {
							for (; !b.h && m < A; ) {
								if (
									(h & L || (y = pr(d, h, s)),
									e(null != y),
									_(b),
									256 > (k = kr(y.G[0], y.H[0], b)))
								)
									(o[v + m] = k), ++m, ++h >= w && ((h = 0), ++s <= a && !(s % 16) && _r(l, s));
								else {
									if (!(280 > k)) {
										g = 0;
										break a;
									}
									k = gr(k - 256, b);
									var V,
										B = kr(y.G[4], y.H[4], b);
									if ((_(b), !(m >= (B = Pr(w, (B = gr(B, b)))) && p - m >= k))) {
										g = 0;
										break a;
									}
									for (V = 0; V < k; ++V) o[v + m + V] = o[v + m + V - B];
									for (m += k, h += k; h >= w; ) (h -= w), ++s <= a && !(s % 16) && _r(l, s);
									m < A && h & L && (y = pr(d, h, s));
								}
								e(b.h == R(b));
							}
							_r(l, s > a ? a : s);
							break a;
						}
						!g || (b.h && m < p) ? ((g = 0), (l.a = b.h ? 5 : 3)) : (l.$ = m), (a = g);
					} else a = Vr(l, l.V, l.Ba, l.c, l.i, a, Ur);
					if (!a) {
						i = 0;
						break r;
					}
				}
				n + i >= f && (r.Cc = 1), (i = 1);
			}
			if (!i) return null;
			if (r.Cc && (null != (i = r.ga) && (i.mc = null), (r.ga = null), 0 < r.Ga)) {
				// (3)`Stickers decoder: SWebPDequantizeLevels`
				console.info(`Stickers decoder: SWebPDequantizeLevels`);

				return null;
			}
		}
		return r.nb + n * t;
	}
	function bn(r, a, n, i, t, e) {
		for (; 0 < t--; ) {
			var f,
				u = r,
				l = a + (n ? 1 : 0),
				c = r,
				o = a + (n ? 0 : 3);
			for (f = 0; f < i; ++f) {
				var s = c[o + 4 * f];
				255 != s &&
					((s *= 32897),
					(u[l + 4 * f + 0] = (u[l + 4 * f + 0] * s) >> 23),
					(u[l + 4 * f + 1] = (u[l + 4 * f + 1] * s) >> 23),
					(u[l + 4 * f + 2] = (u[l + 4 * f + 2] * s) >> 23));
			}
			a += e;
		}
	}
	function dn(r, a, n, i, t) {
		for (; 0 < i--; ) {
			var e;
			for (e = 0; e < n; ++e) {
				var f = r[a + 2 * e + 0],
					u = 15 & (c = r[a + 2 * e + 1]),
					l = 4369 * u,
					c = (((240 & c) | (c >> 4)) * l) >> 16;
				(r[a + 2 * e + 0] =
					(((((240 & f) | (f >> 4)) * l) >> 16) & 240) |
					((((((15 & f) | (f << 4)) * l) >> 16) >> 4) & 15)),
					(r[a + 2 * e + 1] = (240 & c) | u);
			}
			a += t;
		}
	}
	function vn(r, a, n, i, t, e, f, u) {
		var l,
			c,
			o = 255;
		for (c = 0; c < t; ++c) {
			for (l = 0; l < i; ++l) {
				var s = r[a + l];
				(e[f + 4 * l] = s), (o &= s);
			}
			(a += n), (f += u);
		}
		return 255 != o;
	}
	function wn(r, a, n, i, t) {
		var e;
		for (e = 0; e < t; ++e) n[i + e] = r[a + e] >> 8;
	}
	function gn() {
		(Li = bn), (Ri = dn), (yi = vn), (_i = wn);
	}
	function Pn(r, a, n) {
		t[r] = function (r, i, t, f, u, l, c, o, s, h, b, d, v, w, g, P, k) {
			var m,
				p = (k - 1) >> 1,
				A = u[l + 0] | (c[o + 0] << 16),
				L = s[h + 0] | (b[d + 0] << 16);
			e(null != r);
			var R = (3 * A + L + 131074) >> 2;
			for (
				a(r[i + 0], 255 & R, R >> 16, v, w),
					null != t && ((R = (3 * L + A + 131074) >> 2), a(t[f + 0], 255 & R, R >> 16, g, P)),
					m = 1;
				m <= p;
				++m
			) {
				var y = u[l + m] | (c[o + m] << 16),
					_ = s[h + m] | (b[d + m] << 16),
					V = A + y + L + _ + 524296,
					B = (V + 2 * (y + L)) >> 3;
				(R = (B + A) >> 1),
					(A = ((V = (V + 2 * (A + _)) >> 3) + y) >> 1),
					a(r[i + 2 * m - 1], 255 & R, R >> 16, v, w + (2 * m - 1) * n),
					a(r[i + 2 * m - 0], 255 & A, A >> 16, v, w + (2 * m - 0) * n),
					null != t &&
						((R = (V + L) >> 1),
						(A = (B + _) >> 1),
						a(t[f + 2 * m - 1], 255 & R, R >> 16, g, P + (2 * m - 1) * n),
						a(t[f + 2 * m + 0], 255 & A, A >> 16, g, P + (2 * m + 0) * n)),
					(A = y),
					(L = _);
			}
			1 & k ||
				((R = (3 * A + L + 131074) >> 2),
				a(r[i + k - 1], 255 & R, R >> 16, v, w + (k - 1) * n),
				null != t &&
					((R = (3 * L + A + 131074) >> 2), a(t[f + k - 1], 255 & R, R >> 16, g, P + (k - 1) * n)));
		};
	}
	function kn() {
		(gt[Oi] = Pt),
			(gt[Si] = mt),
			(gt[Ti] = kt),
			(gt[Hi] = pt),
			(gt[Di] = At),
			(gt[Wi] = Lt),
			(gt[Ki] = Rt),
			(gt[Ni] = mt),
			(gt[Yi] = pt),
			(gt[Ji] = At),
			(gt[xi] = Lt);
	}
	function mn(r) {
		return r & ~Ct ? (0 > r ? 0 : 255) : r >> Gt;
	}
	function pn(r, a) {
		return mn(((19077 * r) >> 8) + ((26149 * a) >> 8) - 14234);
	}
	function An(r, a, n) {
		return mn(((19077 * r) >> 8) - ((6419 * a) >> 8) - ((13320 * n) >> 8) + 8708);
	}
	function Ln(r, a) {
		return mn(((19077 * r) >> 8) + ((33050 * a) >> 8) - 17685);
	}
	function Rn(r, a, n, i, t) {
		(i[t + 0] = pn(r, n)), (i[t + 1] = An(r, a, n)), (i[t + 2] = Ln(r, a));
	}
	function yn(r, a, n, i, t) {
		(i[t + 0] = Ln(r, a)), (i[t + 1] = An(r, a, n)), (i[t + 2] = pn(r, n));
	}
	function _n(r, a, n, i, t) {
		var e = An(r, a, n);
		(a = ((e << 3) & 224) | (Ln(r, a) >> 3)),
			(i[t + 0] = (248 & pn(r, n)) | (e >> 5)),
			(i[t + 1] = a);
	}
	function Vn(r, a, n, i, t) {
		var e = (240 & Ln(r, a)) | 15;
		(i[t + 0] = (240 & pn(r, n)) | (An(r, a, n) >> 4)), (i[t + 1] = e);
	}
	function Bn(r, a, n, i, t) {
		(i[t + 0] = 255), Rn(r, a, n, i, t + 1);
	}
	function Gn(r, a, n, i, t) {
		yn(r, a, n, i, t), (i[t + 3] = 255);
	}
	function Cn(r, a, n, i, t) {
		Rn(r, a, n, i, t), (i[t + 3] = 255);
	}
	function xr(r, a) {
		return 0 > r ? 0 : r > a ? a : r;
	}
	function In(r, a, n) {
		t[r] = function (r, i, t, e, f, u, l, c, o) {
			for (var s = c + (-2 & o) * n; c != s; )
				a(r[i + 0], t[e + 0], f[u + 0], l, c),
					a(r[i + 1], t[e + 0], f[u + 0], l, c + n),
					(i += 2),
					++e,
					++u,
					(c += 2 * n);
			1 & o && a(r[i + 0], t[e + 0], f[u + 0], l, c);
		};
	}
	function Un(r, a, n) {
		return 0 == n ? (0 == r ? (0 == a ? 6 : 5) : 0 == a ? 4 : 0) : n;
	}
	function Mn(r, a, n, i, t) {
		switch (r >>> 30) {
			case 3:
				fi(a, n, i, t, 0);
				break;
			case 2:
				ui(a, n, i, t);
				break;
			case 1:
				ci(a, n, i, t);
		}
	}
	function Fn(r, a) {
		var n,
			i,
			t = a.M,
			e = a.Nb,
			f = r.oc,
			c = r.pc + 40,
			o = r.oc,
			s = r.pc + 584,
			h = r.oc,
			b = r.pc + 600;
		for (n = 0; 16 > n; ++n) f[c + 32 * n - 1] = 129;
		for (n = 0; 8 > n; ++n) (o[s + 32 * n - 1] = 129), (h[b + 32 * n - 1] = 129);
		for (
			0 < t
				? (f[c - 1 - 32] = o[s - 1 - 32] = h[b - 1 - 32] = 129)
				: (l(f, c - 32 - 1, 127, 21), l(o, s - 32 - 1, 127, 9), l(h, b - 32 - 1, 127, 9)),
				i = 0;
			i < r.za;
			++i
		) {
			var d = a.ya[a.aa + i];
			if (0 < i) {
				for (n = -1; 16 > n; ++n) u(f, c + 32 * n - 4, f, c + 32 * n + 12, 4);
				for (n = -1; 8 > n; ++n)
					u(o, s + 32 * n - 4, o, s + 32 * n + 4, 4), u(h, b + 32 * n - 4, h, b + 32 * n + 4, 4);
			}
			var v = r.Gd,
				w = r.Hd + i,
				g = d.ad,
				P = d.Hc;
			if (
				(0 < t &&
					(u(f, c - 32, v[w].y, 0, 16), u(o, s - 32, v[w].f, 0, 8), u(h, b - 32, v[w].ea, 0, 8)),
				d.Za)
			) {
				var k = f,
					m = c - 32 + 16;
				for (
					0 < t && (i >= r.za - 1 ? l(k, m, v[w].y[15], 4) : u(k, m, v[w + 1].y, 0, 4)), n = 0;
					4 > n;
					n++
				)
					k[m + 128 + n] = k[m + 256 + n] = k[m + 384 + n] = k[m + 0 + n];
				for (n = 0; 16 > n; ++n, P <<= 2)
					(k = f), (m = c + Tt[n]), ht[d.Ob[n]](k, m), Mn(P, g, 16 * +n, k, m);
			} else if (((k = Un(i, t, d.Ob[0])), st[k](f, c), 0 != P))
				for (n = 0; 16 > n; ++n, P <<= 2) Mn(P, g, 16 * +n, f, c + Tt[n]);
			for (
				n = d.Gc,
					k = Un(i, t, d.Dd),
					bt[k](o, s),
					bt[k](h, b),
					P = g,
					k = o,
					m = s,
					255 & (d = n >> 0) && (170 & d ? li(P, 256, k, m) : oi(P, 256, k, m)),
					d = h,
					P = b,
					255 & (n >>= 8) && (170 & n ? li(g, 320, d, P) : oi(g, 320, d, P)),
					t < r.Ub - 1 &&
						(u(v[w].y, 0, f, c + 480, 16),
						u(v[w].f, 0, o, s + 224, 8),
						u(v[w].ea, 0, h, b + 224, 8)),
					n = 8 * e * r.B,
					v = r.sa,
					w = r.ta + 16 * i + 16 * e * r.R,
					g = r.qa,
					d = r.ra + 8 * i + n,
					P = r.Ha,
					k = r.Ia + 8 * i + n,
					n = 0;
				16 > n;
				++n
			)
				u(v, w + n * r.R, f, c + 32 * n, 16);
			for (n = 0; 8 > n; ++n)
				u(g, d + n * r.B, o, s + 32 * n, 8), u(P, k + n * r.B, h, b + 32 * n, 8);
		}
	}
	function jn(r, a, n, i, t, u, l, c, o) {
		var s = [0],
			h = [0],
			b = 0,
			d = null != o ? o.kd : 0,
			v = null != o ? o : new tn();
		if (null == r || 12 > n) return 7;
		(v.data = r), (v.w = a), (v.ha = n), (a = [a]), (n = [n]), (v.gb = [v.gb]);
		r: {
			var w = a,
				g = n,
				k = v.gb;
			if (
				(e(null != r), e(null != g), e(null != k), (k[0] = 0), 12 <= g[0] && !f(r, w[0], "RIFF"))
			) {
				if (f(r, w[0] + 8, "WEBP")) {
					k = 3;
					break r;
				}
				var m = M(r, w[0] + 4);
				if (12 > m || 4294967286 < m) {
					k = 3;
					break r;
				}
				if (d && m > g[0] - 8) {
					k = 7;
					break r;
				}
				(k[0] = m), (w[0] += 12), (g[0] -= 12);
			}
			k = 0;
		}
		if (0 != k) return k;
		for (m = 0 < v.gb[0], n = n[0]; ; ) {
			r: {
				var p = r;
				(g = a), (k = n);
				var L = s,
					R = h,
					y = (w = [0]);
				if ((((B = b = [b])[0] = 0), 8 > k[0])) k = 7;
				else {
					if (!f(p, g[0], "VP8X")) {
						if (10 != M(p, g[0] + 4)) {
							k = 3;
							break r;
						}
						if (18 > k[0]) {
							k = 7;
							break r;
						}
						var _ = M(p, g[0] + 8),
							V = 1 + U(p, g[0] + 12);
						if (2147483648 <= V * (p = 1 + U(p, g[0] + 15))) {
							k = 3;
							break r;
						}
						null != y && (y[0] = _),
							null != L && (L[0] = V),
							null != R && (R[0] = p),
							(g[0] += 18),
							(k[0] -= 18),
							(B[0] = 1);
					}
					k = 0;
				}
			}
			if (((b = b[0]), (w = w[0]), 0 != k)) return k;
			if (((g = !!(2 & w)), !m && b)) return 3;
			if (
				(null != u && (u[0] = !!(16 & w)),
				null != l && (l[0] = g),
				null != c && (c[0] = 0),
				(l = s[0]),
				(w = h[0]),
				b && g && null == o)
			) {
				k = 0;
				break;
			}
			if (4 > n) {
				k = 7;
				break;
			}
			if ((m && b) || (!m && !b && !f(r, a[0], "ALPH"))) {
				(n = [n]), (v.na = [v.na]), (v.P = [v.P]), (v.Sa = [v.Sa]);
				r: {
					(_ = r), (k = a), (m = n);
					var B = v.gb;
					(L = v.na), (R = v.P), (y = v.Sa), (V = 22), e(null != _), e(null != m), (p = k[0]);
					var G = m[0];
					for (e(null != L), e(null != y), L[0] = null, R[0] = null, y[0] = 0; ; ) {
						if (((k[0] = p), (m[0] = G), 8 > G)) {
							k = 7;
							break r;
						}
						var C = M(_, p + 4);
						if (4294967286 < C) {
							k = 3;
							break r;
						}
						var I = (8 + C + 1) & -2;
						if (((V += I), 0 < B && V > B)) {
							k = 3;
							break r;
						}
						if (!f(_, p, "VP8 ") || !f(_, p, "VP8L")) {
							k = 0;
							break r;
						}
						if (G[0] < I) {
							k = 7;
							break r;
						}
						f(_, p, "ALPH") || ((L[0] = _), (R[0] = p + 8), (y[0] = C)), (p += I), (G -= I);
					}
				}
				if (((n = n[0]), (v.na = v.na[0]), (v.P = v.P[0]), (v.Sa = v.Sa[0]), 0 != k)) break;
			}
			(n = [n]), (v.Ja = [v.Ja]), (v.xa = [v.xa]);
			r: if (
				((B = r),
				(k = a),
				(m = n),
				(L = v.gb[0]),
				(R = v.Ja),
				(y = v.xa),
				(_ = k[0]),
				(p = !f(B, _, "VP8 ")),
				(V = !f(B, _, "VP8L")),
				e(null != B),
				e(null != m),
				e(null != R),
				e(null != y),
				8 > m[0])
			)
				k = 7;
			else {
				if (p || V) {
					if (((B = M(B, _ + 4)), 12 <= L && B > L - 12)) {
						k = 3;
						break r;
					}
					if (d && B > m[0] - 8) {
						k = 7;
						break r;
					}
					(R[0] = B), (k[0] += 8), (m[0] -= 8), (y[0] = V);
				} else (y[0] = 5 <= m[0] && 47 == B[_ + 0] && !(B[_ + 4] >> 5)), (R[0] = m[0]);
				k = 0;
			}
			if (((n = n[0]), (v.Ja = v.Ja[0]), (v.xa = v.xa[0]), (a = a[0]), 0 != k)) break;
			if (4294967286 < v.Ja) return 3;
			if ((null == c || g || (c[0] = v.xa ? 2 : 1), (l = [l]), (w = [w]), v.xa)) {
				if (5 > n) {
					k = 7;
					break;
				}
				(c = l),
					(d = w),
					(g = u),
					null == r || 5 > n
						? (r = 0)
						: 5 <= n && 47 == r[a + 0] && !(r[a + 4] >> 5)
						? ((m = [0]),
						  (B = [0]),
						  (L = [0]),
						  P((R = new A()), r, a, n),
						  wr(R, m, B, L)
								? (null != c && (c[0] = m[0]),
								  null != d && (d[0] = B[0]),
								  null != g && (g[0] = L[0]),
								  (r = 1))
								: (r = 0))
						: (r = 0);
			} else {
				if (10 > n) {
					k = 7;
					break;
				}
				(c = w),
					null == r || 10 > n || !$r(r, a + 3, n - 3)
						? (r = 0)
						: ((d = r[a + 0] | (r[a + 1] << 8) | (r[a + 2] << 16)),
						  (g = 16383 & ((r[a + 7] << 8) | r[a + 6])),
						  (r = 16383 & ((r[a + 9] << 8) | r[a + 8])),
						  1 & d || 3 < ((d >> 1) & 7) || !((d >> 4) & 1) || d >> 5 >= v.Ja || !g || !r
								? (r = 0)
								: (l && (l[0] = g), c && (c[0] = r), (r = 1)));
			}
			if (!r) return 3;
			if (((l = l[0]), (w = w[0]), b && (s[0] != l || h[0] != w))) return 3;
			null != o &&
				((o[0] = v), (o.offset = a - o.w), e(4294967286 > a - o.w), e(o.offset == o.ha - n));
			break;
		}
		return 0 == k || (7 == k && b && null == o)
			? (null != u && (u[0] |= null != v.na && 0 < v.na.length),
			  null != i && (i[0] = l),
			  null != t && (t[0] = w),
			  0)
			: k;
	}
	function On(r, a, n) {
		var i = a.width,
			t = a.height,
			e = 0,
			f = 0,
			u = i,
			l = t;
		if (
			((a.Da = null != r && 0 < r.Da),
			a.Da &&
				((u = r.cd),
				(l = r.bd),
				(e = r.v),
				(f = r.j),
				11 > n || ((e &= -2), (f &= -2)),
				0 > e || 0 > f || 0 >= u || 0 >= l || e + u > i || f + l > t))
		)
			return 0;
		if (
			((a.v = e),
			(a.j = f),
			(a.va = e + u),
			(a.o = f + l),
			(a.U = u),
			(a.T = l),
			(a.da = null != r && 0 < r.da),
			a.da)
		) {
			if (!S(u, l, (n = [r.ib]), (e = [r.hb]))) return 0;
			(a.ib = n[0]), (a.hb = e[0]);
		}
		return (
			(a.ob = null != r && r.ob),
			(a.Kb = null == r || !r.Sd),
			a.da && ((a.ob = a.ib < (3 * i) / 4 && a.hb < (3 * t) / 4), (a.Kb = 0)),
			1
		);
	}
	function Sn(r) {
		if (null == r) return 2;
		if (11 > r.S) {
			var a = r.f.RGBA;
			(a.fb += (r.height - 1) * a.A), (a.A = -a.A);
		} else
			(a = r.f.kb),
				(r = r.height),
				(a.O += (r - 1) * a.fa),
				(a.fa = -a.fa),
				(a.N += ((r - 1) >> 1) * a.Ab),
				(a.Ab = -a.Ab),
				(a.W += ((r - 1) >> 1) * a.Db),
				(a.Db = -a.Db),
				null != a.F && ((a.J += (r - 1) * a.lb), (a.lb = -a.lb));
		return 0;
	}
	function Tn(r, a, n, i) {
		if (null == i || 0 >= r || 0 >= a) return 2;
		if (null != n) {
			if (n.Da) {
				var t = n.cd,
					e = n.bd,
					f = -2 & n.v,
					u = -2 & n.j;
				if (0 > f || 0 > u || 0 >= t || 0 >= e || f + t > r || u + e > a) return 2;
				(r = t), (a = e);
			}
			if (n.da) {
				if (!S(r, a, (t = [n.ib]), (e = [n.hb]))) return 2;
				(r = t[0]), (a = e[0]);
			}
		}
		(i.width = r), (i.height = a);
		r: {
			var l = i.width,
				o = i.height;
			if (((r = i.S), 0 >= l || 0 >= o || !(r >= Oi && 13 > r))) r = 2;
			else {
				if (0 >= i.Rd && null == i.sd) {
					f = e = t = a = 0;
					var s = (u = l * Wt[r]) * o;
					if (
						(11 > r || ((e = ((o + 1) / 2) * (a = (l + 1) / 2)), 12 == r && (f = (t = l) * o)),
						null == (o = c(s + 2 * e + f)))
					) {
						r = 1;
						break r;
					}
					(i.sd = o),
						11 > r
							? (((l = i.f.RGBA).eb = o), (l.fb = 0), (l.A = u), (l.size = s))
							: (((l = i.f.kb).y = o),
							  (l.O = 0),
							  (l.fa = u),
							  (l.Fd = s),
							  (l.f = o),
							  (l.N = 0 + s),
							  (l.Ab = a),
							  (l.Cd = e),
							  (l.ea = o),
							  (l.W = 0 + s + e),
							  (l.Db = a),
							  (l.Ed = e),
							  12 == r && ((l.F = o), (l.J = 0 + s + 2 * e)),
							  (l.Tc = f),
							  (l.lb = t));
				}
				if (((a = 1), (t = i.S), (e = i.width), (f = i.height), t >= Oi && 13 > t))
					if (11 > t)
						(r = i.f.RGBA),
							(a &= (u = Math.abs(r.A)) * (f - 1) + e <= r.size),
							(a &= u >= e * Wt[t]),
							(a &= null != r.eb);
					else {
						(r = i.f.kb),
							(u = (e + 1) / 2),
							(s = (f + 1) / 2),
							(l = Math.abs(r.fa)),
							(o = Math.abs(r.Ab));
						var h = Math.abs(r.Db),
							b = Math.abs(r.lb),
							d = b * (f - 1) + e;
						(a &= l * (f - 1) + e <= r.Fd),
							(a &= o * (s - 1) + u <= r.Cd),
							(a = (a &= h * (s - 1) + u <= r.Ed) & (l >= e) & (o >= u) & (h >= u)),
							(a &= null != r.y),
							(a &= null != r.f),
							(a &= null != r.ea),
							12 == t && ((a &= b >= e), (a &= d <= r.Tc), (a &= null != r.F));
					}
				else a = 0;
				r = a ? 0 : 2;
			}
		}
		return 0 != r || (null != n && n.fd && (r = Sn(i))), r;
	}
	var Hn = 64,
		Dn = [
			0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767, 65535, 131071,
			262143, 524287, 1048575, 2097151, 4194303, 8388607, 16777215,
		],
		Wn = 24,
		Kn = 32,
		Nn = 8,
		Yn = [
			0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
			4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
			5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
			6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
			6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
			7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
			7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
			7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
			7, 7, 7, 7, 7, 7, 7, 7,
		];
	D("Predictor0", "PredictorAdd0"),
		(t.Predictor0 = function () {
			return 4278190080;
		}),
		(t.Predictor1 = function (r) {
			return r;
		}),
		(t.Predictor2 = function (r, a, n) {
			return a[n + 0];
		}),
		(t.Predictor3 = function (r, a, n) {
			return a[n + 1];
		}),
		(t.Predictor4 = function (r, a, n) {
			return a[n - 1];
		}),
		(t.Predictor5 = function (r, a, n) {
			return K(K(r, a[n + 1]), a[n + 0]);
		}),
		(t.Predictor6 = function (r, a, n) {
			return K(r, a[n - 1]);
		}),
		(t.Predictor7 = function (r, a, n) {
			return K(r, a[n + 0]);
		}),
		(t.Predictor8 = function (r, a, n) {
			return K(a[n - 1], a[n + 0]);
		}),
		(t.Predictor9 = function (r, a, n) {
			return K(a[n + 0], a[n + 1]);
		}),
		(t.Predictor10 = function (r, a, n) {
			return K(K(r, a[n - 1]), K(a[n + 0], a[n + 1]));
		}),
		(t.Predictor11 = function (r, a, n) {
			var i = a[n + 0];
			return 0 >=
				J((i >> 24) & 255, (r >> 24) & 255, ((a = a[n - 1]) >> 24) & 255) +
					J((i >> 16) & 255, (r >> 16) & 255, (a >> 16) & 255) +
					J((i >> 8) & 255, (r >> 8) & 255, (a >> 8) & 255) +
					J(255 & i, 255 & r, 255 & a)
				? i
				: r;
		}),
		(t.Predictor12 = function (r, a, n) {
			var i = a[n + 0];
			return (
				((N(((r >> 24) & 255) + ((i >> 24) & 255) - (((a = a[n - 1]) >> 24) & 255)) << 24) |
					(N(((r >> 16) & 255) + ((i >> 16) & 255) - ((a >> 16) & 255)) << 16) |
					(N(((r >> 8) & 255) + ((i >> 8) & 255) - ((a >> 8) & 255)) << 8) |
					N((255 & r) + (255 & i) - (255 & a))) >>>
				0
			);
		}),
		(t.Predictor13 = function (r, a, n) {
			var i = a[n - 1];
			return (
				((Y(((r = K(r, a[n + 0])) >> 24) & 255, (i >> 24) & 255) << 24) |
					(Y((r >> 16) & 255, (i >> 16) & 255) << 16) |
					(Y((r >> 8) & 255, (i >> 8) & 255) << 8) |
					Y((r >> 0) & 255, (i >> 0) & 255)) >>>
				0
			);
		});
	var Jn = t.PredictorAdd0;
	(t.PredictorAdd1 = x),
		D("Predictor2", "PredictorAdd2"),
		D("Predictor3", "PredictorAdd3"),
		D("Predictor4", "PredictorAdd4"),
		D("Predictor5", "PredictorAdd5"),
		D("Predictor6", "PredictorAdd6"),
		D("Predictor7", "PredictorAdd7"),
		D("Predictor8", "PredictorAdd8"),
		D("Predictor9", "PredictorAdd9"),
		D("Predictor10", "PredictorAdd10"),
		D("Predictor11", "PredictorAdd11"),
		D("Predictor12", "PredictorAdd12"),
		D("Predictor13", "PredictorAdd13");
	var xn = t.PredictorAdd2;
	$(
		"ColorIndexInverseTransform",
		"MapARGB",
		"32b",
		function (r) {
			return (r >> 8) & 255;
		},
		function (r) {
			return r;
		}
	),
		$(
			"VP8LColorIndexInverseTransformAlpha",
			"MapAlpha",
			"8b",
			function (r) {
				return r;
			},
			function (r) {
				return (r >> 8) & 255;
			}
		);
	var zn,
		En = t.ColorIndexInverseTransform,
		Xn = t.MapARGB,
		$n = t.VP8LColorIndexInverseTransformAlpha,
		Zn = t.MapAlpha,
		qn = (t.VP8LPredictorsAdd = []);
	(qn.length = 16),
		((t.VP8LPredictors = []).length = 16),
		((t.VP8LPredictorsAdd_C = []).length = 16),
		((t.VP8LPredictors_C = []).length = 16);
	var Qn,
		ri,
		ai,
		ni,
		ii,
		ti,
		ei,
		fi,
		ui,
		li,
		ci,
		oi,
		si,
		hi,
		bi,
		di,
		vi,
		wi,
		gi,
		Pi,
		ki,
		mi,
		pi,
		Ai,
		Li,
		Ri,
		yi,
		_i,
		Vi = c(511),
		Bi = c(2041),
		Gi = c(225),
		Ci = c(767),
		Ii = 0,
		Ui = Bi,
		Mi = Gi,
		Fi = Ci,
		ji = Vi,
		Oi = 0,
		Si = 1,
		Ti = 2,
		Hi = 3,
		Di = 4,
		Wi = 5,
		Ki = 6,
		Ni = 7,
		Yi = 8,
		Ji = 9,
		xi = 10,
		zi = [2, 3, 7],
		Ei = [3, 3, 11],
		Xi = [280, 256, 256, 256, 40],
		$i = [0, 1, 1, 1, 0],
		Zi = [17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
		qi = [
			24, 7, 23, 25, 40, 6, 39, 41, 22, 26, 38, 42, 56, 5, 55, 57, 21, 27, 54, 58, 37, 43, 72, 4,
			71, 73, 20, 28, 53, 59, 70, 74, 36, 44, 88, 69, 75, 52, 60, 3, 87, 89, 19, 29, 86, 90, 35, 45,
			68, 76, 85, 91, 51, 61, 104, 2, 103, 105, 18, 30, 102, 106, 34, 46, 84, 92, 67, 77, 101, 107,
			50, 62, 120, 1, 119, 121, 83, 93, 17, 31, 100, 108, 66, 78, 118, 122, 33, 47, 117, 123, 49,
			63, 99, 109, 82, 94, 0, 116, 124, 65, 79, 16, 32, 98, 110, 48, 115, 125, 81, 95, 64, 114, 126,
			97, 111, 80, 113, 127, 96, 112,
		],
		Qi = [2954, 2956, 2958, 2962, 2970, 2986, 3018, 3082, 3212, 3468, 3980, 5004],
		rt = 8,
		at = [
			4, 5, 6, 7, 8, 9, 10, 10, 11, 12, 13, 14, 15, 16, 17, 17, 18, 19, 20, 20, 21, 21, 22, 22, 23,
			23, 24, 25, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 37, 38, 39, 40, 41, 42, 43,
			44, 45, 46, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,
			66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87,
			88, 89, 91, 93, 95, 96, 98, 100, 101, 102, 104, 106, 108, 110, 112, 114, 116, 118, 122, 124,
			126, 128, 130, 132, 134, 136, 138, 140, 143, 145, 148, 151, 154, 157,
		],
		nt = [
			4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
			29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
			52, 53, 54, 55, 56, 57, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90,
			92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112, 114, 116, 119, 122, 125, 128, 131, 134,
			137, 140, 143, 146, 149, 152, 155, 158, 161, 164, 167, 170, 173, 177, 181, 185, 189, 193, 197,
			201, 205, 209, 213, 217, 221, 225, 229, 234, 239, 245, 249, 254, 259, 264, 269, 274, 279, 284,
		],
		it = null,
		tt = [
			[173, 148, 140, 0],
			[176, 155, 140, 135, 0],
			[180, 157, 141, 134, 130, 0],
			[254, 254, 243, 230, 196, 177, 153, 140, 133, 130, 129, 0],
		],
		et = [0, 1, 4, 8, 5, 2, 3, 6, 9, 12, 13, 10, 7, 11, 14, 15],
		ft = [-0, 1, -1, 2, -2, 3, 4, 6, -3, 5, -4, -5, -6, 7, -7, 8, -8, -9],
		ut = [
			[
				[
					[128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128],
					[128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128],
					[128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128],
				],
				[
					[253, 136, 254, 255, 228, 219, 128, 128, 128, 128, 128],
					[189, 129, 242, 255, 227, 213, 255, 219, 128, 128, 128],
					[106, 126, 227, 252, 214, 209, 255, 255, 128, 128, 128],
				],
				[
					[1, 98, 248, 255, 236, 226, 255, 255, 128, 128, 128],
					[181, 133, 238, 254, 221, 234, 255, 154, 128, 128, 128],
					[78, 134, 202, 247, 198, 180, 255, 219, 128, 128, 128],
				],
				[
					[1, 185, 249, 255, 243, 255, 128, 128, 128, 128, 128],
					[184, 150, 247, 255, 236, 224, 128, 128, 128, 128, 128],
					[77, 110, 216, 255, 236, 230, 128, 128, 128, 128, 128],
				],
				[
					[1, 101, 251, 255, 241, 255, 128, 128, 128, 128, 128],
					[170, 139, 241, 252, 236, 209, 255, 255, 128, 128, 128],
					[37, 116, 196, 243, 228, 255, 255, 255, 128, 128, 128],
				],
				[
					[1, 204, 254, 255, 245, 255, 128, 128, 128, 128, 128],
					[207, 160, 250, 255, 238, 128, 128, 128, 128, 128, 128],
					[102, 103, 231, 255, 211, 171, 128, 128, 128, 128, 128],
				],
				[
					[1, 152, 252, 255, 240, 255, 128, 128, 128, 128, 128],
					[177, 135, 243, 255, 234, 225, 128, 128, 128, 128, 128],
					[80, 129, 211, 255, 194, 224, 128, 128, 128, 128, 128],
				],
				[
					[1, 1, 255, 128, 128, 128, 128, 128, 128, 128, 128],
					[246, 1, 255, 128, 128, 128, 128, 128, 128, 128, 128],
					[255, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128],
				],
			],
			[
				[
					[198, 35, 237, 223, 193, 187, 162, 160, 145, 155, 62],
					[131, 45, 198, 221, 172, 176, 220, 157, 252, 221, 1],
					[68, 47, 146, 208, 149, 167, 221, 162, 255, 223, 128],
				],
				[
					[1, 149, 241, 255, 221, 224, 255, 255, 128, 128, 128],
					[184, 141, 234, 253, 222, 220, 255, 199, 128, 128, 128],
					[81, 99, 181, 242, 176, 190, 249, 202, 255, 255, 128],
				],
				[
					[1, 129, 232, 253, 214, 197, 242, 196, 255, 255, 128],
					[99, 121, 210, 250, 201, 198, 255, 202, 128, 128, 128],
					[23, 91, 163, 242, 170, 187, 247, 210, 255, 255, 128],
				],
				[
					[1, 200, 246, 255, 234, 255, 128, 128, 128, 128, 128],
					[109, 178, 241, 255, 231, 245, 255, 255, 128, 128, 128],
					[44, 130, 201, 253, 205, 192, 255, 255, 128, 128, 128],
				],
				[
					[1, 132, 239, 251, 219, 209, 255, 165, 128, 128, 128],
					[94, 136, 225, 251, 218, 190, 255, 255, 128, 128, 128],
					[22, 100, 174, 245, 186, 161, 255, 199, 128, 128, 128],
				],
				[
					[1, 182, 249, 255, 232, 235, 128, 128, 128, 128, 128],
					[124, 143, 241, 255, 227, 234, 128, 128, 128, 128, 128],
					[35, 77, 181, 251, 193, 211, 255, 205, 128, 128, 128],
				],
				[
					[1, 157, 247, 255, 236, 231, 255, 255, 128, 128, 128],
					[121, 141, 235, 255, 225, 227, 255, 255, 128, 128, 128],
					[45, 99, 188, 251, 195, 217, 255, 224, 128, 128, 128],
				],
				[
					[1, 1, 251, 255, 213, 255, 128, 128, 128, 128, 128],
					[203, 1, 248, 255, 255, 128, 128, 128, 128, 128, 128],
					[137, 1, 177, 255, 224, 255, 128, 128, 128, 128, 128],
				],
			],
			[
				[
					[253, 9, 248, 251, 207, 208, 255, 192, 128, 128, 128],
					[175, 13, 224, 243, 193, 185, 249, 198, 255, 255, 128],
					[73, 17, 171, 221, 161, 179, 236, 167, 255, 234, 128],
				],
				[
					[1, 95, 247, 253, 212, 183, 255, 255, 128, 128, 128],
					[239, 90, 244, 250, 211, 209, 255, 255, 128, 128, 128],
					[155, 77, 195, 248, 188, 195, 255, 255, 128, 128, 128],
				],
				[
					[1, 24, 239, 251, 218, 219, 255, 205, 128, 128, 128],
					[201, 51, 219, 255, 196, 186, 128, 128, 128, 128, 128],
					[69, 46, 190, 239, 201, 218, 255, 228, 128, 128, 128],
				],
				[
					[1, 191, 251, 255, 255, 128, 128, 128, 128, 128, 128],
					[223, 165, 249, 255, 213, 255, 128, 128, 128, 128, 128],
					[141, 124, 248, 255, 255, 128, 128, 128, 128, 128, 128],
				],
				[
					[1, 16, 248, 255, 255, 128, 128, 128, 128, 128, 128],
					[190, 36, 230, 255, 236, 255, 128, 128, 128, 128, 128],
					[149, 1, 255, 128, 128, 128, 128, 128, 128, 128, 128],
				],
				[
					[1, 226, 255, 128, 128, 128, 128, 128, 128, 128, 128],
					[247, 192, 255, 128, 128, 128, 128, 128, 128, 128, 128],
					[240, 128, 255, 128, 128, 128, 128, 128, 128, 128, 128],
				],
				[
					[1, 134, 252, 255, 255, 128, 128, 128, 128, 128, 128],
					[213, 62, 250, 255, 255, 128, 128, 128, 128, 128, 128],
					[55, 93, 255, 128, 128, 128, 128, 128, 128, 128, 128],
				],
				[
					[128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128],
					[128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128],
					[128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128],
				],
			],
			[
				[
					[202, 24, 213, 235, 186, 191, 220, 160, 240, 175, 255],
					[126, 38, 182, 232, 169, 184, 228, 174, 255, 187, 128],
					[61, 46, 138, 219, 151, 178, 240, 170, 255, 216, 128],
				],
				[
					[1, 112, 230, 250, 199, 191, 247, 159, 255, 255, 128],
					[166, 109, 228, 252, 211, 215, 255, 174, 128, 128, 128],
					[39, 77, 162, 232, 172, 180, 245, 178, 255, 255, 128],
				],
				[
					[1, 52, 220, 246, 198, 199, 249, 220, 255, 255, 128],
					[124, 74, 191, 243, 183, 193, 250, 221, 255, 255, 128],
					[24, 71, 130, 219, 154, 170, 243, 182, 255, 255, 128],
				],
				[
					[1, 182, 225, 249, 219, 240, 255, 224, 128, 128, 128],
					[149, 150, 226, 252, 216, 205, 255, 171, 128, 128, 128],
					[28, 108, 170, 242, 183, 194, 254, 223, 255, 255, 128],
				],
				[
					[1, 81, 230, 252, 204, 203, 255, 192, 128, 128, 128],
					[123, 102, 209, 247, 188, 196, 255, 233, 128, 128, 128],
					[20, 95, 153, 243, 164, 173, 255, 203, 128, 128, 128],
				],
				[
					[1, 222, 248, 255, 216, 213, 128, 128, 128, 128, 128],
					[168, 175, 246, 252, 235, 205, 255, 255, 128, 128, 128],
					[47, 116, 215, 255, 211, 212, 255, 255, 128, 128, 128],
				],
				[
					[1, 121, 236, 253, 212, 214, 255, 255, 128, 128, 128],
					[141, 84, 213, 252, 201, 202, 255, 219, 128, 128, 128],
					[42, 80, 160, 240, 162, 185, 255, 205, 128, 128, 128],
				],
				[
					[1, 1, 255, 128, 128, 128, 128, 128, 128, 128, 128],
					[244, 1, 255, 128, 128, 128, 128, 128, 128, 128, 128],
					[238, 1, 255, 128, 128, 128, 128, 128, 128, 128, 128],
				],
			],
		],
		lt = [
			[
				[231, 120, 48, 89, 115, 113, 120, 152, 112],
				[152, 179, 64, 126, 170, 118, 46, 70, 95],
				[175, 69, 143, 80, 85, 82, 72, 155, 103],
				[56, 58, 10, 171, 218, 189, 17, 13, 152],
				[114, 26, 17, 163, 44, 195, 21, 10, 173],
				[121, 24, 80, 195, 26, 62, 44, 64, 85],
				[144, 71, 10, 38, 171, 213, 144, 34, 26],
				[170, 46, 55, 19, 136, 160, 33, 206, 71],
				[63, 20, 8, 114, 114, 208, 12, 9, 226],
				[81, 40, 11, 96, 182, 84, 29, 16, 36],
			],
			[
				[134, 183, 89, 137, 98, 101, 106, 165, 148],
				[72, 187, 100, 130, 157, 111, 32, 75, 80],
				[66, 102, 167, 99, 74, 62, 40, 234, 128],
				[41, 53, 9, 178, 241, 141, 26, 8, 107],
				[74, 43, 26, 146, 73, 166, 49, 23, 157],
				[65, 38, 105, 160, 51, 52, 31, 115, 128],
				[104, 79, 12, 27, 217, 255, 87, 17, 7],
				[87, 68, 71, 44, 114, 51, 15, 186, 23],
				[47, 41, 14, 110, 182, 183, 21, 17, 194],
				[66, 45, 25, 102, 197, 189, 23, 18, 22],
			],
			[
				[88, 88, 147, 150, 42, 46, 45, 196, 205],
				[43, 97, 183, 117, 85, 38, 35, 179, 61],
				[39, 53, 200, 87, 26, 21, 43, 232, 171],
				[56, 34, 51, 104, 114, 102, 29, 93, 77],
				[39, 28, 85, 171, 58, 165, 90, 98, 64],
				[34, 22, 116, 206, 23, 34, 43, 166, 73],
				[107, 54, 32, 26, 51, 1, 81, 43, 31],
				[68, 25, 106, 22, 64, 171, 36, 225, 114],
				[34, 19, 21, 102, 132, 188, 16, 76, 124],
				[62, 18, 78, 95, 85, 57, 50, 48, 51],
			],
			[
				[193, 101, 35, 159, 215, 111, 89, 46, 111],
				[60, 148, 31, 172, 219, 228, 21, 18, 111],
				[112, 113, 77, 85, 179, 255, 38, 120, 114],
				[40, 42, 1, 196, 245, 209, 10, 25, 109],
				[88, 43, 29, 140, 166, 213, 37, 43, 154],
				[61, 63, 30, 155, 67, 45, 68, 1, 209],
				[100, 80, 8, 43, 154, 1, 51, 26, 71],
				[142, 78, 78, 16, 255, 128, 34, 197, 171],
				[41, 40, 5, 102, 211, 183, 4, 1, 221],
				[51, 50, 17, 168, 209, 192, 23, 25, 82],
			],
			[
				[138, 31, 36, 171, 27, 166, 38, 44, 229],
				[67, 87, 58, 169, 82, 115, 26, 59, 179],
				[63, 59, 90, 180, 59, 166, 93, 73, 154],
				[40, 40, 21, 116, 143, 209, 34, 39, 175],
				[47, 15, 16, 183, 34, 223, 49, 45, 183],
				[46, 17, 33, 183, 6, 98, 15, 32, 183],
				[57, 46, 22, 24, 128, 1, 54, 17, 37],
				[65, 32, 73, 115, 28, 128, 23, 128, 205],
				[40, 3, 9, 115, 51, 192, 18, 6, 223],
				[87, 37, 9, 115, 59, 77, 64, 21, 47],
			],
			[
				[104, 55, 44, 218, 9, 54, 53, 130, 226],
				[64, 90, 70, 205, 40, 41, 23, 26, 57],
				[54, 57, 112, 184, 5, 41, 38, 166, 213],
				[30, 34, 26, 133, 152, 116, 10, 32, 134],
				[39, 19, 53, 221, 26, 114, 32, 73, 255],
				[31, 9, 65, 234, 2, 15, 1, 118, 73],
				[75, 32, 12, 51, 192, 255, 160, 43, 51],
				[88, 31, 35, 67, 102, 85, 55, 186, 85],
				[56, 21, 23, 111, 59, 205, 45, 37, 192],
				[55, 38, 70, 124, 73, 102, 1, 34, 98],
			],
			[
				[125, 98, 42, 88, 104, 85, 117, 175, 82],
				[95, 84, 53, 89, 128, 100, 113, 101, 45],
				[75, 79, 123, 47, 51, 128, 81, 171, 1],
				[57, 17, 5, 71, 102, 57, 53, 41, 49],
				[38, 33, 13, 121, 57, 73, 26, 1, 85],
				[41, 10, 67, 138, 77, 110, 90, 47, 114],
				[115, 21, 2, 10, 102, 255, 166, 23, 6],
				[101, 29, 16, 10, 85, 128, 101, 196, 26],
				[57, 18, 10, 102, 102, 213, 34, 20, 43],
				[117, 20, 15, 36, 163, 128, 68, 1, 26],
			],
			[
				[102, 61, 71, 37, 34, 53, 31, 243, 192],
				[69, 60, 71, 38, 73, 119, 28, 222, 37],
				[68, 45, 128, 34, 1, 47, 11, 245, 171],
				[62, 17, 19, 70, 146, 85, 55, 62, 70],
				[37, 43, 37, 154, 100, 163, 85, 160, 1],
				[63, 9, 92, 136, 28, 64, 32, 201, 85],
				[75, 15, 9, 9, 64, 255, 184, 119, 16],
				[86, 6, 28, 5, 64, 255, 25, 248, 1],
				[56, 8, 17, 132, 137, 255, 55, 116, 128],
				[58, 15, 20, 82, 135, 57, 26, 121, 40],
			],
			[
				[164, 50, 31, 137, 154, 133, 25, 35, 218],
				[51, 103, 44, 131, 131, 123, 31, 6, 158],
				[86, 40, 64, 135, 148, 224, 45, 183, 128],
				[22, 26, 17, 131, 240, 154, 14, 1, 209],
				[45, 16, 21, 91, 64, 222, 7, 1, 197],
				[56, 21, 39, 155, 60, 138, 23, 102, 213],
				[83, 12, 13, 54, 192, 255, 68, 47, 28],
				[85, 26, 85, 85, 128, 128, 32, 146, 171],
				[18, 11, 7, 63, 144, 171, 4, 4, 246],
				[35, 27, 10, 146, 174, 171, 12, 26, 128],
			],
			[
				[190, 80, 35, 99, 180, 80, 126, 54, 45],
				[85, 126, 47, 87, 176, 51, 41, 20, 32],
				[101, 75, 128, 139, 118, 146, 116, 128, 85],
				[56, 41, 15, 176, 236, 85, 37, 9, 62],
				[71, 30, 17, 119, 118, 255, 17, 18, 138],
				[101, 38, 60, 138, 55, 70, 43, 26, 142],
				[146, 36, 19, 30, 171, 255, 97, 27, 20],
				[138, 45, 61, 62, 219, 1, 81, 188, 64],
				[32, 41, 20, 117, 151, 142, 20, 21, 163],
				[112, 19, 12, 61, 195, 128, 48, 4, 24],
			],
		],
		ct = [
			[
				[
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[176, 246, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[223, 241, 252, 255, 255, 255, 255, 255, 255, 255, 255],
					[249, 253, 253, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 244, 252, 255, 255, 255, 255, 255, 255, 255, 255],
					[234, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[253, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 246, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[239, 253, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[254, 255, 254, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 248, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[251, 255, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 253, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[251, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[254, 255, 254, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 254, 253, 255, 254, 255, 255, 255, 255, 255, 255],
					[250, 255, 254, 255, 254, 255, 255, 255, 255, 255, 255],
					[254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
			],
			[
				[
					[217, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[225, 252, 241, 253, 255, 255, 254, 255, 255, 255, 255],
					[234, 250, 241, 250, 253, 255, 253, 254, 255, 255, 255],
				],
				[
					[255, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[223, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[238, 253, 254, 254, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 248, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[249, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 253, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[247, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 253, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[252, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[253, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 254, 253, 255, 255, 255, 255, 255, 255, 255, 255],
					[250, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
			],
			[
				[
					[186, 251, 250, 255, 255, 255, 255, 255, 255, 255, 255],
					[234, 251, 244, 254, 255, 255, 255, 255, 255, 255, 255],
					[251, 251, 243, 253, 254, 255, 254, 255, 255, 255, 255],
				],
				[
					[255, 253, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[236, 253, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[251, 253, 253, 254, 254, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[254, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[254, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
			],
			[
				[
					[248, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[250, 254, 252, 254, 255, 255, 255, 255, 255, 255, 255],
					[248, 254, 249, 253, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 253, 253, 255, 255, 255, 255, 255, 255, 255, 255],
					[246, 253, 253, 255, 255, 255, 255, 255, 255, 255, 255],
					[252, 254, 251, 254, 254, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 254, 252, 255, 255, 255, 255, 255, 255, 255, 255],
					[248, 254, 253, 255, 255, 255, 255, 255, 255, 255, 255],
					[253, 255, 254, 254, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 251, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[245, 251, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[253, 253, 254, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 251, 253, 255, 255, 255, 255, 255, 255, 255, 255],
					[252, 253, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 252, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[249, 255, 254, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 254, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 255, 253, 255, 255, 255, 255, 255, 255, 255, 255],
					[250, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
				[
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
					[255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
				],
			],
		],
		ot = [0, 1, 2, 3, 6, 4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 7, 0],
		st = [],
		ht = [],
		bt = [],
		dt = 1,
		vt = 2,
		wt = [],
		gt = [];
	Pn("UpsampleRgbLinePair", Rn, 3),
		Pn("UpsampleBgrLinePair", yn, 3),
		Pn("UpsampleRgbaLinePair", Cn, 4),
		Pn("UpsampleBgraLinePair", Gn, 4),
		Pn("UpsampleArgbLinePair", Bn, 4),
		Pn("UpsampleRgba4444LinePair", Vn, 2),
		Pn("UpsampleRgb565LinePair", _n, 2);
	var Pt = t.UpsampleRgbLinePair,
		kt = t.UpsampleBgrLinePair,
		mt = t.UpsampleRgbaLinePair,
		pt = t.UpsampleBgraLinePair,
		At = t.UpsampleArgbLinePair,
		Lt = t.UpsampleRgba4444LinePair,
		Rt = t.UpsampleRgb565LinePair,
		yt = 16,
		_t = 1 << (yt - 1),
		Vt = -227,
		Bt = 482,
		Gt = 6,
		Ct = (256 << Gt) - 1,
		It = 0,
		Ut = c(256),
		Mt = c(256),
		Ft = c(256),
		jt = c(256),
		Ot = c(Bt - Vt),
		St = c(Bt - Vt);
	In("YuvToRgbRow", Rn, 3),
		In("YuvToBgrRow", yn, 3),
		In("YuvToRgbaRow", Cn, 4),
		In("YuvToBgraRow", Gn, 4),
		In("YuvToArgbRow", Bn, 4),
		In("YuvToRgba4444Row", Vn, 2),
		In("YuvToRgb565Row", _n, 2);
	var Tt = [0, 4, 8, 12, 128, 132, 136, 140, 256, 260, 264, 268, 384, 388, 392, 396],
		Ht = [0, 2, 8],
		Dt = [8, 7, 6, 4, 4, 2, 2, 2, 1, 1, 1, 1];
	this.WebPDecodeRGBA = function (r, a, n, i, t) {
		var f = Si,
			s = new nn(),
			h = new ur();
		(s.ba = h), (h.S = f), (h.width = [h.width]), (h.height = [h.height]);
		var b = h.width,
			d = h.height,
			v = new lr();
		if (null == v || null == r) var w = 2;
		else e(null != v), (w = jn(r, a, n, v.width, v.height, v.Pd, v.Qd, v.format, null));
		if (
			(0 != w
				? (b = 0)
				: (null != b && (b[0] = v.width[0]), null != d && (d[0] = v.height[0]), (b = 1)),
			b)
		) {
			(h.width = h.width[0]),
				(h.height = h.height[0]),
				null != i && (i[0] = h.width),
				null != t && (t[0] = h.height);
			r: {
				if (
					((i = new zr()),
					((t = new tn()).data = r),
					(t.w = a),
					(t.ha = n),
					(t.kd = 1),
					(a = [0]),
					e(null != t),
					(0 == (r = jn(t.data, t.w, t.ha, null, null, null, a, null, t)) || 7 == r) &&
						a[0] &&
						(r = 4),
					0 == (a = r))
				) {
					if (
						(e(null != s),
						(i.data = t.data),
						(i.w = t.w + t.offset),
						(i.ha = t.ha - t.offset),
						(i.put = dr),
						(i.ac = br),
						(i.bc = vr),
						(i.ma = s),
						t.xa)
					) {
						if (null == (r = Gr())) {
							s = 1;
							break r;
						}
						if (
							(function (r, a) {
								var n = [0],
									i = [0],
									t = [0];
								a: for (;;) {
									if (null == r) return 0;
									if (null == a) return (r.a = 2), 0;
									if (((r.l = a), (r.a = 0), P(r.m, a.data, a.w, a.ha), !wr(r.m, n, i, t))) {
										r.a = 3;
										break a;
									}
									if (
										((r.xb = vt), (a.width = n[0]), (a.height = i[0]), !Cr(n[0], i[0], 1, r, null))
									)
										break a;
									return 1;
								}
								return e(0 != r.a), 0;
							})(r, i)
						) {
							if ((i = 0 == (a = Tn(i.width, i.height, s.Oa, s.ba)))) {
								a: {
									i = r;
									n: for (;;) {
										if (null == i) {
											i = 0;
											break a;
										}
										if (
											(e(null != i.s.yc),
											e(null != i.s.Ya),
											e(0 < i.s.Wb),
											e(null != (n = i.l)),
											e(null != (t = n.ma)),
											0 != i.xb)
										) {
											if (((i.ca = t.ba), (i.tb = t.tb), e(null != i.ca), !On(t.Oa, n, Hi))) {
												i.a = 2;
												break n;
											}
											if (!Ir(i, n.width)) break n;
											if (n.da) break n;
											if (
												((n.da || tr(i.ca.S)) && gn(),
												11 > i.ca.S ||
													(console.info(`Stickers decoder: WebPInitConvertARGBToYUV`),
													null != i.ca.f.kb.F && gn()),
												i.Pb && 0 < i.s.ua && null == i.s.vb.X && !F(i.s.vb, i.s.Wa.Xa))
											) {
												i.a = 1;
												break n;
											}
											i.xb = 0;
										}
										if (!Vr(i, i.V, i.Ba, i.c, i.i, n.o, Lr)) break n;
										(t.Dc = i.Ma), (i = 1);
										break a;
									}
									e(0 != i.a), (i = 0);
								}
								i = !i;
							}
							i && (a = r.a);
						} else a = r.a;
					} else {
						if (null == (r = new Er())) {
							s = 1;
							break r;
						}
						if (((r.Fa = t.na), (r.P = t.P), (r.qc = t.Sa), Zr(r, i))) {
							if (0 == (a = Tn(i.width, i.height, s.Oa, s.ba))) {
								if (((r.Aa = 0), (n = s.Oa), e(null != (t = r)), null != n)) {
									if (0 < (b = 0 > (b = n.Md) ? 0 : 100 < b ? 255 : (255 * b) / 100)) {
										for (d = v = 0; 4 > d; ++d)
											12 > (w = t.pb[d]).lc && (w.ia = (b * Dt[0 > w.lc ? 0 : w.lc]) >> 3),
												(v |= w.ia);
										v && (console.info(`Stickers decoder: VP8InitRandom`), (t.ia = 1));
									}
									(t.Ga = n.Id), 100 < t.Ga ? (t.Ga = 100) : 0 > t.Ga && (t.Ga = 0);
								}
								(function (r, a) {
									if (null == r) return 0;
									if (null == a) return Xr(r, 2, "NULL VP8Io parameter in VP8Decode().");
									if (!r.cb && !Zr(r, a)) return 0;
									if ((e(r.cb), null == a.ac || a.ac(a))) {
										a.ob && (r.L = 0);
										var n = Ht[r.L];
										if (
											(2 == r.L
												? ((r.yb = 0), (r.zb = 0))
												: ((r.yb = (a.v - n) >> 4),
												  (r.zb = (a.j - n) >> 4),
												  0 > r.yb && (r.yb = 0),
												  0 > r.zb && (r.zb = 0)),
											(r.Va = (a.o + 15 + n) >> 4),
											(r.Hb = (a.va + 15 + n) >> 4),
											r.Hb > r.za && (r.Hb = r.za),
											r.Va > r.Ub && (r.Va = r.Ub),
											0 < r.L)
										) {
											var i = r.ed;
											for (n = 0; 4 > n; ++n) {
												var t;
												if (r.Qa.Cb) {
													var f = r.Qa.Lb[n];
													r.Qa.Fb || (f += i.Tb);
												} else f = i.Tb;
												for (t = 0; 1 >= t; ++t) {
													var s = r.gd[n][t],
														h = f;
													if (
														(i.Pc && ((h += i.vd[0]), t && (h += i.od[0])),
														0 < (h = 0 > h ? 0 : 63 < h ? 63 : h))
													) {
														var b = h;
														0 < i.wb &&
															(b = 4 < i.wb ? b >> 2 : b >> 1) > 9 - i.wb &&
															(b = 9 - i.wb),
															1 > b && (b = 1),
															(s.dd = b),
															(s.tc = 2 * h + b),
															(s.ld = 40 <= h ? 2 : 15 <= h ? 1 : 0);
													} else s.tc = 0;
													s.La = t;
												}
											}
										}
										n = 0;
									} else Xr(r, 6, "Frame setup failed"), (n = r.a);
									if ((n = 0 == n)) {
										if (n) {
											(r.$c = 0), 0 < r.Aa || (r.Ic = 1);
											a: {
												(n = r.Ic), (i = 4 * (b = r.za));
												var d = 32 * b,
													v = b + 1,
													w = 0 < r.L ? b * (0 < r.Aa ? 2 : 1) : 0,
													g = (2 == r.Aa ? 2 : 1) * b;
												if (
													(s =
														i +
														832 +
														(t = ((3 * (16 * n + Ht[r.L])) / 2) * d) +
														(f = null != r.Fa && 0 < r.Fa.length ? r.Kc.c * r.Kc.i : 0)) != s
												)
													n = 0;
												else {
													if (s > r.Vb) {
														if (((r.Vb = 0), (r.Ec = c(s)), (r.Fc = 0), null == r.Ec)) {
															n = Xr(r, 1, "no memory during frame initialization.");
															break a;
														}
														r.Vb = s;
													}
													(s = r.Ec),
														(h = r.Fc),
														(r.Ac = s),
														(r.Bc = h),
														(h += i),
														(r.Gd = o(d, Yr)),
														(r.Hd = 0),
														(r.rb = o(v + 1, Dr)),
														(r.sb = 1),
														(r.wa = w ? o(w, Hr) : null),
														(r.Y = 0),
														(r.D.Nb = 0),
														(r.D.wa = r.wa),
														(r.D.Y = r.Y),
														0 < r.Aa && (r.D.Y += b),
														e(!0),
														(r.oc = s),
														(r.pc = h),
														(h += 832),
														(r.ya = o(g, Kr)),
														(r.aa = 0),
														(r.D.ya = r.ya),
														(r.D.aa = r.aa),
														2 == r.Aa && (r.D.aa += b),
														(r.R = 16 * b),
														(r.B = 8 * b),
														(b = (d = Ht[r.L]) * r.R),
														(d = (d / 2) * r.B),
														(r.sa = s),
														(r.ta = h + b),
														(r.qa = r.sa),
														(r.ra = r.ta + 16 * n * r.R + d),
														(r.Ha = r.qa),
														(r.Ia = r.ra + 8 * n * r.B + d),
														(r.$c = 0),
														(h += t),
														(r.mb = f ? s : null),
														(r.nb = f ? h : null),
														e(h + f <= r.Fc + r.Vb),
														Qr(r),
														l(r.Ac, r.Bc, 0, i),
														(n = 1);
												}
											}
											if (n) {
												if (
													((a.ka = 0),
													(a.y = r.sa),
													(a.O = r.ta),
													(a.f = r.qa),
													(a.N = r.ra),
													(a.ea = r.Ha),
													(a.Vd = r.Ia),
													(a.fa = r.R),
													(a.Rc = r.B),
													(a.F = null),
													(a.J = 0),
													!Ii)
												) {
													for (n = -255; 255 >= n; ++n) Vi[255 + n] = 0 > n ? -n : n;
													for (n = -1020; 1020 >= n; ++n)
														Bi[1020 + n] = -128 > n ? -128 : 127 < n ? 127 : n;
													for (n = -112; 112 >= n; ++n)
														Gi[112 + n] = -16 > n ? -16 : 15 < n ? 15 : n;
													for (n = -255; 510 >= n; ++n) Ci[255 + n] = 0 > n ? 0 : 255 < n ? 255 : n;
													Ii = 1;
												}
												(ei = ca),
													(fi = ea),
													(li = fa),
													(ci = ua),
													(oi = la),
													(ui = ta),
													(si = Ea),
													(hi = Xa),
													(bi = qa),
													(di = Qa),
													(vi = $a),
													(wi = Za),
													(gi = rn),
													(Pi = an),
													(ki = Ka),
													(mi = Na),
													(pi = Ya),
													(Ai = Ja),
													(ht[0] = Ra),
													(ht[1] = sa),
													(ht[2] = Aa),
													(ht[3] = La),
													(ht[4] = ya),
													(ht[5] = Va),
													(ht[6] = _a),
													(ht[7] = Ba),
													(ht[8] = Ca),
													(ht[9] = Ga),
													(st[0] = ga),
													(st[1] = ba),
													(st[2] = da),
													(st[3] = va),
													(st[4] = Pa),
													(st[5] = ka),
													(st[6] = ma),
													(bt[0] = Fa),
													(bt[1] = ha),
													(bt[2] = Ia),
													(bt[3] = Ua),
													(bt[4] = Oa),
													(bt[5] = ja),
													(bt[6] = Sa),
													(n = 1);
											} else n = 0;
										}
										n &&
											(n = (function (r, a) {
												for (r.M = 0; r.M < r.Va; ++r.M) {
													var n,
														i = r.Jc[r.M & r.Xb],
														t = r.m,
														f = r;
													for (n = 0; n < f.za; ++n) {
														var o = t,
															s = f,
															h = s.Ac,
															b = s.Bc + 4 * n,
															d = s.zc,
															v = s.ya[s.aa + n];
														if (
															(s.Qa.Bb
																? (v.$b = G(o, s.Pa.jb[0])
																		? 2 + G(o, s.Pa.jb[2])
																		: G(o, s.Pa.jb[1]))
																: (v.$b = 0),
															s.kc && (v.Ad = G(o, s.Bd)),
															(v.Za = !G(o, 145) + 0),
															v.Za)
														) {
															var w = v.Ob,
																g = 0;
															for (s = 0; 4 > s; ++s) {
																var P,
																	k = d[0 + s];
																for (P = 0; 4 > P; ++P) {
																	k = lt[h[b + P]][k];
																	for (var m = ft[G(o, k[0])]; 0 < m; ) m = ft[2 * m + G(o, k[m])];
																	(k = -m), (h[b + P] = k);
																}
																u(w, g, h, b, 4), (g += 4), (d[0 + s] = k);
															}
														} else
															(k = G(o, 156) ? (G(o, 128) ? 1 : 3) : G(o, 163) ? 2 : 0),
																(v.Ob[0] = k),
																l(h, b, k, 4),
																l(d, 0, k, 4);
														v.Dd = G(o, 142) ? (G(o, 114) ? (G(o, 183) ? 1 : 3) : 2) : 0;
													}
													if (f.m.Ka) return Xr(r, 7, "Premature end-of-partition0 encountered.");
													for (; r.ja < r.za; ++r.ja) {
														if (
															((f = i),
															(o = (t = r).rb[t.sb - 1]),
															(h = t.rb[t.sb + t.ja]),
															(n = t.ya[t.aa + t.ja]),
															(b = t.kc ? n.Ad : 0))
														)
															(o.la = h.la = 0),
																n.Za || (o.Na = h.Na = 0),
																(n.Hc = 0),
																(n.Gc = 0),
																(n.ia = 0);
														else {
															var p, A;
															if (
																((o = h),
																(h = f),
																(b = t.Pa.Xc),
																(d = t.ya[t.aa + t.ja]),
																(v = t.pb[d.$b]),
																(s = d.ad),
																(w = 0),
																(g = t.rb[t.sb - 1]),
																(k = P = 0),
																l(s, w, 0, 384),
																d.Za)
															)
																var L = 0,
																	R = b[3];
															else {
																m = c(16);
																var y = o.Na + g.Na;
																if (
																	((y = it(h, b[1], y, v.Eb, 0, m, 0)),
																	(o.Na = g.Na = (0 < y) + 0),
																	1 < y)
																)
																	ei(m, 0, s, w);
																else {
																	var _ = (m[0] + 3) >> 3;
																	for (m = 0; 256 > m; m += 16) s[w + m] = _;
																}
																(L = 1), (R = b[0]);
															}
															var V = 15 & o.la,
																B = 15 & g.la;
															for (m = 0; 4 > m; ++m) {
																var C = 1 & B;
																for (_ = A = 0; 4 > _; ++_)
																	(V =
																		(V >> 1) |
																		((C = (y = it(h, R, (y = C + (1 & V)), v.Sc, L, s, w)) > L) <<
																			7)),
																		(A = (A << 2) | (3 < y ? 3 : 1 < y ? 2 : 0 != s[w + 0])),
																		(w += 16);
																(V >>= 4), (B = (B >> 1) | (C << 7)), (P = ((P << 8) | A) >>> 0);
															}
															for (R = V, L = B >> 4, p = 0; 4 > p; p += 2) {
																for (
																	A = 0, V = o.la >> (4 + p), B = g.la >> (4 + p), m = 0;
																	2 > m;
																	++m
																) {
																	for (C = 1 & B, _ = 0; 2 > _; ++_)
																		(y = C + (1 & V)),
																			(V =
																				(V >> 1) |
																				((C = 0 < (y = it(h, b[2], y, v.Qc, 0, s, w))) << 3)),
																			(A = (A << 2) | (3 < y ? 3 : 1 < y ? 2 : 0 != s[w + 0])),
																			(w += 16);
																	(V >>= 2), (B = (B >> 1) | (C << 5));
																}
																(k |= A << (4 * p)), (R |= (V << 4) << p), (L |= (240 & B) << p);
															}
															(o.la = R),
																(g.la = L),
																(d.Hc = P),
																(d.Gc = k),
																(d.ia = 43690 & k ? 0 : v.ia),
																(b = !(P | k));
														}
														if (
															(0 < t.L &&
																((t.wa[t.Y + t.ja] = t.gd[n.$b][n.Za]),
																(t.wa[t.Y + t.ja].La |= !b)),
															f.Ka)
														)
															return Xr(r, 7, "Premature end-of-file encountered.");
													}
													if (
														(Qr(r),
														(t = a),
														(f = 1),
														(n = (i = r).D),
														(o = 0 < i.L && i.M >= i.zb && i.M <= i.Va),
														0 == i.Aa)
													)
														a: {
															if (
																((n.M = i.M),
																(n.uc = o),
																Fn(i, n),
																(f = 1),
																(n = (A = i.D).Nb),
																(o = (k = Ht[i.L]) * i.R),
																(h = (k / 2) * i.B),
																(m = 16 * n * i.R),
																(_ = 8 * n * i.B),
																(b = i.sa),
																(d = i.ta - o + m),
																(v = i.qa),
																(s = i.ra - h + _),
																(w = i.Ha),
																(g = i.Ia - h + _),
																(B = 0 == (V = A.M)),
																(P = V >= i.Va - 1),
																2 == i.Aa && Fn(i, A),
																A.uc)
															)
																for (C = (y = i).D.M, e(y.D.uc), A = y.yb; A < y.Hb; ++A) {
																	(L = A), (R = C);
																	var I = (U = (W = y).D).Nb;
																	p = W.R;
																	var U = U.wa[U.Y + L],
																		M = W.sa,
																		F = W.ta + 16 * I * p + 16 * L,
																		j = U.dd,
																		O = U.tc;
																	if (0 != O)
																		if ((e(3 <= O), 1 == W.L))
																			0 < L && mi(M, F, p, O + 4),
																				U.La && Ai(M, F, p, O),
																				0 < R && ki(M, F, p, O + 4),
																				U.La && pi(M, F, p, O);
																		else {
																			var S = W.B,
																				T = W.qa,
																				H = W.ra + 8 * I * S + 8 * L,
																				D = W.Ha,
																				W = W.Ia + 8 * I * S + 8 * L;
																			(I = U.ld),
																				0 < L &&
																					(hi(M, F, p, O + 4, j, I),
																					di(T, H, D, W, S, O + 4, j, I)),
																				U.La && (wi(M, F, p, O, j, I), Pi(T, H, D, W, S, O, j, I)),
																				0 < R &&
																					(si(M, F, p, O + 4, j, I),
																					bi(T, H, D, W, S, O + 4, j, I)),
																				U.La && (vi(M, F, p, O, j, I), gi(T, H, D, W, S, O, j, I));
																		}
																}
															if (
																(i.ia && console.info(`Stickers decoder: DitherRow`), null != t.put)
															) {
																if (
																	((A = 16 * V),
																	(V = 16 * (V + 1)),
																	B
																		? ((t.y = i.sa),
																		  (t.O = i.ta + m),
																		  (t.f = i.qa),
																		  (t.N = i.ra + _),
																		  (t.ea = i.Ha),
																		  (t.W = i.Ia + _))
																		: ((A -= k),
																		  (t.y = b),
																		  (t.O = d),
																		  (t.f = v),
																		  (t.N = s),
																		  (t.ea = w),
																		  (t.W = g)),
																	P || (V -= k),
																	V > t.o && (V = t.o),
																	(t.F = null),
																	(t.J = null),
																	null != i.Fa &&
																		0 < i.Fa.length &&
																		A < V &&
																		((t.J = hn(i, t, A, V - A)),
																		(t.F = i.mb),
																		null == t.F && 0 == t.F.length))
																) {
																	f = Xr(i, 3, "Could not decode alpha data.");
																	break a;
																}
																A < t.j &&
																	((k = t.j - A),
																	(A = t.j),
																	e(!(1 & k)),
																	(t.O += i.R * k),
																	(t.N += i.B * (k >> 1)),
																	(t.W += i.B * (k >> 1)),
																	null != t.F && (t.J += t.width * k)),
																	A < V &&
																		((t.O += t.v),
																		(t.N += t.v >> 1),
																		(t.W += t.v >> 1),
																		null != t.F && (t.J += t.v),
																		(t.ka = A - t.j),
																		(t.U = t.va - t.v),
																		(t.T = V - A),
																		(f = t.put(t)));
															}
															n + 1 != i.Ic ||
																P ||
																(u(i.sa, i.ta - o, b, d + 16 * i.R, o),
																u(i.qa, i.ra - h, v, s + 8 * i.B, h),
																u(i.Ha, i.Ia - h, w, g + 8 * i.B, h));
														}
													if (!f) return Xr(r, 6, "Output aborted.");
												}
												return 1;
											})(r, a)),
											null != a.bc && a.bc(a),
											(n &= 1);
									}
									return n ? ((r.cb = 0), n) : 0;
								})(r, i) || (a = r.a);
							}
						} else a = r.a;
					}
					0 == a && null != s.Oa && s.Oa.fd && (a = Sn(s.ba));
				}
				s = a;
			}
			f = 0 != s ? null : 11 > f ? h.f.RGBA.eb : h.f.kb.y;
		} else f = null;
		return f;
	};
	var Wt = [3, 4, 3, 4, 4, 2, 2, 4, 4, 4, 2, 1, 1];
};
function b(r, a) {
	for (var n = "", i = 0; i < 4; i++) n += String.fromCharCode(r[a++]);
	return n;
}
function d(r, a) {
	return ((r[a + 0] << 0) | (r[a + 1] << 8) | (r[a + 2] << 16)) >>> 0;
}
function v(r, a) {
	return ((r[a + 0] << 0) | (r[a + 1] << 8) | (r[a + 2] << 16) | (r[a + 3] << 24)) >>> 0;
}

export default function decodeWebP(r, a) {
	return new Promise((resolve, reject) => {
		try {
			performance.now();
			var e = new h(),
				f = new Uint8Array(r),
				u = (function (r, a) {
					var n = {},
						i = 0,
						t = !1,
						e = 0,
						f = 0;
					if (
						((n.frames = []),
						!(function (r, a, n, i) {
							for (var t = 0; t < 4; t++) if (r[a + t] != "RIFF".charCodeAt(t)) return !0;
							return !1;
						})(r, a))
					) {
						var u, l;
						for (v(r, (a += 4)), a += 8; a < r.length; ) {
							var c = b(r, a),
								o = v(r, (a += 4));
							a += 4;
							var s = o + (1 & o);
							switch (c) {
								case "VP8 ":
								case "VP8L":
									void 0 === n.frames[i] && (n.frames[i] = {}),
										((g = n.frames[i]).src_off = t ? f : a - 8),
										(g.src_size = e + o + 8),
										i++,
										t && ((t = !1), (e = 0), (f = 0));
									break;
								case "VP8X":
									(g = n.header = {}).feature_flags = r[a];
									var h = a + 4;
									(g.canvas_width = 1 + d(r, h)),
										(h += 3),
										(g.canvas_height = 1 + d(r, h)),
										(h += 3);
									break;
								case "ALPH":
									(t = !0), (e = s + 8), (f = a - 8);
									break;
								case "ANIM":
									((g = n.header).bgcolor = v(r, a)),
										(h = a + 4),
										(g.loop_count = ((u = r)[(l = h) + 0] << 0) | (u[l + 1] << 8)),
										(h += 2);
									break;
								case "ANMF":
									var w, g;
									((g = n.frames[i] = {}).offset_x = 2 * d(r, a)),
										(a += 3),
										(g.offset_y = 2 * d(r, a)),
										(a += 3),
										(g.width = 1 + d(r, a)),
										(a += 3),
										(g.height = 1 + d(r, a)),
										(a += 3),
										(g.duration = d(r, a)),
										(a += 3),
										(w = r[a++]),
										(g.dispose = 1 & w),
										(g.blend = (w >> 1) & 1);
							}
							"ANMF" != c && (a += s);
						}
						return n;
					}
				})(f, 0);
			null == u.frames && reject("Cannot parse WebP Riff"),
				(u.frames = [u.frames[0]]),
				(function (r, a, n) {
					var i, t;
					if (null == a.frames) return a;
					var e = [0],
						f = [0],
						u = a.frames[0],
						l = r.WebPDecodeRGBA(
							n,
							null != (i = u.src_off) ? i : 0,
							null != (t = u.src_size) ? t : 0,
							f,
							e
						);
					(u.rgba = l), (u.imgwidth = f[0]), (u.imgheight = e[0]);
				})(e, u, f);
			var l = (function (r, a) {
				var n = r.header ? r.header : null,
					t = r.frames ? r.frames : null,
					e = n && n.canvas_width,
					f = n && n.canvas_height;
				if (null == e || null == f || null == t || null == n)
					return console.error(`WebP image wasn't decoded`), null;
				try {
					var u = new Uint8Array(e * f * 4),
						l = t[0];
					if (null == l.imgwidth || null == l.imgheight) return null;
					for (
						var c = l.imgwidth,
							o = l.imgheight,
							s = l.rgba,
							h = null == l.offset_x ? 0 : l.offset_x,
							b = null == l.offset_y ? 0 : l.offset_y,
							d = 0,
							v = b;
						v < b + o;
						v++
					)
						for (var w = h; w < h + c; w++, d += 4)
							(u[4 * (w + v * e)] = s[d]),
								(u[4 * (w + v * e) + 1] = s[d + 1]),
								(u[4 * (w + v * e) + 2] = s[d + 2]),
								(u[4 * (w + v * e) + 3] = s[d + 3]);
					for (var g = { width: e, height: f, rgba: u }, P = 0; P < a; P++) g = i(g);
					return {
						width: g.width,
						height: g.height,
						rgba: g.rgba.buffer,
					};
				} catch (r) {
					return console.error(`Frame drawing was failed. ${r}`), null;
				}
			})(u, a);
			if (null == l) return void reject(new Error("WebP Image cannot be parsed"));
			resolve(l);
		} catch (r) {
			reject(new Error("WebP Image cannot be parsed: " + r.toString));
		}
	});
}
