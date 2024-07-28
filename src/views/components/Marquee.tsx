import styles from "./Marquee.module.scss";
import { JSXElement, createEffect, createSignal, onCleanup, untrack } from "solid-js";

function isElementOverflowing(element: HTMLElement) {
	var overflowX = element.offsetWidth < element.scrollWidth,
		overflowY = element.offsetHeight < element.scrollHeight;

	return overflowX || overflowY;
}

export default function Marquee(props: { children: JSXElement }) {
	let innerEl!: HTMLDivElement;

	const [marquee, setMarquee] = createSignal<number | false>(false);

	const [transform, setTransform] = createSignal("");
	const [time, setTime] = createSignal<undefined | string>(undefined);

	createEffect(() => {
		// side effect
		props.children;
		const element = innerEl;
		setMarquee(isElementOverflowing(element) && element.scrollWidth - element.offsetWidth);
		onCleanup(() => setMarquee(false));
	});

	createEffect(() => {
		let timeout: NodeJS.Timeout;

		const string = innerEl?.innerText ?? "e".repeat(20);
		const preciseTime = string.length / 15;
		const time = Math.ceil(preciseTime) * 1000 + 2000;

		// element.style.transform = "";
		setTransform("");
		// element.style.setProperty("--time", null);
		setTime(undefined);

		const _setTransform = () => {
			// element.style.transform = `translateX(${-marquee + "px"})`;
			setTransform(`translateX(${-untrack(marquee) + "px"})`);
			// element.style.setProperty("--time", preciseTime.toFixed(2) + "s");
			setTime(preciseTime.toFixed(2) + "s");
			timeout = setTimeout(() => {
				// element.style.transform = "";
				setTransform("");
				timeout = setTimeout(_setTransform, time);
			}, time);
		};

		if (typeof marquee() == "number") {
			timeout = setTimeout(_setTransform, 2000);
		}

		onCleanup(() => {
			clearTimeout(timeout);
		});
	});

	return (
		<div classList={{ [styles.wrap]: true, [styles.marquee]: typeof marquee() == "number" }}>
			<div
				ref={innerEl}
				style={{
					"--time": time(),
					transform: transform(),
				}}
				classList={{ [styles.marquee]: typeof marquee() == "number", [styles.inner]: true }}
			>
				{props.children}
			</div>
		</div>
	);
}
