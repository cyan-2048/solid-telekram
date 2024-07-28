import { createEffect, createSignal, onCleanup } from "solid-js";
import styles from "./Softkeys.module.scss";
import { Show } from "solid-js";
import { sleep } from "../../lib/utils.ts";
import TelegramIcon, { TelegramIconNames } from "./TelegramIcon.tsx";

type TelegramIcons = `tg:${TelegramIconNames}`;

function isTelegramIcon(str: string): str is TelegramIcons {
	return str.startsWith("tg:");
}

export default function Softkeys(props: {
	left?: TelegramIcons | string;
	center?: TelegramIcons | string;
	right?: TelegramIcons | string;
	loading?: boolean;
	black?: boolean;
}) {
	const [previous, setPrevious] = createSignal<null | string[]>(null);
	const [softkeys, setSoftkeys] = createSignal([
		props.left || "",
		props.center || "",
		props.right || "",
	]);

	createEffect(() => {
		const keys = [props.left || "", props.center || "", props.right || ""];
		setSoftkeys(keys);
		onCleanup(async () => {
			setPrevious(keys);
			await sleep(200);
			setPrevious(null);
		});
	});

	return (
		<div class={styles.softkeys}>
			<Show when={previous()}>
				<div class={styles.previous}>
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
			<div classList={{ [styles.current]: true, [styles.loading]: props.loading }}>
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
