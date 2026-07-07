// middlewares the client uses, for now it's just to check if the user was logged out

import appVersion from "@/lib/appVersion";
import parseUserAgent from "@/lib/parseUserAgent";
import type { Middleware } from "@fuman/utils";
import type { RpcCallMiddlewareContext } from "@mtcute/core";

// @ts-ignore
import { mediaThrottle } from "@mtcute/core/network/middlewares/media-throttle";

// @ts-ignore
import { floodWaiter } from "@mtcute/core/network/middlewares/flood-waiter";
// @ts-ignore
import { internalErrorsHandler } from "@mtcute/core/network/middlewares/internal-errors";
import type { mtp } from "@mtcute/core";
import type { BaseTelegramClientOptions } from "@mtcute/web";

function isTlRpcError(obj: unknown): obj is mtp.RawMt_rpc_error {
	return typeof obj === "object" && obj !== null && (obj as { _: string })._ === "mt_rpc_error";
}

const middlewares = [
	mediaThrottle(),
	floodWaiter({
		maxRetries: 20,
	}),
	async (ctx, next) => {
		const res = await next(ctx);

		if (
			isTlRpcError(res) &&
			((res.errorCode == 401 && res.errorMessage == "SESSION_REVOKED") || res.errorMessage == "AUTH_KEY_UNREGISTERED")
		) {
			// console.log("MIDDLEWARE", ctx.request, res);

			const { request } = ctx;

			if (request._ == "users.getUsers" && request.id[0]?._ == "inputUserSelf") {
				// if the request was tg.getMe() it's not really important?
			} else {
				console.error("A LOGOUT OCCURED???", ctx.request);
			}
		}

		return res;
	},
	internalErrorsHandler({}),
] as Middleware<RpcCallMiddlewareContext, unknown>[];

export const config: Omit<BaseTelegramClientOptions, "apiId" | "apiHash"> = {
	initConnectionOptions: {
		deviceModel: navigator.userAgent,
		systemVersion: parseUserAgent(navigator.userAgent).systemVersion.replace("/", " "),
		appVersion: appVersion(),
	},

	// reconnectionStrategy: (params, lastError, consequentFails, previousWait) => {
	// 	// console.error("RECONNECTION STRATEGYYYY", params, lastError, consequentFails, previousWait);
	// 	return defaultReconnectionStrategy(params, lastError, consequentFails, previousWait);
	// },

	network: {
		middlewares: middlewares,
	},

	updates: {
		catchUp: true,
	},

	storage: "telekram",

	logLevel: 3,
};

export default middlewares;
