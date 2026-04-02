import MiniSearch from "minisearch";
import Content from "./Content";
import Search from "./Search";

import * as styles from "./CountryCodePicker.module.scss";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import MarqueeOrNot from "./MarqueeOrNot";

import SpatialNavigation from "@/lib/spatial_navigation";
import { countries, scrollIntoView, setSoftkeys } from "@utils";
import debounce from "lodash-es/debounce";
import Header from "./Header";
import { setStatusbarColor } from "@/stores";

export type Country = {
	a: string;
	b: string;
	c: string;
	id: number;
};

function CountryItem(props: {
	$: Country;
	onSelect: (country: Country) => void;
	isLast?: () => boolean;
	loadMore?: () => void;
}) {
	const [focused, setFocused] = createSignal(false);

	return (
		<div
			on:sn-willfocus={(e) => {
				setSoftkeys("Cancel", "SELECT", "");
				setFocused(true);

				scrollIntoView(e.currentTarget);
				props.isLast?.() && props.loadMore?.();
			}}
			on:sn-enter-down={() => {
				props.onSelect(props.$);
			}}
			onBlur={() => setFocused(false)}
			tabIndex={-1}
			class={styles.country}
		>
			<div>
				<MarqueeOrNot marquee={focused()}>{props.$.b}</MarqueeOrNot>
			</div>
			<div class={styles.code}>+{props.$.a}</div>
		</div>
	);
}

const SN_ID = "country_picker";

export default function CountryCodePicker(props: { onClose: () => void; onSelect: (country: Country) => void }) {
	const [result, setResult] = createSignal([] as Country[]);
	const [inputValue, setInputValue] = createSignal("");

	const _countries = countries();

	const minisearch = new MiniSearch<Country>({
		fields: ["a", "b", "c"],
		searchOptions: {
			prefix: true,
		},
	});

	minisearch.addAllAsync(_countries);

	onMount(() => {
		SpatialNavigation.add(SN_ID, {
			selector: `.${SN_ID} input, .${SN_ID} .${styles.country}`,
			restrict: "self-only",
		});

		setStatusbarColor("#0a323f");

		SpatialNavigation.focus(SN_ID);
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
		minisearch.removeAll();
	});

	const debounced = debounce((val: string) => {
		setResult(minisearch.search(val).map(({ id }) => _countries[id]));
	}, 100);

	const [currentSlice, setCurrentSlice] = createSignal(10);

	function loadMore() {
		setCurrentSlice((a) => a + 1);
	}

	return (
		<div
			class={SN_ID}
			onKeyDown={(e) => {
				if (e.key == "Backspace" && import.meta.env.DEV) {
					if ("value" in e.target && e.target.value) {
						return;
					}
				}

				if (e.key == "SoftLeft" || e.key == "Backspace") {
					props.onClose();
					e.preventDefault();
				}
			}}
		>
			<Content before={<Header>Select a country</Header>}>
				<div style={{ "background-color": "white", height: "100%", overflow: "hidden" }}>
					<Search
						onFocus={() => {
							setSoftkeys("Cancel", "", "");
							document.activeElement!.scrollIntoView(false);
						}}
						onKeyDown={(e) => {
							if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
								e.stopImmediatePropagation();
								e.stopPropagation();
							}
						}}
						onInput={(e) => {
							const target = e.currentTarget;
							setInputValue(target.value);

							if (!target.value) {
								setResult([]);
								return;
							}

							debounced(target.value);
						}}
						placeholder="Search"
					/>
					<For
						each={result()}
						fallback={
							<Show when={inputValue().length}>
								<div class={styles.noresult}>No results found</div>
							</Show>
						}
					>
						{(country) => <CountryItem onSelect={props.onSelect} $={country} />}
					</For>
					<div
						style={{
							display: inputValue().length ? "none" : undefined,
						}}
					>
						<For each={_countries.slice(0, currentSlice())}>
							{(country, index) => (
								<CountryItem
									onSelect={props.onSelect}
									isLast={() => index() === currentSlice() - 1}
									loadMore={loadMore}
									$={country}
								/>
							)}
						</For>
					</div>
				</div>
			</Content>
		</div>
	);
}
