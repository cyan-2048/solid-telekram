import type UIDialog from "./UIDialog";

const _instanceof_symbol = Symbol("UIForumGroup");

export default class UIForumGroup {
	private [_instanceof_symbol] = true;

	constructor(private dialog: UIDialog) {}

	static is(dialog: unknown): dialog is UIForumGroup {
		return typeof dialog == "object" && Boolean(dialog && (dialog as UIForumGroup)[_instanceof_symbol]);
	}
}
