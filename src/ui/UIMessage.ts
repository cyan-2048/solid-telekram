import type { MaybePromise, Message, Peer, TextWithEntities, tl, User } from "@mtcute/core";
import { atom } from "nanostores";
import type UIDialog from "./UIDialog";
import { tg, dialogsJar } from "@globals";
import { capitalizeFirstLetter, formatTime, isUser, resolveSync } from "@utils";

import { differenceInDays } from "date-fns/differenceInDays";
import { formatDistance } from "date-fns/formatDistance";

const _instanceof_symbol = Symbol("UIMessage");

export default class UIMessage {
	[_instanceof_symbol] = true;

	private cache: Partial<{
		replyTo: null | UIMessage;
		defferedReply: Promise<UIMessage | null>;
		gettingUser: boolean;

		usersForAction: User[];
		defferedUsersForAction: Promise<User[]>;
		quote: {
			chat: Peer;
			entities: TextWithEntities;
		};
		isReply: boolean;
		uiDialog: UIDialog;
	}> = {};

	$text = atom("...");
	$entities = atom<TextWithEntities>(null as any);
	$editDate = atom<Date | null>(null);
	$isUnsupported = atom(false);

	isOutgoing: boolean;
	isSticker = false;

	date: Date;
	id: number;

	constructor(
		public raw: Message,
		public cached = false,
	) {
		this.id = raw.id;
		this.isOutgoing = raw.isOutgoing;
		this.date = raw.date;
		this.update(raw);
	}

	getQuote(): {
		chat: Peer;
		entities: TextWithEntities;
	} | null {
		if (this.cache.quote) return this.cache.quote;

		const replyToMessage = this.raw.replyToMessage;
		if (replyToMessage) {
			if (replyToMessage.isQuote) {
				return (this.cache.quote = {
					chat: replyToMessage.chat || this.raw.chat,
					entities: {
						text: replyToMessage.quoteText,
						entities: replyToMessage.raw.quoteEntities,
					},
				});
			}
		}

		return null;
	}

	get chatType() {
		const chat = this.raw.chat;
		return "chatType" in chat ? chat.chatType : "private";
	}

	get media() {
		return this.raw.media;
	}

	get action() {
		return this.raw.action;
	}

	get textWithEntities() {
		return this.raw.textWithEntities;
	}

	update($: Message) {
		this.raw = $;
		this.$entities.set($.textWithEntities);
		this.isOutgoing = this.raw.isOutgoing;
		this.#updateText($);

		this.$editDate.set($.hideEditMark ? null : $.editDate);

		return this;
	}

