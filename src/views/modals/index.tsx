import { createSignal, Match, Switch } from "solid-js";
import Alert from "./Alert";
import Confirm from "./Confirm";
import Prompt from "./Prompt";
import { sleep } from "@/helpers";
import Select from "./Select";

const NOOP = () => {};

const enum Modal {
	Alert,
	Confirm,
	Prompt,
	Select,
}

export function alert(text = "", title = "TeleKram") {
	return alert.v(text, title);
}

alert.v = (_text: string, _title: string): Promise<void> => Promise.resolve();

export function confirm(text = "", title = "TeleKram", yes = "OK", no = "Cancel") {
	return confirm.v(text, title, yes, no);
}

confirm.v = (_text: string, _title: string, _yes: string, _no: string): Promise<boolean> => Promise.resolve(false);

export function prompt(text = "", defaultValue = "", title = "TeleKram", yes = "OK", no = "Cancel") {
	return prompt.v(text, defaultValue, title, yes, no);
}

prompt.v = (_text: string, _defaultValue: string, _title: string, _yes: string, _no: string): Promise<string | null> =>
	Promise.resolve(null);

type SelectItem<T> = [string, T];

export function select<T>(arr: SelectItem<T>[], selected?: T, title?: string): Promise<T | null>;
export function select<T>(arr: T[], selected?: T, title?: string): Promise<T | null>;
export function select<T>(arr: T[] | SelectItem<T>[], selected?: T, title = "Select") {
	return select.v(arr, selected, title);
}

select.v = <T,>(_arr: T[] | SelectItem<T>[], _selected?: T, _title?: string): Promise<T | null> =>
	Promise.resolve(null);

export default function Modals() {
	const [text, setText] = createSignal("");
	const [title, setTitle] = createSignal("");
	const [resolveText, setResolveText] = createSignal("");
	const [rejectText, setRejectText] = createSignal("");
	const [promptDefault, setPromptDefault] = createSignal("");
	const [selected, setSelected] = createSignal<any>(null);
	const [items, setItems] = createSignal<[string, any][]>([]);

	const [modal, setModal] = createSignal<null | Modal>(null);

	let _callback: (val: any) => void = NOOP;

	select.v = function <T>(_items: T[] | SelectItem<T>[], _selected?: T, _title?: string) {
		return new Promise((res) => {
			const normalizedItems = _items.map((item) => (Array.isArray(item) ? item : [String(item), item]) as [string, T]);

			setTitle(_title || "");

			setSelected(() => _selected);
			setItems(normalizedItems);

			setModal(Modal.Select);

			_callback = res;
		});
	};

	alert.v = function (_text, _title) {
		return new Promise((res) => {
			setText(_text);
			setTitle(_title);

			setModal(Modal.Alert);

			_callback = res;
		});
	};

	confirm.v = function (_text, _title, yes, no) {
		return new Promise((res) => {
			setText(_text);
			setTitle(_title);
			setResolveText(yes);
			setRejectText(no);

			setModal(Modal.Confirm);

			_callback = res;
		});
	};

	prompt.v = function (_text, defaultValue, _title, yes, no) {
		return new Promise((res) => {
			setText(_text);
			setTitle(_title);
			setResolveText(yes);
			setRejectText(no);
			setPromptDefault(defaultValue);

			setModal(Modal.Prompt);

			_callback = res;
		});
	};

	return (
		<Switch>
			<Match when={modal() == Modal.Select}>
				<Select
					title={title()}
					items={items()}
					selected={selected()}
					onClose={async (result) => {
						const callback = _callback;
						_callback = NOOP;

						setTitle("");
						setModal(null);

						setSelected(null);
						setItems([]);

						await sleep(10);
						callback(result);
					}}
				></Select>
			</Match>
			<Match when={modal() == Modal.Alert}>
				<Alert
					title={title()}
					text={text()}
					onClose={() => {
						const callback = _callback;
						_callback = NOOP;

						setModal(null);
						setText("");
						setTitle("");

						sleep(10).then(callback);
					}}
				></Alert>
			</Match>
			<Match when={modal() == Modal.Confirm}>
				<Confirm
					title={title()}
					text={text()}
					reject={rejectText()}
					resolve={resolveText()}
					onClose={async (result) => {
						const callback = _callback;
						_callback = NOOP;

						setModal(null);
						setText("");
						setTitle("");
						setRejectText("");
						setResolveText("");

						await sleep(10);
						callback(result);
					}}
				></Confirm>
			</Match>
			<Match when={modal() == Modal.Prompt}>
				<Prompt
					defaultValue={promptDefault()}
					title={title()}
					text={text()}
					reject={rejectText()}
					resolve={resolveText()}
					onClose={async (result) => {
						const callback = _callback;
						_callback = NOOP;

						setModal(null);
						setText("");
						setTitle("");
						setRejectText("");
						setResolveText("");
						setPromptDefault("");

						await sleep(10);
						callback(result);
					}}
				></Prompt>
			</Match>
		</Switch>
	);
}
