import UIUserStatus from "./UIUserStatus";

export default class UserStatusJar extends Map<number, UIUserStatus> {
	get(id: number) {
		const has = super.get(id);
		if (has) return has;

		const _ = new UIUserStatus(id);

		this.set(_.userId, _);

		return _;
	}
}