	#getUsersForAction(users: number[]): MaybePromise<User[]> {
		if (this.cache.usersForAction) return this.cache.usersForAction;
		if (this.cache.defferedUsersForAction) return this.cache.defferedUsersForAction;
		const promise = tg.getUsers(users).then((users) => users.filter((a) => a !== null));
		promise.then((users) => {
			this.cache.usersForAction = users;
		});
		this.cache.defferedUsersForAction = promise;
		return promise;
	}

	getReply(_dialog?: UIDialog): MaybePromise<UIMessage | null> {
		if (!this.raw.replyToMessage) {
			return null;
		}

		const msgID = this.raw.replyToMessage.id;

		// console.error("MSGID", msgID);

		if (msgID) {
			const msg = (_dialog || this.getDialog())?.messages.get(msgID);
			if (msg) {
				// console.error("FOUND MESSAGE IN DIALOG!");
				return msg;
			}
		}

		// SYNC
		if (this.cache.replyTo) return this.cache.replyTo;

		// ASYNC
		if (this.cache.defferedReply) return this.cache.defferedReply;

		const promise = tg
			.getReplyTo(this.raw)
			.then((msg) => {
				// console.error("REPLY TO FOUND!!", msg);
				if (msg) {
					const dialog = _dialog || dialogsJar.get(msg.chat.id);

					if (dialog) {
						return dialog.messages.addCached(msg);
					}

					return new UIMessage(msg);
				} else {
					return null;
				}
			})
			.catch(() => null);

		promise.then((msg) => {
			this.cache.replyTo = msg;
		});

		this.cache.defferedReply = promise;

		return promise;
	}

	get sender() {
		return this.raw.sender;
	}

	#updateText($: Message) {
		let newText = $.text;

		if ($.action) {
			const action = $.action;

			switch (action.type) {
				case "chat_created": {
					newText = ($.isOutgoing ? "You" : $.sender.displayName) + " created the group";
					break;
				}
				case "title_changed": {
					newText = $.sender.displayName + ' changed the group name to "' + action.title + '"';
					break;
				}
				case "message_pinned": {
					const fn = (msg: UIMessage | null) => {
						if (msg) {
							const text = msg.raw.text || "a message";
							this.$text.set($.sender.displayName + ' pinned "' + UIMessage.ellipses(text) + '"');
						}
					};

					const reply = this.getReply();

					newText = $.sender.displayName + " pinned a message";

					resolveSync(reply, fn);

					break;
				}

				case "users_added": {
					const sender = $.isOutgoing ? "You" : $.sender.displayName;
					if (action.users[0] === $.sender.id) {
						newText = sender + " joined the group";
						break;
					}

					// yes this isn't properly memoized
					// but action.users should not really change anyways
					const users = this.#getUsersForAction(action.users);

					newText = sender + " added " + (action.users.length > 1 ? "many users" : "a user");

					const fn = (_users: User[]) => {
						if (_users.length) {
							this.$text.set(sender + " added " + UIMessage.oxford(..._users.map((a) => a.displayName)));
						} else {
							// @ts-ignore
							console.error("NO USERS FOUND:", action.users);
						}
					};

					resolveSync(users, fn);

					break;
				}

				case "user_removed": {
					const sender = $.isOutgoing ? "You" : $.sender.displayName;

					if (action.user === $.sender.id) {
						newText = sender + " left the group";
						break;
					}

					newText = sender + " removed a user";

					const users = this.#getUsersForAction([action.user]);

					const fn = (user: User) => {
						if (user) {
							this.$text.set(sender + " removed " + user.displayName);
						} else {
							// @ts-ignore
							console.error("USER NOT FOUND:", action.user);
						}
					};

					resolveSync(users, (arr) => fn(arr[0]));

					break;
				}

				case "user_left":
					newText = $.sender.displayName + " left the group";
					break;

				case "topic_created":
					newText = action.title + " was created";
					break;

				case "topic_edited":
					if (action.closed) {
						newText = $.sender.displayName + " closed the topic";
					}
					break;

				case "call":
					if (action.duration) {
						newText =
							($.isOutgoing ? "Outgoing Call" : "Incoming Call") + ` (${formatDistance(0, action.duration * 1000)})`;
					} else if (action.reason) {
						newText = UIMessage.callDiscardReasonFromTl(action.reason);
					}

					break;

				case "user_joined_link":
					newText = $.sender.displayName + "  joined the group via invite link";
					break;

				case "custom":
					newText = action.action;
					break;

				case "contact_joined":
					newText = "Joined Telegram";
					break;

				case "channel_created":
					newText = capitalizeFirstLetter(action.type.split("_").join(" "));
					break;

				case "history_cleared":
					newText = "History was cleared";
					break;

				// uhh idk how this one works???
				// case "messages_paid":
				//
				// 	break;

				default: {
					newText = "Unsupported Message Action: " + action.type;
				}
			}
		}

		if ($.media) {
			switch ($.media.type) {
				case "location": {
					newText = "Location";
					break;
				}

				case "photo": {
					newText = $.text ? "🖼️ " + $.text : "Photo";
					break;
				}

				case "webpage": {
					break;
				}

				case "sticker": {
					newText = $.media.emoji + " Sticker";
					this.isSticker = true;
					break;
				}

				case "video": {
					newText = "Video";
					if ($.media.isAnimation || $.media.isLegacyGif) {
						newText = "GIF";
					}

					break;
				}

				case "voice":
					newText = `🎤 Voice (${formatTime($.media.duration)})`;
					break;
				case "audio":
					const audio = $.media;
					newText = `🎧 ${
						$.text || (audio.performer && audio.title) ? audio.title + " — " + audio.performer : audio.fileName
					}`;
					break;

				case "document":
					newText = $.media.fileName || "File";
					if ($.text) {
						newText += ", " + $.text;
					}
					break;

				default: {
					console.log("unsupported media type:", $.media.type, $);
					this.$isUnsupported.set(true);
					newText = capitalizeFirstLetter($.media.type.split("_").join(" "));
				}
			}
		}

		this.$text.set(newText);
	}

	getDialog(): UIDialog | null {
		return dialogsJar.get(this.raw.chat.raw.id) || null;
	}

	// thanks mtcute guy

	canEdit() {
		const messsage = this.raw;

		// action messages seem to never be editable???
		if (messsage.raw._ != "message") return false;

		// obviously
		if (this.cached) return false;

		if (this.raw.forward) return false;

		// messages you sent to saved messages??? idk??? is this the same thing with forwarded messages??
		if (isUser(messsage.chat) && isUser(messsage.sender) && messsage.chat.isSelf && messsage.sender.isSelf) {
			return true;
		}

		if (!this.isOutgoing) return false;

		if (!isUser(messsage.chat) && messsage.chat.chatType == "channel" && messsage.chat.isAdmin) {
			return true;
		}

		const diff = differenceInDays(new Date(), messsage.date);

		const hasPinnedPermission = (() => {
			const rawChat = messsage.chat;

			const permissions = (() => {
				if ("permissions" in rawChat && rawChat.permissions) {
					return rawChat.permissions;
				}

				// this part is expensive, we will use rawChat.permissions if available
				const dialog = this.getDialog();
				return dialog && dialog.$permissions.get();
			})();

			if (permissions?.canPinMessages === true) {
				return true;
			}

			return false;
		})();

		switch (messsage.media?.type) {
			// you can't edit messages
			// what is this??
			case "game":
			// what is this???
			case "paid":
			case "sticker":
			case "document":
			case "poll":
			case "contact":
			case "dice":
			case "venue":
			case "invoice":
			case "location":
			case "story":
				return false;

			case "webpage":
			case "audio":
			case "photo":
			case "video":
			case "voice":
				break;

			case "live_location":
				// live location can be edited only during the period
				return Date.now() - messsage.date.getTime() < messsage.media.period;
		}

		if (hasPinnedPermission === true) {
			return true;
		}

		return diff < 2;
	}

	// decide whether the reply thing should show up idk
	#_isReply() {
		const replyToMessage = this.raw.replyToMessage;

		if (!replyToMessage) return false;

		// if (replyToMessage.threadId === replyToMessage.id) return false;

		const chat = this.raw.chat;

		const isForum = "isForum" in chat && chat.isForum;
		const raw = this.raw.replyToMessage?.raw;

		// this.rawMessage.replyToMessage?.origin;

		if (raw && isForum && raw.forumTopic && !raw.replyToTopId) {
			return false;
		}

		return !!this.raw.replyToMessage;
	}

	isReply() {
		return (this.cache.isReply ??= this.#_isReply());
	}

	static oxford(...arr: string[]) {
		if (arr.length == 1) return arr[0];

		var last = arr.pop();
		return arr.join(", ") + " and " + last;
	}

	static callDiscardReasonFromTl(raw: tl.TypePhoneCallDiscardReason) {
		switch (raw._) {
			case "phoneCallDiscardReasonMissed":
				return "Missed Call";
			case "phoneCallDiscardReasonDisconnect":
				return "Call Disconnected";
			case "phoneCallDiscardReasonHangup":
				return "Call Ended";
			case "phoneCallDiscardReasonBusy":
				return "Call Busy";
			default:
				return "Call Unknown";
		}
	}

	static ellipses(text: string, maxLength = 52) {
		const e = text.slice(0, maxLength);
		if (e.length != text.length) {
			return e + "...";
		}
		return text;
	}

	static is(message: unknown): message is UIMessage {
		return typeof message == "object" && Boolean(message && (message as UIMessage)[_instanceof_symbol]);
	}
}
