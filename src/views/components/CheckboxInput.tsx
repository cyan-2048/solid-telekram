import { ComponentProps, JSX } from "solid-js";
import RadioInput from "./RadioInput";

export default function CheckboxInput(
	props: ComponentProps<"div"> & {
		subtext?: JSX.Element;
		checked?: boolean;
	}
) {
	return <RadioInput {...props} checkbox />;
}
