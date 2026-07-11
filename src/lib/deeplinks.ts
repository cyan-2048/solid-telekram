// Define a union type for supported link categories based on Telegram's core docs
export type TelegramDeepLink =
	| { type: "username"; username: string; draftText: string | null; profile: boolean }
	| { type: "phone"; phoneNumber: string; draftText: string | null; profile: boolean }
	| { type: "invite"; hash: string }
	| { type: "chat_folder"; slug: string }
	| { type: "message"; context: string; messageId: number; threadId?: string; single?: boolean }
	| { type: "share"; shareUrl: string | null; text: string | null }
	| {
			type: "bot";
			botUsername: string;
			startParam: string | null;
			groupParam: string | null;
			adminPerms: string | null;
	  }
	| { type: "miniapp"; botUsername: string; appName: string; startApp: string | null }
	| { type: "stickerset"; slug: string; isEmoji: boolean }
	| {
			type: "proxy";
			proxyType: "mtproxy" | "socks5";
			server: string;
			port: number;
			secret?: string;
			user?: string;
			pass?: string;
	  }
	| { type: "tonsite"; domain: string; path: string; query: string; hash: string }
	| { type: "unknown"; rawUrl: string; protocol: string }
	| { type: "user"; id: number };

const RESERVED_SUBDOMAINS = new Set([
	"addemoji",
	"addlist",
	"addstickers",
	"addstyle",
	"addtheme",
	"auction",
	"auth",
	"boost",
	"call",
	"confirmphone",
	"contact",
	"giftcode",
	"invoice",
	"joinchat",
	"login",
	"m",
	"nft",
	"proxy",
	"setlanguage",
	"share",
	"socks",
	"web",
	"a",
	"k",
	"z",
	"www",
]);

export function normalizeTelegramUrl(url: URL): URL {
	// Only apply this to http/https protocols
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		return url;
	}

	// Check if the hostname matches the <username>.t.me pattern
	if (url.hostname.endsWith(".t.me")) {
		const username = url.hostname.slice(0, -5); // Extract part before '.t.me'

		const isNotSingleLetter = username.length > 1;
		const isNotReserved = !RESERVED_SUBDOMAINS.has(username.toLowerCase());
		// Telegram usernames are alphanumeric and underscores
		const isValidUsername = /^[a-zA-Z0-9_]+$/.test(username);

		if (isNotSingleLetter && isNotReserved && isValidUsername) {
			// Construct the new path: /<username>/<rest_of_path>
			const cleanPathname = url.pathname === "/" ? "" : url.pathname;
			const newPathname = `/${username}${cleanPathname}`;

			// Return a newly constructed standard t.me URL
			return new URL(`https://t.me${newPathname}${url.search}${url.hash}`);
		}
	}

	return url;
}

