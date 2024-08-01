import MiniSearch from "minisearch";
import Content from "./Content";
import Search from "./Search";
import type countries from "@/assets/country_dial_info.json";

import CountryDialInfoURL from "../../assets/country_dial_info.json?url";

import styles from "./CountryCodePicker.module.scss";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import MarqueeOrNot from "./MarqueeOrNot";
import { setSoftkeys, telegram } from "@signals";
import SpatialNavigation from "@/lib/spatial_navigation";
import { scrollIntoView, sleep } from "@/lib/utils";
import { debounce } from "lodash-es";
import Header from "./Header";

export type Country = (typeof countries)[number];

const minisearch = new MiniSearch<Country>({
	fields: ["name", "code", "dial_code"],
	searchOptions: {
		prefix: true,
	},
});

function CountryItem(props: { $: Country; onSelect: (country: Country) => void }) {
	const [focused, setFocused] = createSignal(false);

	return (
		<div
			on:sn-willfocus={(e) => {
				setSoftkeys("Cancel", "SELECT", "");
				setFocused(true);

				scrollIntoView(e.currentTarget);
			}}
			on:sn-enter-down={() => {
				props.onSelect(props.$);
			}}
			onBlur={() => setFocused(false)}
			tabIndex={-1}
			class={styles.country}
		>
			<div>
				<MarqueeOrNot marquee={focused()}>{props.$.name}</MarqueeOrNot>
			</div>
			<div class={styles.code}>{props.$.dial_code}</div>
		</div>
	);
}

const SN_ID = "country_picker";

let countriesCache = null as null | Country[];

export default function CountryCodePicker(props: {
	onClose: () => void;
	onSelect: (country: Country) => void;
}) {
	const [result, setResult] = createSignal([] as Country[]);
	const [inputValue, setInputValue] = createSignal("");
	const [countries, setCountries] = createSignal([] as Country[]);

	onMount(() => {
		if (countriesCache) {
			setCountries(countriesCache!);
		} else {
			telegram.getCountries().then(async (countries) => {
				if (countries) {
					countriesCache = countries;
					setCountries(countries);
					minisearch.addAll(countries);
				} else {
					await fetch(CountryDialInfoURL)
						.then((e) => e.json())
						.then((json) => {
							countriesCache = json;
							setCountries(json);
							minisearch.addAll(json);
						});
				}
			});
		}

		SpatialNavigation.add(SN_ID, {
			selector: `.${SN_ID} input, .${SN_ID} .${styles.country}`,
			restrict: "self-only",
		});

		SpatialNavigation.focus(SN_ID);
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
	});

	const debounced = debounce((val: string) => {
		setResult(minisearch.search(val).map(({ id }) => countries()[id]));
	}, 100);

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
				<div style={{ "background-color": "white", height: "100%" }}>
					<Search
						onFocus={async () => {
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
						<For each={countries()}>
							{(country) => <CountryItem onSelect={props.onSelect} $={country} />}
						</For>
					</div>
				</div>
			</Content>
		</div>
	);
}
