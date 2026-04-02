import e from "./aurora";
!(function e(r, t, a) {
	function i(s, o) {
		if (!t[s]) {
			if (!r[s]) throw new Error("Cannot find module '" + s + "'");
			var n = (t[s] = { exports: {} });
			r[s][0].call(
				n.exports,
				function (e) {
					var t = r[s][1][e];
					return i(t || e);
				},
				n,
				n.exports,
				e,
				r,
				t,
				a
			);
		}
		return t[s].exports;
	}
	for (var s = 0; s < a.length; s++) i(a[s]);
	return i;
})(
	{
		1: [
			function (e, r, t) {
				(t.FLACDemuxer = e("./src/demuxer")), (t.FLACDecoder = e("./src/decoder")), e("./src/ogg");
			},
			{ "./src/decoder": 2, "./src/demuxer": 3, "./src/ogg": 4 },
		],
		2: [
			function (r, t, a) {
				(function (r) {
					var a = e.Decoder.extend(function () {
						e.Decoder.register("flac", this),
							(this.prototype.setCookie = function (e) {
								(this.cookie = e), (this.decoded = []);
								for (var r = 0; r < this.format.channelsPerFrame; r++) this.decoded[r] = new Int32Array(e.maxBlockSize);
								this.lpc_total = new Int32Array(2);
							});
						const r = new Int16Array([
								0, 192, 576, 1152, 2304, 4608, 0, 0, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768,
							]),
							t = new Int32Array([
								0, 88200, 176400, 192e3, 8e3, 16e3, 22050, 24e3, 32e3, 44100, 48e3, 96e3, 0, 0, 0, 0,
							]),
							a = new Int8Array([0, 8, 12, 0, 16, 20, 24, 0]);
						(this.prototype.readChunk = function () {
							var e = this.bitstream;
							if (e.available(32)) {
								if (32764 != (32767 & e.read(15))) throw new Error("Invalid sync code");
								e.read(1);
								var i,
									s = e.read(4),
									o = e.read(4),
									n = e.read(4),
									d = e.read(3);
								if ((e.advance(1), (this.chMode = n), n < 8)) (i = n + 1), (this.chMode = 0);
								else {
									if (!(n <= 10)) throw new Error("Invalid channel mode");
									i = 2;
								}
								if (i !== this.format.channelsPerFrame)
									throw new Error("Switching channel layout mid-stream not supported.");
								if (3 === d || 7 === d) throw new Error("Invalid sample size code");
								if (((this.bps = a[d]), this.bps !== this.format.bitsPerChannel))
									throw new Error("Switching bits per sample mid-stream not supported.");
								for (var f = 0; 1 === e.read(1); ) f++;
								for (var h = e.read(7 - f); f > 1; f--) e.advance(2), (h = (h << 6) | e.read(6));
								if (0 === s) throw new Error("Reserved blocksize code");
								if (((this.blockSize = 6 === s ? e.read(8) + 1 : 7 === s ? e.read(16) + 1 : r[s]), o < 12)) t[o];
								else if (12 === o) 1e3 * e.read(8);
								else if (13 === o) e.read(16);
								else {
									if (14 !== o) throw new Error("Invalid sample rate code");
									10 * e.read(16);
								}
								e.advance(8);
								for (var c = 0; c < i; c++) this.decodeSubframe(c);
								e.align(), e.advance(16);
								var l = this.bps > 16,
									u = new ArrayBuffer(this.blockSize * i * (l ? 4 : 2)),
									p = l ? new Int32Array(u) : new Int16Array(u),
									m = this.blockSize,
									v = this.decoded,
									w = 0;
								switch (this.chMode) {
									case 0:
										for (var b = 0; b < m; b++) for (c = 0; c < i; c++) p[w++] = v[c][b];
										break;
									case 8:
										for (c = 0; c < m; c++) {
											var I = v[0][c],
												k = v[1][c];
											(p[w++] = I), (p[w++] = I - k);
										}
										break;
									case 9:
										for (c = 0; c < m; c++) {
											(I = v[0][c]), (k = v[1][c]);
											(p[w++] = I + k), (p[w++] = k);
										}
										break;
									case 10:
										for (c = 0; c < m; c++) {
											I = v[0][c];
											(I -= (k = v[1][c]) >> 1), (p[w++] = I + k), (p[w++] = I);
										}
								}
								return p;
							}
						}),
							(this.prototype.decodeSubframe = function (e) {
								var r = 0,
									t = this.bitstream,
									a = this.blockSize,
									i = this.decoded;
								if (
									((this.curr_bps = this.bps),
									0 === e
										? 9 === this.chMode && this.curr_bps++
										: (8 !== this.chMode && 10 !== this.chMode) || this.curr_bps++,
									t.read(1))
								)
									throw new Error("Invalid subframe padding");
								var s = t.read(6);
								if (t.read(1)) {
									for (r = 1; !t.read(1); ) r++;
									this.curr_bps -= r;
								}
								if (this.curr_bps > 32) throw new Error("decorrelated bit depth > 32 (" + this.curr_bps + ")");
								if (0 === s) for (var o = t.read(this.curr_bps, !0), n = 0; n < a; n++) i[e][n] = o;
								else if (1 === s) {
									var d = this.curr_bps;
									for (n = 0; n < a; n++) i[e][n] = t.read(d, !0);
								} else if (s >= 8 && s <= 12) this.decode_subframe_fixed(e, -9 & s);
								else {
									if (!(s >= 32)) throw new Error("Invalid coding type");
									this.decode_subframe_lpc(e, 1 + (-33 & s));
								}
								if (r) for (n = 0; n < a; n++) i[e][n] <<= r;
							}),
							(this.prototype.decode_subframe_fixed = function (e, r) {
								for (var t = this.decoded[e], a = this.bitstream, i = this.curr_bps, s = 0; s < r; s++)
									t[s] = a.read(i, !0);
								this.decode_residuals(e, r);
								var o = 0,
									n = 0,
									d = 0,
									f = 0;
								switch (
									(r > 0 && (o = t[r - 1]),
									r > 1 && (n = o - t[r - 2]),
									r > 2 && (d = n - t[r - 2] + t[r - 3]),
									r > 3 && (f = d - t[r - 2] + 2 * t[r - 3] - t[r - 4]),
									r)
								) {
									case 0:
										break;
									case 1:
									case 2:
									case 3:
									case 4:
										var h = new Int32Array([o, n, d, f]),
											c = this.blockSize;
										for (s = r; s < c; s++) {
											h[r - 1] += t[s];
											for (var l = r - 2; l >= 0; l--) h[l] += h[l + 1];
											t[s] = h[0];
										}
										break;
									default:
										throw new Error("Invalid Predictor Order " + r);
								}
							}),
							(this.prototype.decode_subframe_lpc = function (e, r) {
								for (
									var t = this.bitstream, a = this.decoded[e], i = this.curr_bps, o = this.blockSize, n = 0;
									n < r;
									n++
								)
									a[n] = t.read(i, !0);
								var d = t.read(4) + 1;
								if (16 === d) throw new Error("Invalid coefficient precision");
								var f = t.read(5, !0);
								if (f < 0) throw new Error("Negative qlevel, maybe buggy stream");
								var h = new Int32Array(32);
								for (n = 0; n < r; n++) h[n] = t.read(d, !0);
								if ((this.decode_residuals(e, r), this.bps <= 16)) {
									for (n = r; n < o - 1; n += 2) {
										for (var c = a[n - r], l = 0, u = 0, p = 0, m = r - 1; m > 0; m--)
											(l += (p = h[m]) * c), (u += p * (c = a[n - m]));
										(l += (p = h[0]) * c), (u += p * (c = a[n] += l >> f)), (a[n + 1] += u >> f);
									}
									if (n < o) {
										var v = 0;
										for (m = 0; m < r; m++) v += h[m] * a[n - m - 1];
										a[n] += v >> f;
									}
								} else {
									var w = this.lpc_total;
									for (n = r; n < o; n++) {
										for (w[0] = 0, w[1] = 0, m = 0; m < r; m++) s(w, h[m], a[n - m - 1]);
										a[n] += (w[0] >>> f) | (w[1] << (32 - f));
									}
								}
							});
						const i = Math.pow(2, 32);
						function s(e, r, t) {
							var a = r * t,
								s = a < 0;
							s && (a = -a);
							var o = a % i | 0,
								n = (a / i) | 0;
							s && ((o = 1 + ~o), (n = ~n));
							var d = e[1] >>> 16,
								f = 65535 & e[1],
								h = e[0] >>> 16,
								c = 0,
								l = 0,
								u = 0,
								p = 0;
							(u += (p += (65535 & e[0]) + (65535 & o)) >>> 16),
								(p &= 65535),
								(l += (u += h + (o >>> 16)) >>> 16),
								(u &= 65535),
								(c += (l += f + (65535 & n)) >>> 16),
								(l &= 65535),
								(c += d + (n >>> 16)),
								(c &= 65535),
								(e[0] = (u << 16) | p),
								(e[1] = (c << 16) | l);
						}
						this.prototype.decode_residuals = function (e, r) {
							var t = this.bitstream,
								a = t.read(2);
							if (a > 1) throw new Error("Illegal residual coding method " + a);
							var i = t.read(4),
								s = this.blockSize >>> i;
							if (r > s) throw new Error("Invalid predictor order " + r + " > " + s);
							for (var o = this.decoded[e], n = r, d = r, f = 0; f < 1 << i; f++) {
								var h = t.read(0 === a ? 4 : 5);
								if (h === (0 === a ? 15 : 31)) for (h = t.read(5); d < s; d++) o[n++] = t.read(h, !0);
								else for (; d < s; d++) o[n++] = this.golomb(h, 32767, 0);
								d = 0;
							}
						};
						this.prototype.golomb = function (e, r, t) {
							var a = this.bitstream,
								i = a.bitPosition,
								s = a.peek(32 - i) << i,
								o = 0,
								n =
									31 -
									(function (e) {
										var r = 0,
											t = 0;
										for (
											;
											!(
												(t = e >>> 24) ||
												((r += 8), 255 & (t = e >>> 16)) ||
												((r += 8), 255 & (t = e >>> 8)) ||
												((r += 8), 255 & (t = e))
											);

										)
											return (r += 8);
										240 & t ? (t >>>= 4) : (r += 4);
										return 8 & t ? r : 4 & t ? r + 1 : 2 & t ? r + 2 : 1 & t ? r + 3 : r + 4;
									})(1 | s);
							if (n - e >= 7 && 32 - n < r) (s >>>= n - e), (s += (30 - n) << e), a.advance(32 + e - n), (o = s);
							else {
								for (var d = 0; 0 === a.read(1); d++) s = a.peek(32 - i) << i;
								o = d < r - 1 ? (s = e ? a.read(e) : 0) + (d << e) : d === r - 1 ? (s = a.read(t)) + 1 : -1;
							}
							return (o >> 1) ^ -(1 & o);
						};
					});
					t.exports = a;
				}).call(this, "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
			},
			{},
		],
		3: [
			function (r, t, a) {
				(function (r) {
					var a = e.Demuxer.extend(function () {
						e.Demuxer.register(this),
							(this.probe = function (e) {
								return "fLaC" === e.peekString(0, 4);
							});
						this.prototype.readChunk = function () {
							var r = this.stream;
							if (!this.readHeader && r.available(4)) {
								if ("fLaC" !== r.readString(4)) return this.emit("error", "Invalid FLAC file.");
								this.readHeader = !0;
							}
							for (; r.available(1) && !this.last; ) {
								if (!this.readBlockHeaders) {
									var t = r.readUInt8();
									(this.last = !(128 & ~t)), (this.type = 127 & t), (this.size = r.readUInt24());
								}
								if (!this.foundStreamInfo && 0 !== this.type)
									return this.emit("error", "STREAMINFO must be the first block");
								if (!r.available(this.size)) return;
								switch (this.type) {
									case 0:
										if (this.foundStreamInfo) return this.emit("error", "STREAMINFO can only occur once.");
										if (34 !== this.size) return this.emit("error", "STREAMINFO size is wrong.");
										this.foundStreamInfo = !0;
										var a = new e.Bitstream(r),
											i = {
												minBlockSize: a.read(16),
												maxBlockSize: a.read(16),
												minFrameSize: a.read(24),
												maxFrameSize: a.read(24),
											};
										(this.format = {
											formatID: "flac",
											sampleRate: a.read(20),
											channelsPerFrame: a.read(3) + 1,
											bitsPerChannel: a.read(5) + 1,
										}),
											this.emit("format", this.format),
											this.emit("cookie", i);
										var s = a.read(36);
										this.emit("duration", ((s / this.format.sampleRate) * 1e3) | 0),
											r.advance(16),
											(this.readBlockHeaders = !1);
										break;
									case 3:
										for (var o = 0; o < this.size / 18; o++)
											if (4294967295 == r.peekUInt32(0) && 4294967295 == r.peekUInt32(1)) r.advance(18);
											else {
												r.readUInt32() > 0 &&
													this.emit("error", "Seek points with sample number >UInt32 not supported");
												var n = r.readUInt32();
												r.readUInt32() > 0 &&
													this.emit("error", "Seek points with stream offset >UInt32 not supported");
												var d = r.readUInt32();
												r.advance(2), this.addSeekPoint(d, n);
											}
										break;
									case 4:
										this.metadata || (this.metadata = {});
										var f = r.readUInt32(!0);
										this.metadata.vendor = r.readString(f);
										for (var h = r.readUInt32(!0), c = 0; c < h; c++) {
											f = r.readUInt32(!0);
											var l = r.readString(f, "utf8"),
												u = l.indexOf("=");
											this.metadata[l.slice(0, u).toLowerCase()] = l.slice(u + 1);
										}
										break;
									case 6:
										if (3 !== r.readUInt32()) r.advance(this.size - 4);
										else {
											var p = r.readUInt32(),
												m = (r.readString(p), r.readUInt32()),
												v =
													(r.readString(m),
													r.readUInt32(),
													r.readUInt32(),
													r.readUInt32(),
													r.readUInt32(),
													(h = r.readUInt32()),
													r.readBuffer(h));
											this.metadata || (this.metadata = {}), (this.metadata.coverArt = v);
										}
										break;
									default:
										r.advance(this.size), (this.readBlockHeaders = !1);
								}
								this.last && this.metadata && this.emit("metadata", this.metadata);
							}
							for (; r.available(1) && this.last; ) {
								var w = r.readSingleBuffer(r.remainingBytes());
								this.emit("data", w);
							}
						};
					});
					t.exports = a;
				}).call(this, "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
			},
			{},
		],
		4: [
			function (r, t, a) {
				(function (r) {
					try {
						var t = "undefined" != typeof window ? window.AV.OggDemuxer : void 0 !== r ? r.AV.OggDemuxer : null;
					} catch (e) {}
					t &&
						t.plugins.push({
							magic: "FLAC",
							init: function () {
								(this.list = new e.BufferList()), (this.stream = new e.Stream(this.list));
							},
							readHeaders: function (r) {
								var t = this.stream;
								if ((this.list.append(new e.Buffer(r)), t.advance(5), 1 != t.readUInt8()))
									throw new Error("Unsupported FLAC version");
								if ((t.advance(3), "fLaC" != t.peekString(0, 4))) throw new Error("Not flac");
								if (((this.flac = e.Demuxer.find(t.peekSingleBuffer(0, t.remainingBytes()))), !this.flac))
									throw new Error("Flac demuxer not found");
								return this.flac.prototype.readChunk.call(this), !0;
							},
							readPacket: function (r) {
								this.list.append(new e.Buffer(r)), this.flac.prototype.readChunk.call(this);
							},
						});
				}).call(this, "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
			},
			{},
		],
	},
	{},
	[1]
);
export default e;
