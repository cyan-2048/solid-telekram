import Marquee from "./Marquee";
import { JSX, Show } from "solid-js";

export default function MarqueeOrNot(props: { children: JSX.Element; marquee: boolean }) {
	return (
		<Show when={props.marquee} fallback={props.children}>
			<Marquee>{props.children}</Marquee>
		</Show>
	);
}