export function parseTelegramLink(rawUrl: URL): TelegramDeepLink {
	if (typeof rawUrl == "string") {
		rawUrl = new URL(rawUrl);
	}

	// 1. Normalize the link first to catch <username>.t.me edge cases
	const url = normalizeTelegramUrl(rawUrl);
	const params = url.searchParams;
	const linkString = url.toString(); // Used for the fallback 'unknown' return type

	// 1. Handle TON Sites (tonsite:// or .ton)
	if (url.protocol === "tonsite:") {
		return {
			type: "tonsite",
			domain: url.hostname,
			path: url.pathname,
			query: url.search,
			hash: url.hash,
		};
	}

	// 2. Handle tg:// custom scheme
	if (url.protocol === "tg:") {
		switch (url.hostname) {
			case "resolve": {
				const domain = params.get("domain");
				const phone = params.get("phone");

				if (domain) {
					// Handle Bots / Mini Apps
					if (params.has("startapp") || params.has("appname")) {
						return {
							type: "miniapp",
							botUsername: domain,
							appName: params.get("appname") || "",
							startApp: params.get("startapp"),
						};
					}
					if (params.has("start") || params.has("startgroup") || params.has("startchannel")) {
						return {
							type: "bot",
							botUsername: domain,
							startParam: params.get("start"),
							groupParam: params.get("startgroup") || params.get("startchannel"),
							adminPerms: params.get("admin"),
						};
					}
					// Handle Messages
					if (params.has("post")) {
						return {
							type: "message",
							context: domain,
							messageId: parseInt(params.get("post")!, 10),
							threadId: params.get("thread") || undefined,
							single: params.has("single"),
						};
					}
					// Handle Usernames
					return { type: "username", username: domain, draftText: params.get("text"), profile: params.has("profile") };
				}

				if (phone) {
					return { type: "phone", phoneNumber: phone, draftText: params.get("text"), profile: params.has("profile") };
				}
				break;
			}
			case "join":
				return { type: "invite", hash: params.get("invite") || "" };
			case "addlist":
				return { type: "chat_folder", slug: params.get("slug") || "" };
			case "msg_url":
				return { type: "share", shareUrl: params.get("url"), text: params.get("text") };
			case "addstickers":
				return { type: "stickerset", slug: params.get("set") || "", isEmoji: false };
			case "addemoji":
				return { type: "stickerset", slug: params.get("set") || "", isEmoji: true };
			case "user":
				return { type: "user", id: Number(params.get("id")) };
			case "proxy":
				return {
					type: "proxy",
					proxyType: "mtproxy",
					server: params.get("server") || "",
					port: Number(params.get("port")),
					secret: params.get("secret") || undefined,
				};
			case "socks":
				return {
					type: "proxy",
					proxyType: "socks5",
					server: params.get("server") || "",
					port: Number(params.get("port")),
					user: params.get("user") || undefined,
					pass: params.get("pass") || undefined,
				};
		}
		return { type: "unknown", rawUrl: linkString, protocol: url.protocol };
	}

	// 3. Handle https://t.me/ links
	if (url.protocol === "https:" || url.protocol === "http:") {
		if (!url.hostname.endsWith("t.me") && !url.hostname.endsWith("telegram.me")) {
			return { type: "unknown", rawUrl: linkString, protocol: url.protocol };
		}

		const pathParts = url.pathname.split("/").filter(Boolean);
		if (pathParts.length === 0) return { type: "unknown", rawUrl: linkString, protocol: url.protocol };

		const firstSegment = pathParts[0];

		// Utilities & Sharing
		if (firstSegment === "share" || firstSegment === "msg")
			return { type: "share", shareUrl: params.get("url"), text: params.get("text") };
		if (firstSegment === "addstickers") return { type: "stickerset", slug: pathParts[1], isEmoji: false };
		if (firstSegment === "addemoji") return { type: "stickerset", slug: pathParts[1], isEmoji: true };
		if (firstSegment === "proxy")
			return {
				type: "proxy",
				proxyType: "mtproxy",
				server: params.get("server") || "",
				port: Number(params.get("port")),
				secret: params.get("secret") || undefined,
			};
		if (firstSegment === "socks")
			return {
				type: "proxy",
				proxyType: "socks5",
				server: params.get("server") || "",
				port: Number(params.get("port")),
				user: params.get("user") || undefined,
				pass: params.get("pass") || undefined,
			};

		// Invites & Folders
		if (firstSegment === "addlist") return { type: "chat_folder", slug: pathParts[1] };
		if (firstSegment === "joinchat") return { type: "invite", hash: pathParts[1] };
		if (firstSegment.startsWith("+") && !firstSegment.match(/^\+\d+$/))
			return { type: "invite", hash: firstSegment.substring(1) };

		// Phones
		if (firstSegment.match(/^\+\d+$/))
			return {
				type: "phone",
				phoneNumber: firstSegment.substring(1),
				draftText: params.get("text"),
				profile: params.has("profile"),
			};

		// Messages (t.me/username/123 or t.me/c/channel_id/123)
		if (pathParts.length >= 2) {
			const isPrivate = firstSegment === "c";
			const msgIdStr = pathParts[pathParts.length - 1]; // Last segment is usually the message ID

			if (!isNaN(Number(msgIdStr))) {
				return {
					type: "message",
					context: isPrivate ? pathParts[1] : firstSegment,
					messageId: parseInt(msgIdStr, 10),
					single: params.has("single"),
				};
			}

			// Mini App Direct Links (t.me/botname/appname)
			if (params.has("startapp")) {
				return { type: "miniapp", botUsername: firstSegment, appName: pathParts[1], startApp: params.get("startapp") };
			}
		}

		// Bots
		if (params.has("start") || params.has("startgroup") || params.has("startchannel")) {
			return {
				type: "bot",
				botUsername: firstSegment,
				startParam: params.get("start"),
				groupParam: params.get("startgroup") || params.get("startchannel"),
				adminPerms: params.get("admin"),
			};
		}

		// Fallback to Public Username
		return { type: "username", username: firstSegment, draftText: params.get("text"), profile: params.has("profile") };
	}

	return { type: "unknown", rawUrl: linkString, protocol: url.protocol };
}
