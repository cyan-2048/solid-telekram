import { type JSXElement, onMount } from "solid-js";

export default function WhenMounted(props: { children: JSXElement; onMount: () => void }) {
	onMount(() => {
		props.onMount();
	});

	return <>{props.children}</>;
}
