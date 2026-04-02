import type { UserStatus, UserStatusUpdate } from "@mtcute/core";
import { atom } from "nanostores";

/**
 * UIU looks so ugly lol
 */
export default class UIUserStatus {
	userId: number;

	status = atom<UserStatus>("offline");
	lastOnline = atom<null | Date>(null);

	/**
	 *
	 * @param userId will create default offline user status
	 */
	constructor(userId: number);
	/**
	 *
	 * @param rawUserStatus
	 */
	constructor(rawUserStatus: UserStatusUpdate);
	constructor(_: number | UserStatusUpdate) {
		if (typeof _ == "number") {
			this.userId = _;
		} else {
			this.userId = _.userId;
			this.update(_);
		}
	}

	update(userStatus: UserStatusUpdate) {
		this.status.set(userStatus.status);
		this.lastOnline.set(userStatus.lastOnline);

		return this;
	}
}
