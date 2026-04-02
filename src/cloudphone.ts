// stuff that needs to be done for cloudphone specific behavior

const KeyboardEvent_key_property = Object.getOwnPropertyDescriptor(KeyboardEvent.prototype, "key")!;
Object.defineProperty(KeyboardEvent.prototype, "key", {
	enumerable: true,
	configurable: true,
	get(this: KeyboardEvent) {
		const evt_key = KeyboardEvent_key_property.get!.call(this) as string;
		if (evt_key == "Escape") {
			this.preventDefault();
			return "SoftLeft";
		}

		if (evt_key == "Call") {
			this.preventDefault();
			return "Backspace";
		}

		return evt_key;
	},
});

// simulate SoftRight
window.addEventListener("back", (e) => {
	e.preventDefault();

	document.activeElement?.dispatchEvent(
		new KeyboardEvent("keydown", {
			key: "SoftRight",
			bubbles: true,
			cancelable: true,
		})
	);
});
