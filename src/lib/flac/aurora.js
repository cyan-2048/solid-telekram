const t = (function () {
	function t(e, r, i) {
		function s(a, o) {
			if (!r[a]) {
				if (!e[a]) {
					var h = "function" == typeof require && require;
					if (!o && h) return h(a, !0);
					if (n) return n(a, !0);
					var u = new Error("Cannot find module '" + a + "'");
					throw ((u.code = "MODULE_NOT_FOUND"), u);
				}
				var f = (r[a] = { exports: {} });
				e[a][0].call(
					f.exports,
					function (t) {
						return s(e[a][1][t] || t);
					},
					f,
					f.exports,
					t,
					e,
					r,
					i
				);
			}
			return r[a].exports;
		}
		for (var n = "function" == typeof require && require, a = 0; a < i.length; a++) s(i[a]);
		return s;
	}
	return t;
})()(
	{
		1: [
			function (t, e, r) {
				(function () {
					var r,
						i,
						s,
						n,
						a,
						o,
						h,
						u = function (t, e) {
							return function () {
								return t.apply(e, arguments);
							};
						},
						f = {}.hasOwnProperty,
						c = function (t, e) {
							for (var r in e) f.call(e, r) && (t[r] = e[r]);
							function i() {
								this.constructor = t;
							}
							return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
						};
					(a = t("./core/events")),
						(h = t("./sources/node/http")),
						(o = t("./sources/node/file")),
						(i = t("./sources/buffer")),
						(n = t("./demuxer")),
						(s = t("./decoder")),
						(r = (function (t) {
							function e(t) {
								var e;
								(this.source = t),
									(this._decode = u(this._decode, this)),
									(this.findDecoder = u(this.findDecoder, this)),
									(this.probe = u(this.probe, this)),
									(this.buffered = 0),
									(this.duration = null),
									(this.format = null),
									(this.metadata = null),
									(this.active = !1),
									(this.demuxer = null),
									(this.decoder = null),
									this.source.once("data", this.probe),
									this.source.on(
										"error",
										((e = this),
										function (t) {
											return e.emit("error", t), e.stop();
										})
									),
									this.source.on(
										"progress",
										(function (t) {
											return function (e) {
												return (t.buffered = e), t.emit("buffer", t.buffered);
											};
										})(this)
									);
							}
							return (
								c(e, t),
								(e.fromURL = function (t, r) {
									return new e(new h(t, r));
								}),
								(e.fromFile = function (t) {
									return new e(new o(t));
								}),
								(e.fromBuffer = function (t) {
									return new e(new i(t));
								}),
								(e.prototype.start = function (t) {
									if (!this.active)
										return (
											null != t && (this.shouldDecode = t),
											null == this.shouldDecode && (this.shouldDecode = !0),
											(this.active = !0),
											this.source.start(),
											this.decoder && this.shouldDecode ? this._decode() : void 0
										);
								}),
								(e.prototype.stop = function () {
									if (this.active) return (this.active = !1), this.source.pause();
								}),
								(e.prototype.get = function (t, e) {
									var r;
									if ("format" === t || "duration" === t || "metadata" === t)
										return null != this[t]
											? e(this[t])
											: (this.once(
													t,
													((r = this),
													function (t) {
														return r.stop(), e(t);
													})
											  ),
											  this.start());
								}),
								(e.prototype.decodePacket = function () {
									return this.decoder.decode();
								}),
								(e.prototype.decodeToBuffer = function (t) {
									var e, r, i;
									return (
										(i = 0),
										(e = []),
										this.on(
											"data",
											(r = function (t) {
												return (i += t.length), e.push(t);
											})
										),
										this.once("end", function () {
											var s, n, a, o, h;
											for (s = new Float32Array(i), a = 0, o = 0, h = e.length; o < h; o++)
												(n = e[o]), s.set(n, a), (a += n.length);
											return this.off("data", r), t(s);
										}),
										this.start()
									);
								}),
								(e.prototype.probe = function (t) {
									var e, r;
									if (this.active)
										return (e = n.find(t))
											? ((this.demuxer = new e(this.source, t)),
											  this.demuxer.on("format", this.findDecoder),
											  this.demuxer.on(
													"duration",
													((r = this),
													function (t) {
														return (r.duration = t), r.emit("duration", r.duration);
													})
											  ),
											  this.demuxer.on(
													"metadata",
													(function (t) {
														return function (e) {
															return (t.metadata = e), t.emit("metadata", t.metadata);
														};
													})(this)
											  ),
											  this.demuxer.on(
													"error",
													(function (t) {
														return function (e) {
															return t.emit("error", e), t.stop();
														};
													})(this)
											  ))
											: this.emit("error", "A demuxer for this container was not found.");
								}),
								(e.prototype.findDecoder = function (t) {
									var e, r, i;
									if (((this.format = t), this.active))
										return (
											this.emit("format", this.format),
											(e = s.find(this.format.formatID))
												? ((this.decoder = new e(this.demuxer, this.format)),
												  this.format.floatingPoint
														? this.decoder.on(
																"data",
																((i = this),
																function (t) {
																	return i.emit("data", t);
																})
														  )
														: ((r = Math.pow(2, this.format.bitsPerChannel - 1)),
														  this.decoder.on(
																"data",
																(function (t) {
																	return function (e) {
																		var i, s, n, a, o;
																		for (i = new Float32Array(e.length), s = a = 0, o = e.length; a < o; s = ++a)
																			(n = e[s]), (i[s] = n / r);
																		return t.emit("data", i);
																	};
																})(this)
														  )),
												  this.decoder.on(
														"error",
														(function (t) {
															return function (e) {
																return t.emit("error", e), t.stop();
															};
														})(this)
												  ),
												  this.decoder.on(
														"end",
														(function (t) {
															return function () {
																return t.emit("end");
															};
														})(this)
												  ),
												  this.emit("decodeStart"),
												  this.shouldDecode ? this._decode() : void 0)
												: this.emit("error", "A decoder for " + this.format.formatID + " was not found.")
										);
								}),
								(e.prototype._decode = function () {
									for (; this.decoder.decode() && this.active; );
									if (this.active) return this.decoder.once("data", this._decode);
								}),
								(e.prototype.destroy = function () {
									var t, e, r;
									return (
										this.stop(),
										null != (t = this.demuxer) && t.off(),
										null != (e = this.decoder) && e.off(),
										null != (r = this.source) && r.off(),
										this.off()
									);
								}),
								e
							);
						})(a)),
						(e.exports = r);
				}).call(this);
			},
			{
				"./core/events": 8,
				"./decoder": 11,
				"./demuxer": 14,
				"./sources/buffer": 31,
				"./sources/node/file": 29,
				"./sources/node/http": 30,
			},
		],
		2: [
			function (t, e, r) {
				(function () {
					var e, i, s;
					for (e in (s = t("./aurora_base"))) (i = s[e]), (r[e] = i);
					t("./demuxers/caf"),
						t("./demuxers/m4a"),
						t("./demuxers/aiff"),
						t("./demuxers/wave"),
						t("./demuxers/au"),
						t("./decoders/lpcm"),
						t("./decoders/xlaw");
				}).call(this);
			},
			{
				"./aurora_base": 3,
				"./decoders/lpcm": 12,
				"./decoders/xlaw": 13,
				"./demuxers/aiff": 15,
				"./demuxers/au": 16,
				"./demuxers/caf": 17,
				"./demuxers/m4a": 18,
				"./demuxers/wave": 19,
			},
		],
		3: [
			function (t, e, r) {
				(function () {
					(r.Base = t("./core/base")),
						(r.Buffer = t("./core/buffer")),
						(r.BufferList = t("./core/bufferlist")),
						(r.Stream = t("./core/stream")),
						(r.Bitstream = t("./core/bitstream")),
						(r.EventEmitter = t("./core/events")),
						(r.UnderflowError = t("./core/underflow")),
						(r.HTTPSource = t("./sources/node/http")),
						(r.FileSource = t("./sources/node/file")),
						(r.BufferSource = t("./sources/buffer")),
						(r.Demuxer = t("./demuxer")),
						(r.Decoder = t("./decoder")),
						(r.AudioDevice = t("./device")),
						(r.Asset = t("./asset")),
						(r.Player = t("./player")),
						(r.Filter = t("./filter")),
						(r.VolumeFilter = t("./filters/volume")),
						(r.BalanceFilter = t("./filters/balance"));
				}).call(this);
			},
			{
				"./asset": 1,
				"./core/base": 4,
				"./core/bitstream": 5,
				"./core/buffer": 6,
				"./core/bufferlist": 7,
				"./core/events": 8,
				"./core/stream": 9,
				"./core/underflow": 10,
				"./decoder": 11,
				"./demuxer": 14,
				"./device": 20,
				"./filter": 24,
				"./filters/balance": 25,
				"./filters/volume": 26,
				"./player": 27,
				"./sources/buffer": 31,
				"./sources/node/file": 29,
				"./sources/node/http": 30,
			},
		],
		4: [
			function (t, e, r) {
				(function () {
					var t,
						r = {}.hasOwnProperty,
						i = function (t, e) {
							for (var i in e) r.call(e, i) && (t[i] = e[i]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						},
						s =
							[].indexOf ||
							function (t) {
								for (var e = 0, r = this.length; e < r; e++) if (e in this && this[e] === t) return e;
								return -1;
							};
					(t = (function () {
						var t;
						function e() {}
						return (
							(t = /\b_super\b/),
							(e.extend = function (e) {
								var r, n, a, o, h, u;
								if (
									((r = (function (t) {
										function e() {
											return e.__super__.constructor.apply(this, arguments);
										}
										return i(e, t), e;
									})(this)),
									"function" == typeof e)
								)
									for (a in ((o = Object.keys(r.prototype)), e.call(r, r), (e = {}), (h = r.prototype)))
										(n = h[a]), s.call(o, a) < 0 && (e[a] = n);
								for (a in ((u = r.__super__), e))
									"function" == typeof (n = e[a]) && t.test(n)
										? (function (t, e) {
												r.prototype[t] = function () {
													var r, i;
													return (
														(i = this._super),
														(this._super = u[t]),
														(r = e.apply(this, arguments)),
														(this._super = i),
														r
													);
												};
										  })(a, n)
										: (r.prototype[a] = n);
								return r;
							}),
							e
						);
					})()),
						(e.exports = t);
				}).call(this);
			},
			{},
		],
		5: [
			function (t, e, r) {
				(function () {
					var t;
					(t = (function () {
						function t(t) {
							(this.stream = t), (this.bitPosition = 0);
						}
						return (
							(t.prototype.copy = function () {
								var e;
								return ((e = new t(this.stream.copy())).bitPosition = this.bitPosition), e;
							}),
							(t.prototype.offset = function () {
								return 8 * this.stream.offset + this.bitPosition;
							}),
							(t.prototype.available = function (t) {
								return this.stream.available((t + 8 - this.bitPosition) / 8);
							}),
							(t.prototype.advance = function (t) {
								var e;
								return (e = this.bitPosition + t), this.stream.advance(e >> 3), (this.bitPosition = 7 & e);
							}),
							(t.prototype.rewind = function (t) {
								var e;
								return (e = this.bitPosition - t), this.stream.rewind(Math.abs(e >> 3)), (this.bitPosition = 7 & e);
							}),
							(t.prototype.seek = function (t) {
								var e;
								return t > (e = this.offset()) ? this.advance(t - e) : t < e ? this.rewind(e - t) : void 0;
							}),
							(t.prototype.align = function () {
								if (0 !== this.bitPosition) return (this.bitPosition = 0), this.stream.advance(1);
							}),
							(t.prototype.read = function (t, e) {
								var r, i;
								if (0 === t) return 0;
								if ((i = t + this.bitPosition) <= 8)
									r = ((this.stream.peekUInt8() << this.bitPosition) & 255) >>> (8 - t);
								else if (i <= 16) r = ((this.stream.peekUInt16() << this.bitPosition) & 65535) >>> (16 - t);
								else if (i <= 24) r = ((this.stream.peekUInt24() << this.bitPosition) & 16777215) >>> (24 - t);
								else if (i <= 32) r = (this.stream.peekUInt32() << this.bitPosition) >>> (32 - t);
								else {
									if (!(i <= 40)) throw new Error("Too many bits!");
									(r =
										4294967296 * this.stream.peekUInt8(0) +
										((this.stream.peekUInt8(1) << 24) >>> 0) +
										(this.stream.peekUInt8(2) << 16) +
										(this.stream.peekUInt8(3) << 8) +
										this.stream.peekUInt8(4)),
										(r %= Math.pow(2, 40 - this.bitPosition)),
										(r = Math.floor(r / Math.pow(2, 40 - this.bitPosition - t)));
								}
								return (
									e &&
										(i < 32
											? r >>> (t - 1) && (r = -1 * (((1 << t) >>> 0) - r))
											: (r / Math.pow(2, t - 1)) | 0 && (r = -1 * (Math.pow(2, t) - r))),
									this.advance(t),
									r
								);
							}),
							(t.prototype.peek = function (t, e) {
								var r, i;
								if (0 === t) return 0;
								if ((i = t + this.bitPosition) <= 8)
									r = ((this.stream.peekUInt8() << this.bitPosition) & 255) >>> (8 - t);
								else if (i <= 16) r = ((this.stream.peekUInt16() << this.bitPosition) & 65535) >>> (16 - t);
								else if (i <= 24) r = ((this.stream.peekUInt24() << this.bitPosition) & 16777215) >>> (24 - t);
								else if (i <= 32) r = (this.stream.peekUInt32() << this.bitPosition) >>> (32 - t);
								else {
									if (!(i <= 40)) throw new Error("Too many bits!");
									(r =
										4294967296 * this.stream.peekUInt8(0) +
										((this.stream.peekUInt8(1) << 24) >>> 0) +
										(this.stream.peekUInt8(2) << 16) +
										(this.stream.peekUInt8(3) << 8) +
										this.stream.peekUInt8(4)),
										(r %= Math.pow(2, 40 - this.bitPosition)),
										(r = Math.floor(r / Math.pow(2, 40 - this.bitPosition - t)));
								}
								return (
									e &&
										(i < 32
											? r >>> (t - 1) && (r = -1 * (((1 << t) >>> 0) - r))
											: (r / Math.pow(2, t - 1)) | 0 && (r = -1 * (Math.pow(2, t) - r))),
									r
								);
							}),
							(t.prototype.readLSB = function (t, e) {
								var r, i;
								if (0 === t) return 0;
								if (t > 40) throw new Error("Too many bits!");
								return (
									(i = t + this.bitPosition),
									(r = this.stream.peekUInt8(0) >>> this.bitPosition),
									i > 8 && (r |= this.stream.peekUInt8(1) << (8 - this.bitPosition)),
									i > 16 && (r |= this.stream.peekUInt8(2) << (16 - this.bitPosition)),
									i > 24 && (r += (this.stream.peekUInt8(3) << (24 - this.bitPosition)) >>> 0),
									i > 32 && (r += this.stream.peekUInt8(4) * Math.pow(2, 32 - this.bitPosition)),
									i >= 32 ? (r %= Math.pow(2, t)) : (r &= (1 << t) - 1),
									e &&
										(i < 32
											? r >>> (t - 1) && (r = -1 * (((1 << t) >>> 0) - r))
											: (r / Math.pow(2, t - 1)) | 0 && (r = -1 * (Math.pow(2, t) - r))),
									this.advance(t),
									r
								);
							}),
							(t.prototype.peekLSB = function (t, e) {
								var r, i;
								if (0 === t) return 0;
								if (t > 40) throw new Error("Too many bits!");
								return (
									(i = t + this.bitPosition),
									(r = this.stream.peekUInt8(0) >>> this.bitPosition),
									i > 8 && (r |= this.stream.peekUInt8(1) << (8 - this.bitPosition)),
									i > 16 && (r |= this.stream.peekUInt8(2) << (16 - this.bitPosition)),
									i > 24 && (r += (this.stream.peekUInt8(3) << (24 - this.bitPosition)) >>> 0),
									i > 32 && (r += this.stream.peekUInt8(4) * Math.pow(2, 32 - this.bitPosition)),
									i >= 32 ? (r %= Math.pow(2, t)) : (r &= (1 << t) - 1),
									e &&
										(i < 32
											? r >>> (t - 1) && (r = -1 * (((1 << t) >>> 0) - r))
											: (r / Math.pow(2, t - 1)) | 0 && (r = -1 * (Math.pow(2, t) - r))),
									r
								);
							}),
							t
						);
					})()),
						(e.exports = t);
				}).call(this);
			},
			{},
		],
		6: [
			function (t, e, r) {
				(function (t) {
					(function () {
						(function () {
							var r;
							(r = (function () {
								var e, r;
								function i(e) {
									var r;
									if (e instanceof Uint8Array) this.data = e;
									else if (
										e instanceof ArrayBuffer ||
										Array.isArray(e) ||
										"number" == typeof e ||
										(null != (r = t.Buffer) ? r.isBuffer(e) : void 0)
									)
										this.data = new Uint8Array(e);
									else if (e.buffer instanceof ArrayBuffer)
										this.data = new Uint8Array(e.buffer, e.byteOffset, e.length * e.BYTES_PER_ELEMENT);
									else {
										if (!(e instanceof i)) throw new Error("Constructing buffer with unknown type.");
										this.data = e.data;
									}
									(this.length = this.data.length), (this.next = null), (this.prev = null);
								}
								return (
									(i.allocate = function (t) {
										return new i(t);
									}),
									(i.prototype.copy = function () {
										return new i(new Uint8Array(this.data));
									}),
									(i.prototype.slice = function (t, e) {
										return (
											null == e && (e = this.length),
											0 === t && e >= this.length ? new i(this.data) : new i(this.data.subarray(t, t + e))
										);
									}),
									(e = t.BlobBuilder || t.MozBlobBuilder || t.WebKitBlobBuilder),
									(r = t.URL || t.webkitURL || t.mozURL),
									(i.makeBlob = function (t, r) {
										var i;
										null == r && (r = "application/octet-stream");
										try {
											return new Blob([t], { type: r });
										} catch (t) {}
										return null != e ? ((i = new e()).append(t), i.getBlob(r)) : null;
									}),
									(i.makeBlobURL = function (t, e) {
										return null != r ? r.createObjectURL(this.makeBlob(t, e)) : void 0;
									}),
									(i.revokeBlobURL = function (t) {
										return null != r ? r.revokeObjectURL(t) : void 0;
									}),
									(i.prototype.toBlob = function () {
										return i.makeBlob(this.data.buffer);
									}),
									(i.prototype.toBlobURL = function () {
										return i.makeBlobURL(this.data.buffer);
									}),
									i
								);
							})()),
								(e.exports = r);
						}).call(this);
					}).call(this);
				}).call(
					this,
					"undefined" != typeof global
						? global
						: "undefined" != typeof self
						? self
						: "undefined" != typeof window
						? window
						: {}
				);
			},
			{},
		],
		7: [
			function (t, e, r) {
				(function () {
					var t;
					(t = (function () {
						function t() {
							(this.first = null),
								(this.last = null),
								(this.numBuffers = 0),
								(this.availableBytes = 0),
								(this.availableBuffers = 0);
						}
						return (
							(t.prototype.copy = function () {
								var e;
								return (
									((e = new t()).first = this.first),
									(e.last = this.last),
									(e.numBuffers = this.numBuffers),
									(e.availableBytes = this.availableBytes),
									(e.availableBuffers = this.availableBuffers),
									e
								);
							}),
							(t.prototype.append = function (t) {
								var e;
								return (
									(t.prev = this.last),
									null != (e = this.last) && (e.next = t),
									(this.last = t),
									null == this.first && (this.first = t),
									(this.availableBytes += t.length),
									this.availableBuffers++,
									this.numBuffers++
								);
							}),
							(t.prototype.advance = function () {
								return (
									!!this.first &&
									((this.availableBytes -= this.first.length),
									this.availableBuffers--,
									(this.first = this.first.next),
									null != this.first)
								);
							}),
							(t.prototype.rewind = function () {
								var t;
								return (
									!(this.first && !this.first.prev) &&
									((this.first = (null != (t = this.first) ? t.prev : void 0) || this.last),
									this.first && ((this.availableBytes += this.first.length), this.availableBuffers++),
									null != this.first)
								);
							}),
							(t.prototype.reset = function () {
								var t;
								for (t = []; this.rewind(); );
								return t;
							}),
							t
						);
					})()),
						(e.exports = t);
				}).call(this);
			},
			{},
		],
		8: [
			function (t, e, r) {
				(function () {
					var r,
						i = {}.hasOwnProperty,
						s = function (t, e) {
							for (var r in e) i.call(e, r) && (t[r] = e[r]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						},
						n = [].slice;
					(r = (function (t) {
						function e() {
							return e.__super__.constructor.apply(this, arguments);
						}
						return (
							s(e, t),
							(e.prototype.on = function (t, e) {
								var r;
								return (
									null == this.events && (this.events = {}),
									null == (r = this.events)[t] && (r[t] = []),
									this.events[t].push(e)
								);
							}),
							(e.prototype.off = function (t, e) {
								var r, i;
								if (null != this.events)
									if (null != (i = this.events) ? i[t] : void 0) {
										if (null == e) return this.events[t];
										if (~(r = this.events[t].indexOf(e))) return this.events[t].splice(r, 1);
									} else if (null == t) return {};
							}),
							(e.prototype.once = function (t, e) {
								var r;
								return this.on(
									t,
									(r = function () {
										return this.off(t, r), e.apply(this, arguments);
									})
								);
							}),
							(e.prototype.emit = function () {
								var t, e, r, i, s, a;
								if (
									((e = arguments[0]),
									(t = 2 <= arguments.length ? n.call(arguments, 1) : []),
									null != (s = this.events) ? s[e] : void 0)
								)
									for (r = 0, i = (a = this.events[e].slice()).length; r < i; r++) a[r].apply(this, t);
							}),
							e
						);
					})(t("./base"))),
						(e.exports = r);
				}).call(this);
			},
			{ "./base": 4 },
		],
		9: [
			function (t, e, r) {
				(function () {
					var r, i, s, n;
					(i = t("./bufferlist")),
						(r = t("./buffer")),
						(n = t("./underflow")),
						(s = (function () {
							var t, e, s, a, o, h, u, f, c, l, p, d, m;
							function v(t) {
								(this.list = t), (this.localOffset = 0), (this.offset = 0);
							}
							return (
								(t = new ArrayBuffer(16)),
								(m = new Uint8Array(t)),
								(c = new Int8Array(t)),
								(p = new Uint16Array(t)),
								(u = new Int16Array(t)),
								(d = new Uint32Array(t)),
								(f = new Int32Array(t)),
								(s = new Float32Array(t)),
								"undefined" != typeof Float64Array && null !== Float64Array && (a = new Float64Array(t)),
								(l = 13330 === new Uint16Array(new Uint8Array([18, 52]).buffer)[0]),
								(v.fromBuffer = function (t) {
									var e;
									return (e = new i()).append(t), new v(e);
								}),
								(v.prototype.copy = function () {
									var t;
									return ((t = new v(this.list.copy())).localOffset = this.localOffset), (t.offset = this.offset), t;
								}),
								(v.prototype.available = function (t) {
									return t <= this.list.availableBytes - this.localOffset;
								}),
								(v.prototype.remainingBytes = function () {
									return this.list.availableBytes - this.localOffset;
								}),
								(v.prototype.advance = function (t) {
									if (!this.available(t)) throw new n();
									for (
										this.localOffset += t, this.offset += t;
										this.list.first && this.localOffset >= this.list.first.length;

									)
										(this.localOffset -= this.list.first.length), this.list.advance();
									return this;
								}),
								(v.prototype.rewind = function (t) {
									if (t > this.offset) throw new n();
									for (
										this.list.first || (this.list.rewind(), (this.localOffset = this.list.first.length)),
											this.localOffset -= t,
											this.offset -= t;
										this.list.first.prev && this.localOffset < 0;

									)
										this.list.rewind(), (this.localOffset += this.list.first.length);
									return this;
								}),
								(v.prototype.seek = function (t) {
									return t > this.offset
										? this.advance(t - this.offset)
										: t < this.offset
										? this.rewind(this.offset - t)
										: void 0;
								}),
								(v.prototype.readUInt8 = function () {
									var t;
									if (!this.available(1)) throw new n();
									return (
										(t = this.list.first.data[this.localOffset]),
										(this.localOffset += 1),
										(this.offset += 1),
										this.localOffset === this.list.first.length && ((this.localOffset = 0), this.list.advance()),
										t
									);
								}),
								(v.prototype.peekUInt8 = function (t) {
									var e;
									if ((null == t && (t = 0), !this.available(t + 1))) throw new n();
									for (t = this.localOffset + t, e = this.list.first; e; ) {
										if (e.length > t) return e.data[t];
										(t -= e.length), (e = e.next);
									}
									return 0;
								}),
								(v.prototype.read = function (t, e) {
									var r, i, s;
									if ((null == e && (e = !1), e === l)) for (r = i = 0; i < t; r = i += 1) m[r] = this.readUInt8();
									else for (r = s = t - 1; s >= 0; r = s += -1) m[r] = this.readUInt8();
								}),
								(v.prototype.peek = function (t, e, r) {
									var i, s, n;
									if ((null == r && (r = !1), r === l)) for (i = s = 0; s < t; i = s += 1) m[i] = this.peekUInt8(e + i);
									else for (i = n = 0; n < t; i = n += 1) m[t - i - 1] = this.peekUInt8(e + i);
								}),
								(v.prototype.readInt8 = function () {
									return this.read(1), c[0];
								}),
								(v.prototype.peekInt8 = function (t) {
									return null == t && (t = 0), this.peek(1, t), c[0];
								}),
								(v.prototype.readUInt16 = function (t) {
									return this.read(2, t), p[0];
								}),
								(v.prototype.peekUInt16 = function (t, e) {
									return null == t && (t = 0), this.peek(2, t, e), p[0];
								}),
								(v.prototype.readInt16 = function (t) {
									return this.read(2, t), u[0];
								}),
								(v.prototype.peekInt16 = function (t, e) {
									return null == t && (t = 0), this.peek(2, t, e), u[0];
								}),
								(v.prototype.readUInt24 = function (t) {
									return t
										? this.readUInt16(!0) + (this.readUInt8() << 16)
										: (this.readUInt16() << 8) + this.readUInt8();
								}),
								(v.prototype.peekUInt24 = function (t, e) {
									return (
										null == t && (t = 0),
										e
											? this.peekUInt16(t, !0) + (this.peekUInt8(t + 2) << 16)
											: (this.peekUInt16(t) << 8) + this.peekUInt8(t + 2)
									);
								}),
								(v.prototype.readInt24 = function (t) {
									return t ? this.readUInt16(!0) + (this.readInt8() << 16) : (this.readInt16() << 8) + this.readUInt8();
								}),
								(v.prototype.peekInt24 = function (t, e) {
									return (
										null == t && (t = 0),
										e
											? this.peekUInt16(t, !0) + (this.peekInt8(t + 2) << 16)
											: (this.peekInt16(t) << 8) + this.peekUInt8(t + 2)
									);
								}),
								(v.prototype.readUInt32 = function (t) {
									return this.read(4, t), d[0];
								}),
								(v.prototype.peekUInt32 = function (t, e) {
									return null == t && (t = 0), this.peek(4, t, e), d[0];
								}),
								(v.prototype.readInt32 = function (t) {
									return this.read(4, t), f[0];
								}),
								(v.prototype.peekInt32 = function (t, e) {
									return null == t && (t = 0), this.peek(4, t, e), f[0];
								}),
								(v.prototype.readFloat32 = function (t) {
									return this.read(4, t), s[0];
								}),
								(v.prototype.peekFloat32 = function (t, e) {
									return null == t && (t = 0), this.peek(4, t, e), s[0];
								}),
								(v.prototype.readFloat64 = function (t) {
									return this.read(8, t), a ? a[0] : o();
								}),
								(o = function () {
									var t, e, r, i, s, n;
									return (
										(i = d[0]),
										(r = d[1]) && 2147483648 !== r
											? ((n = 1 - 2 * (r >>> 31)),
											  (e = 1048575 & r),
											  2047 == (t = (r >>> 20) & 2047)
													? e
														? NaN
														: n * (1 / 0)
													: ((t -= 1023),
													  (s = (1048576 | e) * Math.pow(2, t - 20)),
													  n * (s += i * Math.pow(2, t - 52))))
											: 0
									);
								}),
								(v.prototype.peekFloat64 = function (t, e) {
									return null == t && (t = 0), this.peek(8, t, e), a ? a[0] : o();
								}),
								(v.prototype.readFloat80 = function (t) {
									return this.read(10, t), h();
								}),
								(h = function () {
									var t, e, r, i, s, n;
									return (
										(r = d[0]),
										(i = d[1]),
										(n = 1 - 2 * ((t = m[9]) >>> 7)),
										0 == (e = ((127 & t) << 8) | m[8]) && 0 === i && 0 === r
											? 0
											: 32767 === e
											? 0 === i && 0 === r
												? n * (1 / 0)
												: NaN
											: ((e -= 16383), (s = i * Math.pow(2, e - 31)), n * (s += r * Math.pow(2, e - 63)))
									);
								}),
								(v.prototype.peekFloat80 = function (t, e) {
									return null == t && (t = 0), this.peek(10, t, e), h();
								}),
								(v.prototype.readBuffer = function (t) {
									var e, i, s, n;
									for (s = (i = r.allocate(t)).data, e = n = 0; n < t; e = n += 1) s[e] = this.readUInt8();
									return i;
								}),
								(v.prototype.peekBuffer = function (t, e) {
									var i, s, n, a;
									for (null == t && (t = 0), n = (s = r.allocate(e)).data, i = a = 0; a < e; i = a += 1)
										n[i] = this.peekUInt8(t + i);
									return s;
								}),
								(v.prototype.readSingleBuffer = function (t) {
									var e;
									return (e = this.list.first.slice(this.localOffset, t)), this.advance(e.length), e;
								}),
								(v.prototype.peekSingleBuffer = function (t, e) {
									return this.list.first.slice(this.localOffset + t, e);
								}),
								(v.prototype.readString = function (t, r) {
									return null == r && (r = "ascii"), e.call(this, 0, t, r, !0);
								}),
								(v.prototype.peekString = function (t, r, i) {
									return null == t && (t = 0), null == i && (i = "ascii"), e.call(this, t, r, i, !1);
								}),
								(e = function (t, e, r, i) {
									var s, n, a, o, h, u, f, c, l, p, d, m;
									switch (
										((c = null === e ? 0 : -1), null == e && (e = 1 / 0), (u = t + e), (p = ""), (r = r.toLowerCase()))
									) {
										case "ascii":
										case "latin1":
											for (; t < u && (h = this.peekUInt8(t++)) !== c; ) p += String.fromCharCode(h);
											break;
										case "utf8":
										case "utf-8":
											for (; t < u && (s = this.peekUInt8(t++)) !== c; )
												128 & s
													? 192 == (224 & s)
														? ((n = 63 & this.peekUInt8(t++)), (p += String.fromCharCode(((31 & s) << 6) | n)))
														: 224 == (240 & s)
														? ((n = 63 & this.peekUInt8(t++)),
														  (a = 63 & this.peekUInt8(t++)),
														  (p += String.fromCharCode(((15 & s) << 12) | (n << 6) | a)))
														: 240 == (248 & s) &&
														  ((l =
																(((15 & s) << 18) |
																	((n = 63 & this.peekUInt8(t++)) << 12) |
																	((a = 63 & this.peekUInt8(t++)) << 6) |
																	(63 & this.peekUInt8(t++))) -
																65536),
														  (p += String.fromCharCode(55296 + (l >> 10), 56320 + (1023 & l))))
													: (p += String.fromCharCode(s));
											break;
										case "utf16-be":
										case "utf16be":
										case "utf16le":
										case "utf16-le":
										case "utf16bom":
										case "utf16-bom":
											switch (r) {
												case "utf16be":
												case "utf16-be":
													f = !1;
													break;
												case "utf16le":
												case "utf16-le":
													f = !0;
													break;
												case "utf16bom":
												case "utf16-bom":
													if (e < 2 || (o = this.peekUInt16(t)) === c) return i && this.advance((t += 2)), p;
													(f = 65534 === o), (t += 2);
											}
											for (; t < u && (d = this.peekUInt16(t, f)) !== c; )
												if (((t += 2), d < 55296 || d > 57343)) p += String.fromCharCode(d);
												else {
													if (d > 56319) throw new Error("Invalid utf16 sequence.");
													if ((m = this.peekUInt16(t, f)) < 56320 || m > 57343)
														throw new Error("Invalid utf16 sequence.");
													(p += String.fromCharCode(d, m)), (t += 2);
												}
											d === c && (t += 2);
											break;
										default:
											throw new Error("Unknown encoding: " + r);
									}
									return i && this.advance(t), p;
								}),
								v
							);
						})()),
						(e.exports = s);
				}).call(this);
			},
			{ "./buffer": 6, "./bufferlist": 7, "./underflow": 10 },
		],
		10: [
			function (t, e, r) {
				(function () {
					var t,
						r = {}.hasOwnProperty,
						i = function (t, e) {
							for (var i in e) r.call(e, i) && (t[i] = e[i]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						};
					(t = (function (t) {
						function e() {
							e.__super__.constructor.apply(this, arguments),
								(this.name = "UnderflowError"),
								(this.stack = new Error().stack);
						}
						return i(e, t), e;
					})(Error)),
						(e.exports = t);
				}).call(this);
			},
			{},
		],
		11: [
			function (t, e, r) {
				(function () {
					var r,
						i,
						s,
						n,
						a,
						o,
						h = {}.hasOwnProperty,
						u = function (t, e) {
							for (var r in e) h.call(e, r) && (t[r] = e[r]);
							function i() {
								this.constructor = t;
							}
							return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
						};
					(n = t("./core/events")),
						(i = t("./core/bufferlist")),
						(a = t("./core/stream")),
						(r = t("./core/bitstream")),
						(o = t("./core/underflow")),
						(s = (function (t) {
							var e;
							function s(t, e) {
								var s, n;
								(this.demuxer = t),
									(this.format = e),
									(s = new i()),
									(this.stream = new a(s)),
									(this.bitstream = new r(this.stream)),
									(this.receivedFinalBuffer = !1),
									(this.waiting = !1),
									this.demuxer.on(
										"cookie",
										((n = this),
										function (t) {
											var e;
											try {
												return n.setCookie(t);
											} catch (t) {
												return (e = t), n.emit("error", e);
											}
										})
									),
									this.demuxer.on(
										"data",
										(function (t) {
											return function (e) {
												if ((s.append(e), t.waiting)) return t.decode();
											};
										})(this)
									),
									this.demuxer.on(
										"end",
										(function (t) {
											return function () {
												if (((t.receivedFinalBuffer = !0), t.waiting)) return t.decode();
											};
										})(this)
									),
									this.init();
							}
							return (
								u(s, t),
								(s.prototype.init = function () {}),
								(s.prototype.setCookie = function (t) {}),
								(s.prototype.readChunk = function () {}),
								(s.prototype.decode = function () {
									var t, e, r;
									(this.waiting = !this.receivedFinalBuffer), (e = this.bitstream.offset());
									try {
										r = this.readChunk();
									} catch (e) {
										if (!((t = e) instanceof o)) return this.emit("error", t), !1;
									}
									return r
										? (this.emit("data", r), this.receivedFinalBuffer && this.emit("end"), !0)
										: (this.receivedFinalBuffer ? this.emit("end") : (this.bitstream.seek(e), (this.waiting = !0)), !1);
								}),
								(s.prototype.seek = function (t) {
									var e;
									return (e = this.demuxer.seek(t)), this.stream.seek(e.offset), e.timestamp;
								}),
								(e = {}),
								(s.register = function (t, r) {
									return (e[t] = r);
								}),
								(s.find = function (t) {
									return e[t] || null;
								}),
								s
							);
						})(n)),
						(e.exports = s);
				}).call(this);
			},
			{ "./core/bitstream": 5, "./core/bufferlist": 7, "./core/events": 8, "./core/stream": 9, "./core/underflow": 10 },
		],
		12: [
			function (t, e, r) {
				(function () {
					var e,
						r = function (t, e) {
							return function () {
								return t.apply(e, arguments);
							};
						},
						i = {}.hasOwnProperty,
						s = function (t, e) {
							for (var r in e) i.call(e, r) && (t[r] = e[r]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						};
					!(function (t) {
						function i() {
							return (this.readChunk = r(this.readChunk, this)), i.__super__.constructor.apply(this, arguments);
						}
						s(i, t),
							e.register("lpcm", i),
							(i.prototype.readChunk = function () {
								var t, e, r, i, s, n, a, o, h, u, f, c;
								if (
									((n = this.stream),
									(r = this.format.littleEndian),
									(s = ((t = Math.min(4096, n.remainingBytes())) / (this.format.bitsPerChannel / 8)) | 0),
									t < this.format.bitsPerChannel / 8)
								)
									return null;
								if (this.format.floatingPoint)
									switch (this.format.bitsPerChannel) {
										case 32:
											for (i = new Float32Array(s), e = a = 0; a < s; e = a += 1) i[e] = n.readFloat32(r);
											break;
										case 64:
											for (i = new Float64Array(s), e = o = 0; o < s; e = o += 1) i[e] = n.readFloat64(r);
											break;
										default:
											throw new Error("Unsupported bit depth.");
									}
								else
									switch (this.format.bitsPerChannel) {
										case 8:
											for (i = new Int8Array(s), e = h = 0; h < s; e = h += 1) i[e] = n.readInt8();
											break;
										case 16:
											for (i = new Int16Array(s), e = u = 0; u < s; e = u += 1) i[e] = n.readInt16(r);
											break;
										case 24:
											for (i = new Int32Array(s), e = f = 0; f < s; e = f += 1) i[e] = n.readInt24(r);
											break;
										case 32:
											for (i = new Int32Array(s), e = c = 0; c < s; e = c += 1) i[e] = n.readInt32(r);
											break;
										default:
											throw new Error("Unsupported bit depth.");
									}
								return i;
							});
					})((e = t("../decoder")));
				}).call(this);
			},
			{ "../decoder": 11 },
		],
		13: [
			function (t, e, r) {
				(function () {
					var e,
						r = function (t, e) {
							return function () {
								return t.apply(e, arguments);
							};
						},
						i = {}.hasOwnProperty,
						s = function (t, e) {
							for (var r in e) i.call(e, r) && (t[r] = e[r]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						};
					!(function (t) {
						var i, n, a, o, h;
						function u() {
							return (this.readChunk = r(this.readChunk, this)), u.__super__.constructor.apply(this, arguments);
						}
						s(u, t),
							e.register("ulaw", u),
							e.register("alaw", u),
							(h = 128),
							(n = 15),
							(o = 4),
							(a = 112),
							(i = 132),
							(u.prototype.init = function () {
								var t, e, r, s, u, f, c;
								if (
									((this.format.bitsPerChannel = 16),
									(this.table = s = new Int16Array(256)),
									"ulaw" === this.format.formatID)
								)
									for (t = f = 0; f < 256; t = ++f)
										(r = (((u = ~t) & n) << 3) + i), (r <<= (u & a) >>> o), (s[t] = u & h ? i - r : r - i);
								else
									for (t = c = 0; c < 256; t = ++c)
										(r = (u = 85 ^ t) & n),
											(r = (e = (u & a) >>> o) ? (r + r + 1 + 32) << (e + 2) : (r + r + 1) << 3),
											(s[t] = u & h ? r : -r);
							}),
							(u.prototype.readChunk = function () {
								var t, e, r, i, s, n;
								if (((i = this.stream), (s = this.table), 0 !== (r = Math.min(4096, this.stream.remainingBytes())))) {
									for (e = new Int16Array(r), t = n = 0; n < r; t = n += 1) e[t] = s[i.readUInt8()];
									return e;
								}
							});
					})((e = t("../decoder")));
				}).call(this);
			},
			{ "../decoder": 11 },
		],
		14: [
			function (t, e, r) {
				(function () {
					var r,
						i,
						s,
						n,
						a = {}.hasOwnProperty,
						o = function (t, e) {
							for (var r in e) a.call(e, r) && (t[r] = e[r]);
							function i() {
								this.constructor = t;
							}
							return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
						};
					(s = t("./core/events")),
						(r = t("./core/bufferlist")),
						(n = t("./core/stream")),
						(i = (function (t) {
							var e;
							function i(t, e) {
								var i, s, a;
								(i = new r()).append(e),
									(this.stream = new n(i)),
									(s = !1),
									t.on(
										"data",
										((a = this),
										function (t) {
											var e;
											(s = !0), i.append(t);
											try {
												return a.readChunk(t);
											} catch (t) {
												return (e = t), a.emit("error", e);
											}
										})
									),
									t.on(
										"error",
										(function (t) {
											return function (e) {
												return t.emit("error", e);
											};
										})(this)
									),
									t.on(
										"end",
										(function (t) {
											return function () {
												return s || t.readChunk(e), t.emit("end");
											};
										})(this)
									),
									(this.seekPoints = []),
									this.init();
							}
							return (
								o(i, t),
								(i.probe = function (t) {
									return !1;
								}),
								(i.prototype.init = function () {}),
								(i.prototype.readChunk = function (t) {}),
								(i.prototype.addSeekPoint = function (t, e) {
									var r;
									return (r = this.searchTimestamp(e)), this.seekPoints.splice(r, 0, { offset: t, timestamp: e });
								}),
								(i.prototype.searchTimestamp = function (t, e) {
									var r, i, s, n;
									if (((i = 0), (r = this.seekPoints.length) > 0 && this.seekPoints[r - 1].timestamp < t)) return r;
									for (; i < r; )
										(s = (i + r) >> 1), (n = this.seekPoints[s].timestamp) < t ? (i = s + 1) : n >= t && (r = s);
									return r > this.seekPoints.length && (r = this.seekPoints.length), r;
								}),
								(i.prototype.seek = function (t) {
									var e;
									return this.format && this.format.framesPerPacket > 0 && this.format.bytesPerPacket > 0
										? { timestamp: t, offset: (this.format.bytesPerPacket * t) / this.format.framesPerPacket }
										: ((e = this.searchTimestamp(t)), this.seekPoints[e]);
								}),
								(e = []),
								(i.register = function (t) {
									return e.push(t);
								}),
								(i.find = function (t) {
									var r, i, s, a, o;
									for (s = n.fromBuffer(t), a = 0, o = e.length; a < o; a++) {
										(r = e[a]), (i = s.offset);
										try {
											if (r.probe(s)) return r;
										} catch (t) {}
										s.seek(i);
									}
									return null;
								}),
								i
							);
						})(s)),
						(e.exports = i);
				}).call(this);
			},
			{ "./core/bufferlist": 7, "./core/events": 8, "./core/stream": 9 },
		],
		15: [
			function (t, e, r) {
				(function () {
					var e,
						r = {}.hasOwnProperty,
						i = function (t, e) {
							for (var i in e) r.call(e, i) && (t[i] = e[i]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						};
					!(function (t) {
						function r() {
							return r.__super__.constructor.apply(this, arguments);
						}
						i(r, t),
							e.register(r),
							(r.probe = function (t) {
								var e;
								return "FORM" === t.peekString(0, 4) && ("AIFF" === (e = t.peekString(8, 4)) || "AIFC" === e);
							}),
							(r.prototype.readChunk = function () {
								var t, e, r, i;
								if (!this.readStart && this.stream.available(12)) {
									if ("FORM" !== this.stream.readString(4)) return this.emit("error", "Invalid AIFF.");
									if (
										((this.fileSize = this.stream.readUInt32()),
										(this.fileType = this.stream.readString(4)),
										(this.readStart = !0),
										"AIFF" !== (i = this.fileType) && "AIFC" !== i)
									)
										return this.emit("error", "Invalid AIFF.");
								}
								for (; this.stream.available(1); ) {
									switch (
										(!this.readHeaders &&
											this.stream.available(8) &&
											((this.type = this.stream.readString(4)), (this.len = this.stream.readUInt32())),
										this.type)
									) {
										case "COMM":
											if (!this.stream.available(this.len)) return;
											(this.format = {
												formatID: "lpcm",
												channelsPerFrame: this.stream.readUInt16(),
												sampleCount: this.stream.readUInt32(),
												bitsPerChannel: this.stream.readUInt16(),
												sampleRate: this.stream.readFloat80(),
												framesPerPacket: 1,
												littleEndian: !1,
												floatingPoint: !1,
											}),
												(this.format.bytesPerPacket = (this.format.bitsPerChannel / 8) * this.format.channelsPerFrame),
												"AIFC" === this.fileType &&
													((e = this.stream.readString(4)),
													(this.format.littleEndian = "sowt" === e && this.format.bitsPerChannel > 8),
													(this.format.floatingPoint = "fl32" === e || "fl64" === e),
													("twos" !== e && "sowt" !== e && "fl32" !== e && "fl64" !== e && "NONE" !== e) ||
														(e = "lpcm"),
													(this.format.formatID = e),
													(this.len -= 4)),
												this.stream.advance(this.len - 18),
												this.emit("format", this.format),
												this.emit("duration", ((this.format.sampleCount / this.format.sampleRate) * 1e3) | 0);
											break;
										case "SSND":
											(this.readSSNDHeader && this.stream.available(4)) ||
												((r = this.stream.readUInt32()),
												this.stream.advance(4),
												this.stream.advance(r),
												(this.readSSNDHeader = !0)),
												(t = this.stream.readSingleBuffer(this.len)),
												(this.len -= t.length),
												(this.readHeaders = this.len > 0),
												this.emit("data", t);
											break;
										default:
											if (!this.stream.available(this.len)) return;
											this.stream.advance(this.len);
									}
									"SSND" !== this.type && (this.readHeaders = !1);
								}
							});
					})((e = t("../demuxer")));
				}).call(this);
			},
			{ "../demuxer": 14 },
		],
		16: [
			function (t, e, r) {
				(function () {
					var e,
						r = {}.hasOwnProperty,
						i = function (t, e) {
							for (var i in e) r.call(e, i) && (t[i] = e[i]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						};
					!(function (t) {
						var r, s;
						function n() {
							return n.__super__.constructor.apply(this, arguments);
						}
						i(n, t),
							e.register(n),
							(n.probe = function (t) {
								return ".snd" === t.peekString(0, 4);
							}),
							((r = [8, 8, 16, 24, 32, 32, 64])[26] = 8),
							(s = { 1: "ulaw", 27: "alaw" }),
							(n.prototype.readChunk = function () {
								var t, e, i;
								if (!this.readHeader && this.stream.available(24)) {
									if (".snd" !== this.stream.readString(4)) return this.emit("error", "Invalid AU file.");
									if (
										(this.stream.readUInt32(),
										(e = this.stream.readUInt32()),
										(i = this.stream.readUInt32()),
										(this.format = {
											formatID: s[i] || "lpcm",
											littleEndian: !1,
											floatingPoint: 6 === i || 7 === i,
											bitsPerChannel: r[i - 1],
											sampleRate: this.stream.readUInt32(),
											channelsPerFrame: this.stream.readUInt32(),
											framesPerPacket: 1,
										}),
										null == this.format.bitsPerChannel)
									)
										return this.emit("error", "Unsupported encoding in AU file.");
									(this.format.bytesPerPacket = (this.format.bitsPerChannel / 8) * this.format.channelsPerFrame),
										4294967295 !== e &&
											((t = this.format.bitsPerChannel / 8),
											this.emit(
												"duration",
												((e / t / this.format.channelsPerFrame / this.format.sampleRate) * 1e3) | 0
											)),
										this.emit("format", this.format),
										(this.readHeader = !0);
								}
								if (this.readHeader)
									for (; this.stream.available(1); )
										this.emit("data", this.stream.readSingleBuffer(this.stream.remainingBytes()));
							});
					})((e = t("../demuxer")));
				}).call(this);
			},
			{ "../demuxer": 14 },
		],
		17: [
			function (t, e, r) {
				(function () {
					var e,
						r,
						i = {}.hasOwnProperty,
						s = function (t, e) {
							for (var r in e) i.call(e, r) && (t[r] = e[r]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						};
					(e = t("../demuxer")),
						(r = t("./m4a")),
						(function (t) {
							function i() {
								return i.__super__.constructor.apply(this, arguments);
							}
							s(i, t),
								e.register(i),
								(i.probe = function (t) {
									return "caff" === t.peekString(0, 4);
								}),
								(i.prototype.readChunk = function () {
									var t, e, i, s, n, a, o, h, u, f, c, l, p;
									if (!this.format && this.stream.available(64)) {
										if ("caff" !== this.stream.readString(4))
											return this.emit("error", "Invalid CAF, does not begin with 'caff'");
										if ((this.stream.advance(4), "desc" !== this.stream.readString(4)))
											return this.emit("error", "Invalid CAF, 'caff' is not followed by 'desc'");
										if (0 !== this.stream.readUInt32() || 32 !== this.stream.readUInt32())
											return this.emit("error", "Invalid 'desc' size, should be 32");
										(this.format = {}),
											(this.format.sampleRate = this.stream.readFloat64()),
											(this.format.formatID = this.stream.readString(4)),
											(n = this.stream.readUInt32()),
											"lpcm" === this.format.formatID &&
												((this.format.floatingPoint = Boolean(1 & n)), (this.format.littleEndian = Boolean(2 & n))),
											(this.format.bytesPerPacket = this.stream.readUInt32()),
											(this.format.framesPerPacket = this.stream.readUInt32()),
											(this.format.channelsPerFrame = this.stream.readUInt32()),
											(this.format.bitsPerChannel = this.stream.readUInt32()),
											this.emit("format", this.format);
									}
									for (; this.stream.available(1); ) {
										if (
											!this.headerCache &&
											((this.headerCache = {
												type: this.stream.readString(4),
												oversize: 0 !== this.stream.readUInt32(),
												size: this.stream.readUInt32(),
											}),
											this.headerCache.oversize)
										)
											return this.emit("error", "Holy Shit, an oversized file, not supported in JS");
										switch (this.headerCache.type) {
											case "kuki":
												this.stream.available(this.headerCache.size) &&
													("aac " === this.format.formatID
														? ((h = this.stream.offset + this.headerCache.size),
														  (i = r.readEsds(this.stream)) && this.emit("cookie", i),
														  this.stream.seek(h))
														: ((t = this.stream.readBuffer(this.headerCache.size)), this.emit("cookie", t)),
													(this.headerCache = null));
												break;
											case "pakt":
												if (this.stream.available(this.headerCache.size)) {
													if (0 !== this.stream.readUInt32())
														return this.emit("error", "Sizes greater than 32 bits are not supported.");
													if (((this.numPackets = this.stream.readUInt32()), 0 !== this.stream.readUInt32()))
														return this.emit("error", "Sizes greater than 32 bits are not supported.");
													for (
														this.numFrames = this.stream.readUInt32(),
															this.primingFrames = this.stream.readUInt32(),
															this.remainderFrames = this.stream.readUInt32(),
															this.emit("duration", ((this.numFrames / this.format.sampleRate) * 1e3) | 0),
															this.sentDuration = !0,
															e = 0,
															u = 0,
															c = 0,
															p = this.numPackets;
														c < p;
														c += 1
													)
														this.addSeekPoint(e, u),
															(e += this.format.bytesPerPacket || r.readDescrLen(this.stream)),
															(u += this.format.framesPerPacket || r.readDescrLen(this.stream));
													this.headerCache = null;
												}
												break;
											case "info":
												for (s = this.stream.readUInt32(), o = {}, l = 0; 0 <= s ? l < s : l > s; 0 <= s ? ++l : --l)
													(a = this.stream.readString(null)), (f = this.stream.readString(null)), (o[a] = f);
												this.emit("metadata", o), (this.headerCache = null);
												break;
											case "data":
												this.sentFirstDataChunk ||
													(this.stream.advance(4),
													(this.headerCache.size -= 4),
													0 === this.format.bytesPerPacket ||
														this.sentDuration ||
														((this.numFrames = this.headerCache.size / this.format.bytesPerPacket),
														this.emit("duration", ((this.numFrames / this.format.sampleRate) * 1e3) | 0)),
													(this.sentFirstDataChunk = !0)),
													(t = this.stream.readSingleBuffer(this.headerCache.size)),
													(this.headerCache.size -= t.length),
													this.emit("data", t),
													this.headerCache.size <= 0 && (this.headerCache = null);
												break;
											default:
												this.stream.available(this.headerCache.size) &&
													(this.stream.advance(this.headerCache.size), (this.headerCache = null));
										}
									}
								});
						})(e);
				}).call(this);
			},
			{ "../demuxer": 14, "./m4a": 18 },
		],
		18: [
			function (t, e, r) {
				(function () {
					var r,
						i,
						s = {}.hasOwnProperty,
						n = function (t, e) {
							for (var r in e) s.call(e, r) && (t[r] = e[r]);
							function i() {
								this.constructor = t;
							}
							return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
						},
						a =
							[].indexOf ||
							function (t) {
								for (var e = 0, r = this.length; e < r; e++) if (e in this && this[e] === t) return e;
								return -1;
							};
					(i = (function (t) {
						var e, i, s, o, h, u, f, c, l, p, d;
						function m() {
							return m.__super__.constructor.apply(this, arguments);
						}
						return (
							n(m, t),
							r.register(m),
							(i = ["M4A ", "M4P ", "M4B ", "M4V ", "isom", "mp42", "qt  "]),
							(m.probe = function (t) {
								var e;
								return "ftyp" === t.peekString(4, 4) && ((e = t.peekString(8, 4)), a.call(i, e) >= 0);
							}),
							(m.prototype.init = function () {
								return (this.atoms = []), (this.offsets = []), (this.track = null), (this.tracks = []);
							}),
							(h = {}),
							(f = {}),
							(o = function (t, e) {
								var r, i, s, n, a;
								for (r = [], s = 0, n = (a = t.split(".").slice(0, -1)).length; s < n; s++)
									(i = a[s]), r.push(i), (f[r.join(".")] = !0);
								return null == h[t] && (h[t] = {}), (h[t].fn = e);
							}),
							(s = function (t, e) {
								return null == h[t] && (h[t] = {}), (h[t].after = e);
							}),
							(m.prototype.readChunk = function () {
								var t, e;
								for (this.break = !1; this.stream.available(1) && !this.break; ) {
									if (!this.readHeaders) {
										if (!this.stream.available(8)) return;
										if (
											((this.len = this.stream.readUInt32() - 8),
											(this.type = this.stream.readString(4)),
											0 === this.len)
										)
											continue;
										this.atoms.push(this.type),
											this.offsets.push(this.stream.offset + this.len),
											(this.readHeaders = !0);
									}
									if (((e = this.atoms.join(".")), null != (t = h[e]) ? t.fn : void 0)) {
										if (!this.stream.available(this.len) && "mdat" !== e) return;
										t.fn.call(this), e in f && (this.readHeaders = !1);
									} else if (e in f) this.readHeaders = !1;
									else {
										if (!this.stream.available(this.len)) return;
										this.stream.advance(this.len);
									}
									for (; this.stream.offset >= this.offsets[this.offsets.length - 1]; )
										(null != (t = h[this.atoms.join(".")]) ? t.after : void 0) && t.after.call(this),
											this.atoms.pop(),
											this.offsets.pop(),
											(this.readHeaders = !1);
								}
							}),
							o("ftyp", function () {
								var t;
								return (
									(t = this.stream.readString(4)),
									a.call(i, t) < 0 ? this.emit("error", "Not a valid M4A file.") : this.stream.advance(this.len - 4)
								);
							}),
							o("moov.trak", function () {
								return (this.track = {}), this.tracks.push(this.track);
							}),
							o("moov.trak.tkhd", function () {
								return (
									this.stream.advance(4),
									this.stream.advance(8),
									(this.track.id = this.stream.readUInt32()),
									this.stream.advance(this.len - 16)
								);
							}),
							o("moov.trak.mdia.hdlr", function () {
								return (
									this.stream.advance(4),
									this.stream.advance(4),
									(this.track.type = this.stream.readString(4)),
									this.stream.advance(12),
									this.stream.advance(this.len - 24)
								);
							}),
							o("moov.trak.mdia.mdhd", function () {
								return (
									this.stream.advance(4),
									this.stream.advance(8),
									(this.track.timeScale = this.stream.readUInt32()),
									(this.track.duration = this.stream.readUInt32()),
									this.stream.advance(4)
								);
							}),
							(e = { ulaw: 8, alaw: 8, in24: 24, in32: 32, fl32: 32, fl64: 64 }),
							o("moov.trak.mdia.minf.stbl.stsd", function () {
								var t, r, i, s, n;
								return (
									this.stream.advance(4),
									(r = this.stream.readUInt32()),
									"soun" !== this.track.type
										? this.stream.advance(this.len - 8)
										: 1 !== r
										? this.emit("error", "Only expecting one entry in sample description atom!")
										: (this.stream.advance(4),
										  ((t = this.track.format = {}).formatID = this.stream.readString(4)),
										  this.stream.advance(6),
										  this.stream.advance(2),
										  (i = this.stream.readUInt16()),
										  this.stream.advance(6),
										  (t.channelsPerFrame = this.stream.readUInt16()),
										  (t.bitsPerChannel = this.stream.readUInt16()),
										  this.stream.advance(4),
										  (t.sampleRate = this.stream.readUInt16()),
										  this.stream.advance(2),
										  1 === i
												? ((t.framesPerPacket = this.stream.readUInt32()),
												  this.stream.advance(4),
												  (t.bytesPerFrame = this.stream.readUInt32()),
												  this.stream.advance(4))
												: 0 !== i && this.emit("error", "Unknown version in stsd atom"),
										  null != e[t.formatID] && (t.bitsPerChannel = e[t.formatID]),
										  (t.floatingPoint = "fl32" === (s = t.formatID) || "fl64" === s),
										  (t.littleEndian = "sowt" === t.formatID && t.bitsPerChannel > 8),
										  "twos" === (n = t.formatID) ||
										  "sowt" === n ||
										  "in24" === n ||
										  "in32" === n ||
										  "fl32" === n ||
										  "fl64" === n ||
										  "raw " === n ||
										  "NONE" === n
												? (t.formatID = "lpcm")
												: void 0)
								);
							}),
							o("moov.trak.mdia.minf.stbl.stsd.alac", function () {
								return this.stream.advance(4), (this.track.cookie = this.stream.readBuffer(this.len - 4));
							}),
							o("moov.trak.mdia.minf.stbl.stsd.esds", function () {
								var t;
								return (
									(t = this.stream.offset + this.len),
									(this.track.cookie = m.readEsds(this.stream)),
									this.stream.seek(t)
								);
							}),
							o("moov.trak.mdia.minf.stbl.stsd.wave.enda", function () {
								return (this.track.format.littleEndian = !!this.stream.readUInt16());
							}),
							(m.readDescrLen = function (t) {
								var e, r, i;
								for (i = 0, r = 4; r-- && ((i = (i << 7) | (127 & (e = t.readUInt8()))), 128 & e); );
								return i;
							}),
							(m.readEsds = function (t) {
								var e, r, i;
								return (
									t.advance(4),
									(i = t.readUInt8()),
									(r = m.readDescrLen(t)),
									3 === i
										? (t.advance(2),
										  128 & (e = t.readUInt8()) && t.advance(2),
										  64 & e && t.advance(t.readUInt8()),
										  32 & e && t.advance(2))
										: t.advance(2),
									(i = t.readUInt8()),
									(r = m.readDescrLen(t)),
									4 === i &&
									(t.readUInt8(),
									t.advance(1),
									t.advance(3),
									t.advance(4),
									t.advance(4),
									(i = t.readUInt8()),
									(r = m.readDescrLen(t)),
									5 === i)
										? t.readBuffer(r)
										: null
								);
							}),
							o("moov.trak.mdia.minf.stbl.stts", function () {
								var t, e, r;
								for (
									this.stream.advance(4), t = this.stream.readUInt32(), this.track.stts = [], e = r = 0;
									r < t;
									e = r += 1
								)
									this.track.stts[e] = { count: this.stream.readUInt32(), duration: this.stream.readUInt32() };
								return this.setupSeekPoints();
							}),
							o("moov.trak.mdia.minf.stbl.stsc", function () {
								var t, e, r;
								for (
									this.stream.advance(4), t = this.stream.readUInt32(), this.track.stsc = [], e = r = 0;
									r < t;
									e = r += 1
								)
									this.track.stsc[e] = {
										first: this.stream.readUInt32(),
										count: this.stream.readUInt32(),
										id: this.stream.readUInt32(),
									};
								return this.setupSeekPoints();
							}),
							o("moov.trak.mdia.minf.stbl.stsz", function () {
								var t, e, r;
								if (
									(this.stream.advance(4),
									(this.track.sampleSize = this.stream.readUInt32()),
									(t = this.stream.readUInt32()),
									0 === this.track.sampleSize && t > 0)
								)
									for (this.track.sampleSizes = [], e = r = 0; r < t; e = r += 1)
										this.track.sampleSizes[e] = this.stream.readUInt32();
								return this.setupSeekPoints();
							}),
							o("moov.trak.mdia.minf.stbl.stco", function () {
								var t, e, r;
								for (
									this.stream.advance(4), t = this.stream.readUInt32(), this.track.chunkOffsets = [], e = r = 0;
									r < t;
									e = r += 1
								)
									this.track.chunkOffsets[e] = this.stream.readUInt32();
								return this.setupSeekPoints();
							}),
							o("moov.trak.tref.chap", function () {
								var t, e, r;
								for (t = this.len >> 2, this.track.chapterTracks = [], e = r = 0; r < t; e = r += 1)
									this.track.chapterTracks[e] = this.stream.readUInt32();
							}),
							(m.prototype.setupSeekPoints = function () {
								var t, e, r, i, s, n, a, o, h, u, f, c, l, p, d;
								if (
									null != this.track.chunkOffsets &&
									null != this.track.stsc &&
									null != this.track.sampleSize &&
									null != this.track.stts
								) {
									for (
										n = 0,
											a = 0,
											a = 0,
											o = 0,
											i = 0,
											e = 0,
											h = 0,
											this.track.seekPoints = [],
											d = [],
											t = u = 0,
											c = (l = this.track.chunkOffsets).length;
										u < c;
										t = ++u
									) {
										for (r = l[t], f = 0, p = this.track.stsc[n].count; f < p; f += 1)
											this.track.seekPoints.push({ offset: e, position: r, timestamp: h }),
												(e += s = this.track.sampleSize || this.track.sampleSizes[i++]),
												(r += s),
												(h += this.track.stts[a].duration),
												a + 1 < this.track.stts.length && ++o === this.track.stts[a].count && ((o = 0), a++);
										n + 1 < this.track.stsc.length && t + 1 === this.track.stsc[n + 1].first
											? d.push(n++)
											: d.push(void 0);
									}
									return d;
								}
							}),
							s("moov", function () {
								var t, e, r, i;
								for (
									null != this.mdatOffset && this.stream.seek(this.mdatOffset - 8), e = 0, r = (i = this.tracks).length;
									e < r;
									e++
								)
									if ("soun" === (t = i[e]).type) {
										this.track = t;
										break;
									}
								return "soun" !== this.track.type
									? ((this.track = null), this.emit("error", "No audio tracks in m4a file."))
									: (this.emit("format", this.track.format),
									  this.emit("duration", ((this.track.duration / this.track.timeScale) * 1e3) | 0),
									  this.track.cookie && this.emit("cookie", this.track.cookie),
									  (this.seekPoints = this.track.seekPoints));
							}),
							o("mdat", function () {
								var t, e, r, i, s, n, a, o;
								if (!this.startedData) {
									if ((null == this.mdatOffset && (this.mdatOffset = this.stream.offset), 0 === this.tracks.length))
										return (
											(t = Math.min(this.stream.remainingBytes(), this.len)),
											this.stream.advance(t),
											void (this.len -= t)
										);
									(this.chunkIndex = 0),
										(this.stscIndex = 0),
										(this.sampleIndex = 0),
										(this.tailOffset = 0),
										(this.tailSamples = 0),
										(this.startedData = !0);
								}
								if (!this.readChapters) {
									if (((this.readChapters = this.parseChapters()), (this.break = !this.readChapters))) return;
									this.stream.seek(this.mdatOffset);
								}
								if (
									((s = this.track.chunkOffsets[this.chunkIndex] + this.tailOffset),
									(r = 0),
									this.stream.available(s - this.stream.offset))
								) {
									for (this.stream.seek(s); this.chunkIndex < this.track.chunkOffsets.length; ) {
										for (
											i = this.track.stsc[this.stscIndex].count - this.tailSamples, e = 0, n = o = 0;
											o < i &&
											((a = this.track.sampleSize || this.track.sampleSizes[this.sampleIndex]),
											this.stream.available(r + a));
											n = o += 1
										)
											(r += a), (e += a), this.sampleIndex++;
										if (n < i) {
											(this.tailOffset += e), (this.tailSamples += n);
											break;
										}
										if (
											(this.chunkIndex++,
											(this.tailOffset = 0),
											(this.tailSamples = 0),
											this.stscIndex + 1 < this.track.stsc.length &&
												this.chunkIndex + 1 === this.track.stsc[this.stscIndex + 1].first &&
												this.stscIndex++,
											s + r !== this.track.chunkOffsets[this.chunkIndex])
										)
											break;
									}
									return r > 0
										? (this.emit("data", this.stream.readBuffer(r)),
										  (this.break = this.chunkIndex === this.track.chunkOffsets.length))
										: (this.break = !0);
								}
								this.break = !0;
							}),
							(m.prototype.parseChapters = function () {
								var t, e, r, i, s, n, a, o, h, u, f, c, l;
								if (!((null != (u = this.track.chapterTracks) ? u.length : void 0) > 0)) return !0;
								for (
									e = this.track.chapterTracks[0], o = 0, h = (f = this.tracks).length;
									o < h && (a = f[o]).id !== e;
									o++
								);
								for (
									a.id !== e && this.emit("error", "Chapter track does not exist."),
										null == this.chapters && (this.chapters = []);
									this.chapters.length < a.seekPoints.length;

								) {
									if (
										((s = a.seekPoints[this.chapters.length]),
										!this.stream.available(s.position - this.stream.offset + 32))
									)
										return !1;
									if (
										(this.stream.seek(s.position),
										(r = this.stream.readUInt16()),
										(n = null),
										!this.stream.available(r))
									)
										return !1;
									r > 2 &&
										((65279 !== (t = this.stream.peekUInt16()) && 65534 !== t) ||
											(n = this.stream.readString(r, "utf16-bom"))),
										null == n && (n = this.stream.readString(r, "utf8")),
										(i =
											null != (c = null != (l = a.seekPoints[this.chapters.length + 1]) ? l.timestamp : void 0)
												? c
												: a.duration),
										this.chapters.push({
											title: n,
											timestamp: ((s.timestamp / a.timeScale) * 1e3) | 0,
											duration: (((i - s.timestamp) / a.timeScale) * 1e3) | 0,
										});
								}
								return this.emit("chapters", this.chapters), !0;
							}),
							o("moov.udta.meta", function () {
								return (this.metadata = {}), this.stream.advance(4);
							}),
							s("moov.udta.meta", function () {
								return this.emit("metadata", this.metadata);
							}),
							(p = function (t, e, r) {
								return o("moov.udta.meta.ilst." + t + ".data", function () {
									return this.stream.advance(8), (this.len -= 8), r.call(this, e);
								});
							})(
								"©alb",
								"album",
								(d = function (t) {
									return (this.metadata[t] = this.stream.readString(this.len, "utf8"));
								})
							),
							p("©arg", "arranger", d),
							p("©art", "artist", d),
							p("©ART", "artist", d),
							p("aART", "albumArtist", d),
							p("catg", "category", d),
							p("©com", "composer", d),
							p("©cpy", "copyright", d),
							p("cprt", "copyright", d),
							p("©cmt", "comments", d),
							p("©day", "releaseDate", d),
							p("desc", "description", d),
							p("©gen", "genre", d),
							p("©grp", "grouping", d),
							p("©isr", "ISRC", d),
							p("keyw", "keywords", d),
							p("©lab", "recordLabel", d),
							p("ldes", "longDescription", d),
							p("©lyr", "lyrics", d),
							p("©nam", "title", d),
							p("©phg", "recordingCopyright", d),
							p("©prd", "producer", d),
							p("©prf", "performers", d),
							p("purd", "purchaseDate", d),
							p("purl", "podcastURL", d),
							p("©swf", "songwriter", d),
							p("©too", "encoder", d),
							p("©wrt", "composer", d),
							p("covr", "coverArt", function (t) {
								return (this.metadata[t] = this.stream.readBuffer(this.len));
							}),
							(l = [
								"Blues",
								"Classic Rock",
								"Country",
								"Dance",
								"Disco",
								"Funk",
								"Grunge",
								"Hip-Hop",
								"Jazz",
								"Metal",
								"New Age",
								"Oldies",
								"Other",
								"Pop",
								"R&B",
								"Rap",
								"Reggae",
								"Rock",
								"Techno",
								"Industrial",
								"Alternative",
								"Ska",
								"Death Metal",
								"Pranks",
								"Soundtrack",
								"Euro-Techno",
								"Ambient",
								"Trip-Hop",
								"Vocal",
								"Jazz+Funk",
								"Fusion",
								"Trance",
								"Classical",
								"Instrumental",
								"Acid",
								"House",
								"Game",
								"Sound Clip",
								"Gospel",
								"Noise",
								"AlternRock",
								"Bass",
								"Soul",
								"Punk",
								"Space",
								"Meditative",
								"Instrumental Pop",
								"Instrumental Rock",
								"Ethnic",
								"Gothic",
								"Darkwave",
								"Techno-Industrial",
								"Electronic",
								"Pop-Folk",
								"Eurodance",
								"Dream",
								"Southern Rock",
								"Comedy",
								"Cult",
								"Gangsta",
								"Top 40",
								"Christian Rap",
								"Pop/Funk",
								"Jungle",
								"Native American",
								"Cabaret",
								"New Wave",
								"Psychadelic",
								"Rave",
								"Showtunes",
								"Trailer",
								"Lo-Fi",
								"Tribal",
								"Acid Punk",
								"Acid Jazz",
								"Polka",
								"Retro",
								"Musical",
								"Rock & Roll",
								"Hard Rock",
								"Folk",
								"Folk/Rock",
								"National Folk",
								"Swing",
								"Fast Fusion",
								"Bebob",
								"Latin",
								"Revival",
								"Celtic",
								"Bluegrass",
								"Avantgarde",
								"Gothic Rock",
								"Progressive Rock",
								"Psychedelic Rock",
								"Symphonic Rock",
								"Slow Rock",
								"Big Band",
								"Chorus",
								"Easy Listening",
								"Acoustic",
								"Humour",
								"Speech",
								"Chanson",
								"Opera",
								"Chamber Music",
								"Sonata",
								"Symphony",
								"Booty Bass",
								"Primus",
								"Porn Groove",
								"Satire",
								"Slow Jam",
								"Club",
								"Tango",
								"Samba",
								"Folklore",
								"Ballad",
								"Power Ballad",
								"Rhythmic Soul",
								"Freestyle",
								"Duet",
								"Punk Rock",
								"Drum Solo",
								"A Capella",
								"Euro-House",
								"Dance Hall",
							]),
							p("gnre", "genre", function (t) {
								return (this.metadata[t] = l[this.stream.readUInt16() - 1]);
							}),
							p("tmpo", "tempo", function (t) {
								return (this.metadata[t] = this.stream.readUInt16());
							}),
							p("rtng", "rating", function (t) {
								var e;
								return (
									(e = this.stream.readUInt8()), (this.metadata[t] = 2 === e ? "Clean" : 0 !== e ? "Explicit" : "None")
								);
							}),
							p(
								"disk",
								"diskNumber",
								(c = function (t) {
									return (
										this.stream.advance(2),
										(this.metadata[t] = this.stream.readUInt16() + " of " + this.stream.readUInt16()),
										this.stream.advance(this.len - 6)
									);
								})
							),
							p("trkn", "trackNumber", c),
							p(
								"cpil",
								"compilation",
								(u = function (t) {
									return (this.metadata[t] = 1 === this.stream.readUInt8());
								})
							),
							p("pcst", "podcast", u),
							p("pgap", "gapless", u),
							m
						);
					})((r = t("../demuxer")))),
						(e.exports = i);
				}).call(this);
			},
			{ "../demuxer": 14 },
		],
		19: [
			function (t, e, r) {
				(function () {
					var e,
						r = {}.hasOwnProperty,
						i = function (t, e) {
							for (var i in e) r.call(e, i) && (t[i] = e[i]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						};
					!(function (t) {
						var r;
						function s() {
							return s.__super__.constructor.apply(this, arguments);
						}
						i(s, t),
							e.register(s),
							(s.probe = function (t) {
								return "RIFF" === t.peekString(0, 4) && "WAVE" === t.peekString(8, 4);
							}),
							(r = { 1: "lpcm", 3: "lpcm", 6: "alaw", 7: "ulaw" }),
							(s.prototype.readChunk = function () {
								var t, e, i;
								if (!this.readStart && this.stream.available(12)) {
									if ("RIFF" !== this.stream.readString(4)) return this.emit("error", "Invalid WAV file.");
									if (
										((this.fileSize = this.stream.readUInt32(!0)),
										(this.readStart = !0),
										"WAVE" !== this.stream.readString(4))
									)
										return this.emit("error", "Invalid WAV file.");
								}
								for (; this.stream.available(1); ) {
									switch (
										(!this.readHeaders &&
											this.stream.available(8) &&
											((this.type = this.stream.readString(4)), (this.len = this.stream.readUInt32(!0))),
										this.type)
									) {
										case "fmt ":
											if (!((i = this.stream.readUInt16(!0)) in r))
												return this.emit("error", "Unsupported format in WAV file.");
											(this.format = {
												formatID: r[i],
												floatingPoint: 3 === i,
												littleEndian: "lpcm" === r[i],
												channelsPerFrame: this.stream.readUInt16(!0),
												sampleRate: this.stream.readUInt32(!0),
												framesPerPacket: 1,
											}),
												this.stream.advance(4),
												this.stream.advance(2),
												(this.format.bitsPerChannel = this.stream.readUInt16(!0)),
												(this.format.bytesPerPacket = (this.format.bitsPerChannel / 8) * this.format.channelsPerFrame),
												this.emit("format", this.format),
												this.stream.advance(this.len - 16);
											break;
										case "data":
											this.sentDuration ||
												((e = this.format.bitsPerChannel / 8),
												this.emit(
													"duration",
													((this.len / e / this.format.channelsPerFrame / this.format.sampleRate) * 1e3) | 0
												),
												(this.sentDuration = !0)),
												(t = this.stream.readSingleBuffer(this.len)),
												(this.len -= t.length),
												(this.readHeaders = this.len > 0),
												this.emit("data", t);
											break;
										default:
											if (!this.stream.available(this.len)) return;
											this.stream.advance(this.len);
									}
									"data" !== this.type && (this.readHeaders = !1);
								}
							});
					})((e = t("../demuxer")));
				}).call(this);
			},
			{ "../demuxer": 14 },
		],
		20: [
			function (t, e, r) {
				(function () {
					var r,
						i = function (t, e) {
							return function () {
								return t.apply(e, arguments);
							};
						},
						s = {}.hasOwnProperty,
						n = function (t, e) {
							for (var r in e) s.call(e, r) && (t[r] = e[r]);
							function i() {
								this.constructor = t;
							}
							return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
						};
					(r = (function (t) {
						var e;
						function r(t, e) {
							(this.sampleRate = t),
								(this.channels = e),
								(this.updateTime = i(this.updateTime, this)),
								(this.playing = !1),
								(this.currentTime = 0),
								(this._lastTime = 0);
						}
						return (
							n(r, t),
							(r.prototype.start = function () {
								if (!this.playing) {
									if (
										((this.playing = !0),
										null == this.device && (this.device = r.create(this.sampleRate, this.channels)),
										!this.device)
									)
										throw new Error("No supported audio device found.");
									return (
										(this._lastTime = this.device.getDeviceTime()),
										(this._timer = setInterval(this.updateTime, 200)),
										this.device.on(
											"refill",
											(this.refill =
												((t = this),
												function (e) {
													return t.emit("refill", e);
												}))
										)
									);
									var t;
								}
							}),
							(r.prototype.stop = function () {
								if (this.playing)
									return (this.playing = !1), this.device.off("refill", this.refill), clearInterval(this._timer);
							}),
							(r.prototype.destroy = function () {
								var t;
								return this.stop(), null != (t = this.device) ? t.destroy() : void 0;
							}),
							(r.prototype.seek = function (t) {
								return (
									(this.currentTime = t),
									this.playing && (this._lastTime = this.device.getDeviceTime()),
									this.emit("timeUpdate", this.currentTime)
								);
							}),
							(r.prototype.updateTime = function () {
								var t;
								return (
									(t = this.device.getDeviceTime()),
									(this.currentTime += (((t - this._lastTime) / this.device.sampleRate) * 1e3) | 0),
									(this._lastTime = t),
									this.emit("timeUpdate", this.currentTime)
								);
							}),
							(e = []),
							(r.register = function (t) {
								return e.push(t);
							}),
							(r.create = function (t, r) {
								var i, s, n;
								for (s = 0, n = e.length; s < n; s++) if ((i = e[s]).supported) return new i(t, r);
								return null;
							}),
							r
						);
					})(t("./core/events"))),
						(e.exports = r);
				}).call(this);
			},
			{ "./core/events": 8 },
		],
		21: [
			function (t, e, r) {
				(function () {
					var e,
						r,
						i,
						s = function (t, e) {
							return function () {
								return t.apply(e, arguments);
							};
						},
						n = {}.hasOwnProperty,
						a = function (t, e) {
							for (var r in e) n.call(e, r) && (t[r] = e[r]);
							function i() {
								this.constructor = t;
							}
							return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
						};
					(i = t("../core/events")),
						(r = t("../device")),
						(e = t("../core/buffer")),
						(function (t) {
							var i, n;
							function o(t, e) {
								(this.sampleRate = t),
									(this.channels = e),
									(this.refill = s(this.refill, this)),
									(this.audio = new Audio()),
									this.audio.mozSetup(this.channels, this.sampleRate),
									(this.writePosition = 0),
									(this.prebufferSize = this.sampleRate / 2),
									(this.tail = null),
									(this.timer = i(this.refill, 100));
							}
							a(o, t),
								r.register(o),
								(o.supported = "undefined" != typeof Audio && null !== Audio && "mozWriteAudio" in new Audio()),
								(o.prototype.refill = function () {
									var t, e, r;
									this.tail &&
										((r = this.audio.mozWriteAudio(this.tail)),
										(this.writePosition += r),
										this.writePosition < this.tail.length ? (this.tail = this.tail.subarray(r)) : (this.tail = null)),
										(t = this.audio.mozCurrentSampleOffset() + this.prebufferSize - this.writePosition) > 0 &&
											((e = new Float32Array(t)),
											this.emit("refill", e),
											(r = this.audio.mozWriteAudio(e)) < e.length && (this.tail = e.subarray(r)),
											(this.writePosition += r));
								}),
								(o.prototype.destroy = function () {
									return n(this.timer);
								}),
								(o.prototype.getDeviceTime = function () {
									return this.audio.mozCurrentSampleOffset() / this.channels;
								}),
								(i = function (t, r) {
									var i, s;
									return null == (i = e.makeBlobURL("setInterval(function() { postMessage('ping'); }, " + r + ");"))
										? setInterval(t, r)
										: (((s = new Worker(i)).onmessage = t), (s.url = i), s);
								}),
								(n = function (t) {
									return t.terminate ? (t.terminate(), URL.revokeObjectURL(t.url)) : clearInterval(t);
								});
						})(i);
				}).call(this);
			},
			{ "../core/buffer": 6, "../core/events": 8, "../device": 20 },
		],
		22: [
			function (t, e, r) {
				function i(t, e, r, i) {
					(this.fromSampleRate = +t),
						(this.toSampleRate = +e),
						(this.channels = 0 | r),
						(this.inputBufferLength = i),
						this.initialize();
				}
				(i.prototype.initialize = function () {
					if (!(this.fromSampleRate > 0 && this.toSampleRate > 0 && this.channels > 0))
						throw new Error("Invalid settings specified for the resampler.");
					if (this.fromSampleRate == this.toSampleRate) (this.resampler = this.bypassResampler), (this.ratioWeight = 1);
					else {
						(this.ratioWeight = this.fromSampleRate / this.toSampleRate),
							this.fromSampleRate < this.toSampleRate
								? (this.compileLinearInterpolationFunction(), (this.lastWeight = 1))
								: (this.compileMultiTapFunction(), (this.tailExists = !1), (this.lastWeight = 0));
						var t =
							Math.ceil(((this.inputBufferLength * this.toSampleRate) / this.fromSampleRate / this.channels) * 1.01) *
								this.channels +
							this.channels;
						(this.outputBuffer = new Float32Array(t)), (this.lastOutput = new Float32Array(this.channels));
					}
				}),
					(i.prototype.compileLinearInterpolationFunction = function () {
						this.resampler = (t) => {
							var e = 0,
								r = t.length;
							if (r > 0) {
								for (
									var i = this.lastWeight, s = 0, n = 0, a = 0, o = ((e = 0), this.outputBuffer);
									i < 1;
									i += this.ratioWeight
								) {
									s = 1 - (n = i % 1);
									for (var h = 0; h < this.channels; ++h) o[e++] = this.lastOutput[h] * s + t[h] * n;
								}
								for (i -= 1, r -= this.channels, a = Math.floor(i) * this.channels; a < r; ) {
									for (s = 1 - (n = i % 1), h = 0; h < this.channels; ++h)
										o[e++] = t[a + (h > 0 ? h : 0)] * s + t[a + (this.channels + h)] * n;
									(i += this.ratioWeight), (a = Math.floor(i) * this.channels);
								}
								for (h = 0; h < this.channels; ++h) this.lastOutput[h] = t[a++];
								this.lastWeight = i % 1;
							}
							return this.outputBuffer;
						};
					}),
					(i.prototype.compileMultiTapFunction = function () {
						this.resampler = (t) => {
							var e = 0,
								r = t.length;
							if (r > 0) {
								for (var i = 0, s = [], n = 0; n < this.channels; ++n) s[n] = 0;
								var a = 0,
									o = 0,
									h = !this.tailExists;
								this.tailExists = !1;
								var u = this.outputBuffer,
									f = 0;
								do {
									if (h) for (i = this.ratioWeight, n = 0; n < this.channels; ++n) s[n] = 0;
									else {
										for (i = this.lastWeight, n = 0; n < this.channels; ++n) s[n] = this.lastOutput[n];
										h = !0;
									}
									for (; i > 0 && a < r; ) {
										if (!(i >= (o = 1 + a - f))) {
											for (n = 0; n < this.channels; ++n) s[n] += t[a + (n > 0 ? n : 0)] * i;
											(f += i), (i = 0);
											break;
										}
										for (n = 0; n < this.channels; ++n) s[n] += t[a++] * o;
										(f = a), (i -= o);
									}
									if (!(i <= 0)) {
										for (this.lastWeight = i, n = 0; n < this.channels; ++n) this.lastOutput[n] = s[n];
										this.tailExists = !0;
										break;
									}
									for (n = 0; n < this.channels; ++n) u[e++] = s[n] / this.ratioWeight;
								} while (a < r);
							}
							return this.outputBuffer;
						};
					}),
					(i.prototype.bypassResampler = function (t) {
						return t;
					}),
					(e.exports = i);
			},
			{},
		],
		23: [
			function (t, e, r) {
				(function (e) {
					(function () {
						(function () {
							var r,
								i,
								s,
								n = function (t, e) {
									return function () {
										return t.apply(e, arguments);
									};
								},
								a = {}.hasOwnProperty,
								o = function (t, e) {
									for (var r in e) a.call(e, r) && (t[r] = e[r]);
									function i() {
										this.constructor = t;
									}
									return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
								};
							(i = t("../core/events")),
								(r = t("../device")),
								(s = t("./resampler")),
								(function (t) {
									var i, a, h;
									function u(t, e) {
										(this.sampleRate = t),
											(this.channels = e),
											(this.refill = n(this.refill, this)),
											(this.context = null != h ? h : (h = new i("content"))),
											(this.deviceSampleRate = this.context.sampleRate),
											(this.bufferSize = Math.ceil((4096 / (this.deviceSampleRate / this.sampleRate)) * this.channels)),
											(this.bufferSize += this.bufferSize % this.channels),
											this.deviceSampleRate !== this.sampleRate &&
												(this.resampler = new s(
													this.sampleRate,
													this.deviceSampleRate,
													this.channels,
													this.bufferSize
												)),
											(this.node = this.context[a](4096, this.channels, this.channels)),
											(this.node.onaudioprocess = this.refill),
											this.node.connect(this.context.destination);
									}
									o(u, t),
										r.register(u),
										(i = e.AudioContext || e.webkitAudioContext),
										(u.supported =
											i &&
											("function" == typeof i.prototype[(a = "createScriptProcessor")] ||
												"function" == typeof i.prototype[(a = "createJavaScriptNode")])),
										(h = null),
										(u.prototype.refill = function (t) {
											var e, r, i, s, n, a, o, h, u, f;
											for (e = (a = t.outputBuffer).numberOfChannels, r = new Array(e), s = o = 0; o < e; s = o += 1)
												r[s] = a.getChannelData(s);
											for (
												i = new Float32Array(this.bufferSize),
													this.emit("refill", i),
													this.resampler && (i = this.resampler.resampler(i)),
													s = h = 0,
													f = a.length;
												h < f;
												s = h += 1
											)
												for (n = u = 0; u < e; n = u += 1) r[n][s] = i[s * e + n];
										}),
										(u.prototype.destroy = function () {
											return this.node.disconnect(0);
										}),
										(u.prototype.getDeviceTime = function () {
											return this.context.currentTime * this.sampleRate;
										});
								})(i);
						}).call(this);
					}).call(this);
				}).call(
					this,
					"undefined" != typeof global
						? global
						: "undefined" != typeof self
						? self
						: "undefined" != typeof window
						? window
						: {}
				);
			},
			{ "../core/events": 8, "../device": 20, "./resampler": 22 },
		],
		24: [
			function (t, e, r) {
				(function () {
					var t;
					(t = (function () {
						function t(t, e) {
							t &&
								e &&
								Object.defineProperty(this, "value", {
									get: function () {
										return t[e];
									},
								});
						}
						return (t.prototype.process = function (t) {}), t;
					})()),
						(e.exports = t);
				}).call(this);
			},
			{},
		],
		25: [
			function (t, e, r) {
				(function () {
					var r,
						i = {}.hasOwnProperty,
						s = function (t, e) {
							for (var r in e) i.call(e, r) && (t[r] = e[r]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						};
					(r = (function (t) {
						function e() {
							return e.__super__.constructor.apply(this, arguments);
						}
						return (
							s(e, t),
							(e.prototype.process = function (t) {
								var e, r, i, s;
								if (0 !== this.value)
									for (r = Math.max(-50, Math.min(50, this.value)), e = i = 0, s = t.length; i < s; e = i += 2)
										(t[e] *= Math.min(1, (50 - r) / 50)), (t[e + 1] *= Math.min(1, (50 + r) / 50));
							}),
							e
						);
					})(t("../filter"))),
						(e.exports = r);
				}).call(this);
			},
			{ "../filter": 24 },
		],
		26: [
			function (t, e, r) {
				(function () {
					var r,
						i = {}.hasOwnProperty,
						s = function (t, e) {
							for (var r in e) i.call(e, r) && (t[r] = e[r]);
							function s() {
								this.constructor = t;
							}
							return (s.prototype = e.prototype), (t.prototype = new s()), (t.__super__ = e.prototype), t;
						};
					(r = (function (t) {
						function e() {
							return e.__super__.constructor.apply(this, arguments);
						}
						return (
							s(e, t),
							(e.prototype.process = function (t) {
								var e, r, i, s;
								if (!(this.value >= 100))
									for (r = Math.max(0, Math.min(100, this.value)) / 100, e = i = 0, s = t.length; i < s; e = i += 1)
										t[e] *= r;
							}),
							e
						);
					})(t("../filter"))),
						(e.exports = r);
				}).call(this);
			},
			{ "../filter": 24 },
		],
		27: [
			function (t, e, r) {
				(function () {
					var r,
						i,
						s,
						n,
						a,
						o,
						h,
						u = function (t, e) {
							return function () {
								return t.apply(e, arguments);
							};
						},
						f = {}.hasOwnProperty,
						c = function (t, e) {
							for (var r in e) f.call(e, r) && (t[r] = e[r]);
							function i() {
								this.constructor = t;
							}
							return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
						};
					(n = t("./core/events")),
						(r = t("./asset")),
						(h = t("./filters/volume")),
						(s = t("./filters/balance")),
						(o = t("./queue")),
						(i = t("./device")),
						(a = (function (t) {
							function e(t) {
								var e;
								(this.asset = t),
									(this.startPlaying = u(this.startPlaying, this)),
									(this.playing = !1),
									(this.buffered = 0),
									(this.currentTime = 0),
									(this.duration = 0),
									(this.volume = 100),
									(this.pan = 0),
									(this.metadata = {}),
									(this.filters = [new h(this, "volume"), new s(this, "pan")]),
									this.asset.on(
										"buffer",
										((e = this),
										function (t) {
											return (e.buffered = t), e.emit("buffer", e.buffered);
										})
									),
									this.asset.on(
										"decodeStart",
										(function (t) {
											return function () {
												return (t.queue = new o(t.asset)), t.queue.once("ready", t.startPlaying);
											};
										})(this)
									),
									this.asset.on(
										"format",
										(function (t) {
											return function (e) {
												return (t.format = e), t.emit("format", t.format);
											};
										})(this)
									),
									this.asset.on(
										"metadata",
										(function (t) {
											return function (e) {
												return (t.metadata = e), t.emit("metadata", t.metadata);
											};
										})(this)
									),
									this.asset.on(
										"duration",
										(function (t) {
											return function (e) {
												return (t.duration = e), t.emit("duration", t.duration);
											};
										})(this)
									),
									this.asset.on(
										"error",
										(function (t) {
											return function (e) {
												return t.emit("error", e);
											};
										})(this)
									);
							}
							return (
								c(e, t),
								(e.fromURL = function (t, i) {
									return new e(r.fromURL(t, i));
								}),
								(e.fromFile = function (t) {
									return new e(r.fromFile(t));
								}),
								(e.fromBuffer = function (t) {
									return new e(r.fromBuffer(t));
								}),
								(e.prototype.preload = function () {
									if (this.asset) return (this.startedPreloading = !0), this.asset.start(!1);
								}),
								(e.prototype.play = function () {
									var t;
									if (!this.playing)
										return (
											this.startedPreloading || this.preload(),
											(this.playing = !0),
											null != (t = this.device) ? t.start() : void 0
										);
								}),
								(e.prototype.pause = function () {
									var t;
									if (this.playing) return (this.playing = !1), null != (t = this.device) ? t.stop() : void 0;
								}),
								(e.prototype.togglePlayback = function () {
									return this.playing ? this.pause() : this.play();
								}),
								(e.prototype.stop = function () {
									var t;
									return this.pause(), this.asset.stop(), null != (t = this.device) ? t.destroy() : void 0;
								}),
								(e.prototype.seek = function (t) {
									var e, r;
									return (
										null != (e = this.device) && e.stop(),
										this.queue.once(
											"ready",
											((r = this),
											function () {
												var t, e;
												if ((null != (t = r.device) && t.seek(r.currentTime), r.playing))
													return null != (e = r.device) ? e.start() : void 0;
											})
										),
										(t = (t / 1e3) * this.format.sampleRate),
										(t = this.asset.decoder.seek(t)),
										(this.currentTime = ((t / this.format.sampleRate) * 1e3) | 0),
										this.queue.reset(),
										this.currentTime
									);
								}),
								(e.prototype.startPlaying = function () {
									var t, e, r;
									return (
										(t = this.queue.read()),
										(e = 0),
										(this.device = new i(this.format.sampleRate, this.format.channelsPerFrame)),
										this.device.on(
											"timeUpdate",
											((r = this),
											function (t) {
												return (r.currentTime = t), r.emit("progress", r.currentTime);
											})
										),
										(this.refill = (function (r) {
											return function (i) {
												var s, n, a, o, h, u;
												if (r.playing) {
													for (t || ((t = r.queue.read()), (e = 0)), s = 0; t && s < i.length; ) {
														for (n = Math.min(t.length - e, i.length - s), a = 0; a < n; a += 1) i[s++] = t[e++];
														e === t.length && ((t = r.queue.read()), (e = 0));
													}
													for (o = 0, h = (u = r.filters).length; o < h; o++) u[o].process(i);
													t ||
														(r.queue.ended
															? ((r.currentTime = r.duration),
															  r.emit("progress", r.currentTime),
															  r.emit("end"),
															  r.stop())
															: r.device.stop());
												}
											};
										})(this)),
										this.device.on("refill", this.refill),
										this.playing && this.device.start(),
										this.emit("ready")
									);
								}),
								(e.prototype.destroy = function () {
									var t, e;
									return (
										this.stop(),
										null != (t = this.device) && t.off(),
										null != (e = this.asset) && e.destroy(),
										this.off()
									);
								}),
								e
							);
						})(n)),
						(e.exports = a);
				}).call(this);
			},
			{
				"./asset": 1,
				"./core/events": 8,
				"./device": 20,
				"./filters/balance": 25,
				"./filters/volume": 26,
				"./queue": 28,
			},
		],
		28: [
			function (t, e, r) {
				(function () {
					var r,
						i = function (t, e) {
							return function () {
								return t.apply(e, arguments);
							};
						},
						s = {}.hasOwnProperty,
						n = function (t, e) {
							for (var r in e) s.call(e, r) && (t[r] = e[r]);
							function i() {
								this.constructor = t;
							}
							return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
						};
					(r = (function (t) {
						function e(t) {
							var e;
							(this.asset = t),
								(this.write = i(this.write, this)),
								(this.readyMark = 64),
								(this.finished = !1),
								(this.buffering = !0),
								(this.ended = !1),
								(this.buffers = []),
								this.asset.on("data", this.write),
								this.asset.on(
									"end",
									((e = this),
									function () {
										return (e.ended = !0);
									})
								),
								this.asset.decodePacket();
						}
						return (
							n(e, t),
							(e.prototype.write = function (t) {
								if ((t && this.buffers.push(t), this.buffering))
									return this.buffers.length >= this.readyMark || this.ended
										? ((this.buffering = !1), this.emit("ready"))
										: this.asset.decodePacket();
							}),
							(e.prototype.read = function () {
								return 0 === this.buffers.length ? null : (this.asset.decodePacket(), this.buffers.shift());
							}),
							(e.prototype.reset = function () {
								return (this.buffers.length = 0), (this.buffering = !0), this.asset.decodePacket();
							}),
							e
						);
					})(t("./core/events"))),
						(e.exports = r);
				}).call(this);
			},
			{ "./core/events": 8 },
		],
		29: [
			function (t, e, r) {
				var i,
					s,
					n,
					a = {}.hasOwnProperty,
					o = function (t, e) {
						for (var r in e) a.call(e, r) && (t[r] = e[r]);
						function i() {
							this.constructor = t;
						}
						return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
					};
				(s = t("../../core/events")),
					(i = t("../../core/buffer")),
					(n = (function (t) {
						function e(t) {
							if (((this.file = t), "undefined" == typeof FileReader || null === FileReader))
								return this.emit("error", "This browser does not have FileReader support.");
							(this.offset = 0),
								(this.length = this.file.size),
								(this.chunkSize = 1 << 20),
								this.file[(this.slice = "slice")] ||
									this.file[(this.slice = "webkitSlice")] ||
									this.file[(this.slice = "mozSlice")];
						}
						return (
							o(e, t),
							(e.prototype.start = function () {
								return (
									(this.reader && !this.active) ||
										((this.reader = new FileReader()),
										(this.active = !0),
										(this.reader.onload =
											((t = this),
											function (e) {
												var r;
												if (
													((r = new i(new Uint8Array(e.target.result))),
													(t.offset += r.length),
													t.emit("data", r),
													(t.active = !1),
													t.offset < t.length)
												)
													return t.loop();
											})),
										(this.reader.onloadend = (function (t) {
											return function () {
												if (t.offset === t.length) return t.emit("end"), (t.reader = null);
											};
										})(this)),
										(this.reader.onerror = (function (t) {
											return function (e) {
												return t.emit("error", e);
											};
										})(this)),
										(this.reader.onprogress = (function (t) {
											return function (e) {
												return t.emit("progress", ((t.offset + e.loaded) / t.length) * 100);
											};
										})(this))),
									this.loop()
								);
								var t;
							}),
							(e.prototype.loop = function () {
								var t, e;
								return (
									(this.active = !0),
									(e = Math.min(this.offset + this.chunkSize, this.length)),
									(t = this.file[this.slice](this.offset, e)),
									this.reader.readAsArrayBuffer(t)
								);
							}),
							(e.prototype.pause = function () {
								var t;
								this.active = !1;
								try {
									return null != (t = this.reader) ? t.abort() : void 0;
								} catch (t) {}
							}),
							(e.prototype.reset = function () {
								return this.pause(), (this.offset = 0);
							}),
							e
						);
					})(s)),
					(e.exports = n);
			},
			{ "../../core/buffer": 6, "../../core/events": 8 },
		],
		30: [
			function (t, e, r) {
				var i,
					s,
					n,
					a = {}.hasOwnProperty,
					o = function (t, e) {
						for (var r in e) a.call(e, r) && (t[r] = e[r]);
						function i() {
							this.constructor = t;
						}
						return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
					};
				(s = t("../../core/events")),
					(i = t("../../core/buffer")),
					(n = (function (t) {
						function e(t, e) {
							(this.url = t),
								(this.opts = null != e ? e : {}),
								(this.chunkSize = 1 << 20),
								(this.inflight = !1),
								this.opts.length && (this.length = this.opts.length),
								this.reset();
						}
						return (
							o(e, t),
							(e.prototype.start = function () {
								return this.length && !this.inflight
									? this.loop()
									: ((this.inflight = !0),
									  (this.xhr = new XMLHttpRequest()),
									  (this.xhr.onload =
											((t = this),
											function (e) {
												return (
													(t.length = parseInt(t.xhr.getResponseHeader("Content-Length"))), (t.inflight = !1), t.loop()
												);
											})),
									  (this.xhr.onerror = (function (t) {
											return function (e) {
												return t.pause(), t.emit("error", e);
											};
									  })(this)),
									  (this.xhr.onabort = (function (t) {
											return function (e) {
												return (t.inflight = !1);
											};
									  })(this)),
									  this.xhr.open("HEAD", this.url, !0),
									  this.xhr.send(null));
								var t;
							}),
							(e.prototype.loop = function () {
								var t, e;
								return this.inflight || !this.length
									? this.emit("error", "Something is wrong in HTTPSource.loop")
									: ((this.inflight = !0),
									  (this.xhr = new XMLHttpRequest()),
									  (this.xhr.onload =
											((e = this),
											function (t) {
												var r, s, n, a, o, h;
												if (e.xhr.response) r = new Uint8Array(e.xhr.response);
												else
													for (
														a = e.xhr.responseText, r = new Uint8Array(a.length), n = o = 0, h = a.length;
														0 <= h ? o < h : o > h;
														n = 0 <= h ? ++o : --o
													)
														r[n] = 255 & a.charCodeAt(n);
												if (
													((s = new i(r)),
													(e.offset += s.length),
													e.emit("data", s),
													e.offset >= e.length && e.emit("end"),
													(e.inflight = !1),
													!(e.offset >= e.length))
												)
													return e.loop();
											})),
									  (this.xhr.onprogress = (function (t) {
											return function (e) {
												return t.emit("progress", ((t.offset + e.loaded) / t.length) * 100);
											};
									  })(this)),
									  (this.xhr.onerror = (function (t) {
											return function (e) {
												return t.emit("error", e), t.pause();
											};
									  })(this)),
									  (this.xhr.onabort = (function (t) {
											return function (e) {
												return (t.inflight = !1);
											};
									  })(this)),
									  this.xhr.open("GET", this.url, !0),
									  (this.xhr.responseType = "arraybuffer"),
									  (t = Math.min(this.offset + this.chunkSize, this.length - 1)),
									  this.xhr.setRequestHeader("If-None-Match", "webkit-no-cache"),
									  this.xhr.setRequestHeader("Range", "bytes=" + this.offset + "-" + t),
									  this.xhr.overrideMimeType("text/plain; charset=x-user-defined"),
									  this.xhr.send(null));
							}),
							(e.prototype.pause = function () {
								var t;
								return (this.inflight = !1), null != (t = this.xhr) ? t.abort() : void 0;
							}),
							(e.prototype.reset = function () {
								return this.pause(), (this.offset = 0);
							}),
							e
						);
					})(s)),
					(e.exports = n);
			},
			{ "../../core/buffer": 6, "../../core/events": 8 },
		],
		31: [
			function (t, e, r) {
				(function (r) {
					(function () {
						(function () {
							var i,
								s,
								n,
								a,
								o = function (t, e) {
									return function () {
										return t.apply(e, arguments);
									};
								},
								h = {}.hasOwnProperty,
								u = function (t, e) {
									for (var r in e) h.call(e, r) && (t[r] = e[r]);
									function i() {
										this.constructor = t;
									}
									return (i.prototype = e.prototype), (t.prototype = new i()), (t.__super__ = e.prototype), t;
								};
							(a = t("../core/events")),
								(s = t("../core/bufferlist")),
								(i = t("../core/buffer")),
								(n = (function (t) {
									var e, n;
									function a(t) {
										(this.loop = o(this.loop, this)),
											t instanceof s ? (this.list = t) : ((this.list = new s()), this.list.append(new i(t))),
											(this.paused = !0);
									}
									return (
										u(a, t),
										(n =
											r.setImmediate ||
											function (t) {
												return r.setTimeout(t, 0);
											}),
										(e =
											r.clearImmediate ||
											function (t) {
												return r.clearTimeout(t);
											}),
										(a.prototype.start = function () {
											return (this.paused = !1), (this._timer = n(this.loop));
										}),
										(a.prototype.loop = function () {
											return (
												this.emit(
													"progress",
													(((this.list.numBuffers - this.list.availableBuffers + 1) / this.list.numBuffers) * 100) | 0
												),
												this.emit("data", this.list.first),
												this.list.advance() ? n(this.loop) : this.emit("end")
											);
										}),
										(a.prototype.pause = function () {
											return e(this._timer), (this.paused = !0);
										}),
										(a.prototype.reset = function () {
											return this.pause(), this.list.rewind();
										}),
										a
									);
								})(a)),
								(e.exports = n);
						}).call(this);
					}).call(this);
				}).call(
					this,
					"undefined" != typeof global
						? global
						: "undefined" != typeof self
						? self
						: "undefined" != typeof window
						? window
						: {}
				);
			},
			{ "../core/buffer": 6, "../core/bufferlist": 7, "../core/events": 8 },
		],
		32: [
			function (t, e, r) {
				var i, s, n;
				for (i in (n = t("./src/aurora"))) (s = n[i]), (r[i] = s);
				t("./src/devices/webaudio"), t("./src/devices/mozilla");
			},
			{ "./src/aurora": 2, "./src/devices/mozilla": 21, "./src/devices/webaudio": 23 },
		],
	},
	{},
	[32]
)(32);
export default t;
