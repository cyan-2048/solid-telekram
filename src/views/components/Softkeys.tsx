import { batch, createEffect, createSignal, onCleanup } from "solid-js";
import * as styles from "./Softkeys.module.scss";
import { Show } from "solid-js";
import { setSoftkeys, sleep } from "@utils";
import TelegramIcon, { TelegramIconNames } from "./TelegramIcon.tsx";

export type TelegramIcons = `tg:${TelegramIconNames}`;

function isTelegramIcon(str: string): str is TelegramIcons {
	return str.startsWith("tg:");
}

function Softkeys__(props: {
	left?: TelegramIcons | string;
	center?: TelegramIcons | string;
	right?: TelegramIcons | string;
	loading?: boolean;
	black?: boolean;
	hidden?: boolean;
}) {
	const [previous, setPrevious] = createSignal<null | [string, string, string, boolean]>(null);
	const [softkeys, setSoftkeys] = createSignal<[string, string, string, boolean]>([
		props.left || "",
		props.center || "",
		props.right || "",
		Boolean(props.black),
	]);

	createEffect(() => {
		const keys: [string, string, string, boolean] = [
			props.left || "",
			props.center || "",
			props.right || "",
			Boolean(props.black),
		];
		setSoftkeys(keys);
		onCleanup(async () => {
			setPrevious(keys);
			await sleep(200);
			setPrevious(null);
		});
	});

	return (
		<div classList={{ [styles.softkeys]: true, [styles.hidden]: props.hidden }}>
			<Show when={previous()}>
				<div classList={{ [styles.previous]: true, [styles.black]: previous()![3] }}>
					<div>
						<Show when={isTelegramIcon(previous()![0])} fallback={previous()![0]}>
							<TelegramIcon name={previous()![0].slice(3) as TelegramIconNames} />
						</Show>
					</div>
					<div>
						<Show when={isTelegramIcon(previous()![1])} fallback={previous()![1]}>
							<TelegramIcon name={previous()![1].slice(3) as TelegramIconNames} />
						</Show>
					</div>
					<div>
						<Show when={isTelegramIcon(previous()![2])} fallback={previous()![2]}>
							<TelegramIcon name={previous()![2].slice(3) as TelegramIconNames} />
						</Show>
					</div>
				</div>
			</Show>
			<div classList={{ [styles.current]: true, [styles.loading]: props.loading, [styles.black]: softkeys()[3] }}>
				<div>
					<Show when={isTelegramIcon(softkeys()[0])} fallback={softkeys()[0]}>
						<TelegramIcon name={softkeys()[0].slice(3) as TelegramIconNames} />
					</Show>
				</div>
				<div>
					<Show when={isTelegramIcon(softkeys()[1])} fallback={softkeys()[1]}>
						<TelegramIcon name={softkeys()[1].slice(3) as TelegramIconNames} />
					</Show>
				</div>
				<div>
					<Show when={isTelegramIcon(softkeys()[2])} fallback={softkeys()[2]}>
						<TelegramIcon name={softkeys()[2].slice(3) as TelegramIconNames} />
					</Show>
				</div>
			</div>
		</div>
	);
}

// I got lazy lol
export default function Softkeys() {
	const [softleft, setSoftleft] = createSignal("");
	const [softcenter, setSoftcenter] = createSignal("");
	const [softright, setSoftright] = createSignal("");
	const [softkeysLoading, setSoftkeysLoading] = createSignal(false);
	const [softkeysBlack, setSoftkeysBlack] = createSignal(false);
	const [hidden, setHidden] = createSignal(false);

	setSoftkeys.v = function (
		left?: string | null,
		center?: string | null,
		right?: string | null,
		loading?: boolean | null,
		black?: boolean | null
	) {
		batch(() => {
			left != undefined && setSoftleft(left);
			center != undefined && setSoftcenter(center);
			right != undefined && setSoftright(right);

			loading == undefined ? setSoftkeysLoading(false) : setSoftkeysLoading(Boolean(loading));
			black == undefined ? setSoftkeysBlack(false) : setSoftkeysBlack(Boolean(black));
		});
	};

	setSoftkeys.hide = function (hide) {
		setHidden(hide);
	};

	return (
		<Softkeys__
			left={softleft()}
			center={softcenter()}
			right={softright()}
			loading={softkeysLoading()}
			black={softkeysBlack()}
			hidden={hidden()}
		/>
	);
}
