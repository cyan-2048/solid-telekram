// Template for creating UI classes with the `.is(obj)` static method

const _instanceof_symbol = Symbol("Example");

export default class Example {
	private [_instanceof_symbol] = true;

	static is(dialog: unknown): dialog is Example {
		return typeof dialog == "object" && Boolean(dialog && (dialog as Example)[_instanceof_symbol]);
	}
}
