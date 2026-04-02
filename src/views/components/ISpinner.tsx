// source: https://github.com/swordray/ispinner

import * as styles from "./ISpinner.module.scss";

const spinnerBlade = styles.ispinner_blade;

function Blades() {
	return (
		<>
			<div class={spinnerBlade}></div>
			<div class={spinnerBlade}></div>
			<div class={spinnerBlade}></div>
			<div class={spinnerBlade}></div>
			<div class={spinnerBlade}></div>
			<div class={spinnerBlade}></div>
			<div class={spinnerBlade}></div>
			<div class={spinnerBlade}></div>
		</>
	);
}

export default function ISpinner(props: { large?: boolean }) {
	return (
		<div classList={{ [styles.ispinner]: true, [styles.ispinner_large]: !!props.large }}>
			<Blades />
		</div>
	);
}
