import "core-js/actual/symbol";
import "./abort-controller.js";

import type countries from "@/assets/country_dial_info.json";

import Deferred from "./Deffered";

import EventEmitter from "eventemitter3";
import { TelegramClient, TelegramWorkerPort } from "@mtcute/web";
import { tl } from "@mtcute/tl";

import * as Comlink from "comlink";

import TelegramWorkerURL from "./worker.js?worker&url";
import type { Exposed } from "./worker.js";

type Country = (typeof countries)[number];

const apiId = import.meta.env.VITE_APP_ID;
const apiHash = import.meta.env.VITE_APP_HASH;

let client_not_ready: TelegramClient | null = null;

const clientInit = new Deferred<void>();

const EE = new EventEmitter<{
	qr: () => void;
	worker: (e: any) => void;
}>();

const worker = new Worker(TelegramWorkerURL + location.hash, {
	type: "module",
});

const port = new TelegramWorkerPort({
	worker,
});

const wrapped = Comlink.wrap<Exposed>(worker);

export const gunzip = wrapped.gunzip;
export const gzip = wrapped.gzip;
export const webp = wrapped.webp;
export const getAvailableMemory = wrapped.getAvailableMemory;

let abortQr: null | AbortController = null;

class App {
	async startSession(
		onLogin: (tg: TelegramClient) => void,
		phoneNumber: () => Promise<string>,
		password: (hint?: string) => Promise<string>,
		phoneCode: () => Promise<string>,

		qrCode: (url: string | null) => void,

		onError: (message: string) => void,
		onLoginError: (step: number, code: number, message: string) => void
	) {
		this.getCountries();

		// @ts-ignore
		navigator.requestWakeLock?.("cpu");

		const tg = new TelegramClient({
			apiId,
			apiHash,

			client: port,
		});

		console.error("HIIII");

		Object.assign(window, { tg });

		async function checkSignedIn() {
			// Try calling any method that requires authorization
			// (getMe is the simplest one and likely the most useful,
			// but you can use any other)
			return await tg
				.getMe()
				.then((user) => {
					tg.notifyLoggedIn(user.raw);
					tg.startUpdatesLoop();
					return user;
				})
				.catch(() => null);
		}

		let lastStep = 0;

		async function sendCode() {
			console.log("step 1 sendCode");
			await tg.connect();
			const phone = await phoneNumber();
			lastStep = 1;
			tg.sendCode({ phone })
				.then(({ phoneCodeHash }) => {
					verifyCode(phoneCodeHash, phone);
				})
				.catch((e) => {
					onLoginError(1, e.code || 0, e.message);
					sendCode();
				});
		}

		async function verifyCode(phoneCodeHash: string, phone: string) {
			console.log("step 2 verifyCode");
			lastStep = 2;
			await tg.connect();
			tg.signIn({
				phone,
				phoneCodeHash,
				phoneCode: await phoneCode(),
			})
				.then((user) => {
					console.log("login ended at step 2!!");
					lastStep = 0;
					tg.notifyLoggedIn(user.raw);
					tg.startUpdatesLoop();
					onLogin(tg);
				})
				.catch(async (e: tl.RpcError) => {
					if (tl.RpcError.is(e, "SESSION_PASSWORD_NEEDED")) {
						signInPassword();
						return;
					}

					if (tl.RpcError.is(e, "PHONE_CODE_INVALID")) {
						verifyCode(phoneCodeHash, phone);
					}

					if (tl.RpcError.is(e, "PHONE_CODE_EXPIRED")) {
						await tg.resendCode({
							phone,
							phoneCodeHash,
						});
						verifyCode(phoneCodeHash, phone);
					}

					onLoginError(2, (e && e.code) || 0, (e && e.text) || e.message);
				});
		}

		async function signInPassword() {
			console.log("step 3 password");
			lastStep = 3;
			await tg.connect();

			if (await checkSignedIn()) {
				lastStep = 0;
				console.log("already authorized skipping 2fa");

				onLogin(tg);
				return;
			}

			tg.checkPassword(await password())
				.then((user) => {
					lastStep = 0;
					console.log("login ended at step 3");
					tg.notifyLoggedIn(user.raw);
					tg.startUpdatesLoop();
					onLogin(tg);
				})
				.catch((e) => {
					if (tl.RpcError.is(e, "PASSWORD_HASH_INVALID")) {
						onLoginError(3, e.code || 0, e.text || e.message);
					} else {
						onLoginError(3, (e && e.code) || 0, e && (e.text || e.message));
						phoneNumber();
					}
				});
		}

		tg.onError(async function (err: any) {
			// console.error("client_error", err);

			onError(err && err.message);

			if (lastStep !== 0) {
				onLoginError(lastStep, err && (err.code || 0), err && (err.errorMessage || err.message));
			}
		});

		tg.onConnectionState(console.error.bind(console));

		// console.log(tg);

		await tg.connect();

		client_not_ready = tg;

		// console.error("HIIIIIII");

		// abortQr = new AbortController();
		// const signal = abortQr.signal;

		EE.once("qr", function qr() {
			console.log("QR login has started");
			tg.signInQr({
				password: () => {
					qrCode(null);
					return password();
				},
				invalidPasswordCallback: () => {
					qrCode(null);
					onLoginError(3, 333, "INVALID PASSWORD");
				},

				onQrScanned() {
					qrCode(null);
				},

				onUrlUpdated(url, expires) {
					qrCode(url);
				},

				// abortSignal: signal,
			})
				.then((user) => {
					qrCode(null);
					console.log("login via qr success");

					abortQr = null;
					tg.notifyLoggedIn(user.raw);
					tg.startUpdatesLoop();
					onLogin(tg);
				})
				.catch((e) => {
					qrCode(null);

					EE.once("qr", qr);

					if (e instanceof Error && e.name == "AbortError") {
						console.log("QR was aborted");
						return;
					}
					console.error(e);
					alert("something went wrong with the qr login, you might need to scan again");
				});
		});

		clientInit.resolve();
		Object.assign(self, { tg });

		if (await checkSignedIn()) {
			console.log("authorized already!");
			onLogin(tg);
		} else {
			console.log("start login process");
			sendCode();
		}
	}

	private async _getCountries() {
		await clientInit.promise;
		if (!client_not_ready) return null;

		const result = await client_not_ready.call({
			_: "help.getCountriesList",
			langCode: "en-US",
			hash: 0,
		});

		return "countries" in result
			? (result.countries
					.sort((a, b) => a.defaultName.localeCompare(b.defaultName))
					.map((a, i) => ({
						name: a.defaultName,
						code: a.iso2,
						dial_code: "+" + a.countryCodes[0].countryCode,
						flag: "?",
						id: i,
					})) as Country[])
			: null;
	}

	private _countriesCache: Promise<Country[] | null> | null = null;

	getCountries() {
		return this._countriesCache || (this._countriesCache = this._getCountries());
	}

	async getNearestDC(): Promise<Country | null> {
		await clientInit.promise;
		if (!client_not_ready) return null;

		const countries = await this.getCountries();

		const nearest = await client_not_ready.call({
			_: "help.getNearestDc",
		});
		const code = nearest.country;
		const found = countries?.find((a) => a.code == code);
		if (found) {
			return found;
		}
		return {
			name: "?",
			flag: "?",
			code: code,
			dial_code: "?",
			id: NaN,
		};
	}

	async requestQR() {
		await clientInit.promise;
		EE.emit("qr");
	}

	async abortQR() {
		abortQr?.abort();
	}
}

export type { App };

export const telegram = new App();

Object.assign(self, { telegram, _tg: wrapped });
