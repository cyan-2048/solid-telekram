import { type Photo, Thumbnail } from "@mtcute/core";
import * as styles from "./ImageViewer.module.scss";
import * as softkeyStyles from "../components/Softkeys.module.scss";
import { createSignal, createEffect, onCleanup, Show, onMount, createUniqueId, batch, createMemo } from "solid-js";
import ProgressSpinner from "@components/ProgressSpinner";
import { downloadAsync } from "./MessageMedia";
import { downloadToFile, mediaFilename, niceBytes, NOOP, setSoftkeys, sleep } from "@/utils";
import { Portal } from "solid-js/web";
import Zoom, { type ZoomRef } from "@components/zoom";
import { cloudphone, cloudphone_features } from "@/config";
import OptionsMenuMaxHeight from "../components/OptionsMenuMaxHeight";
import OptionsItem from "../components/OptionsItem";
import Options from "../components/Options";
import SpatialNavigation from "@/lib/spatial_navigation";
import { setStatusbarColor } from "@/stores";
import { Transition } from "solid-transition-group";
import TelegramIcon from "../components/TelegramIcon";

const enum State {
	Initial,
	Zooming,
}

function getBestThumbnail(photo: Photo) {
	const best = photo.getThumbnail((photo as any)._bestSize.type);
	return best;
}

function ImageFileInfo(props: { photo: Photo; onClose: () => void }) {
	let divRef!: HTMLDivElement;

	onMount(() => {
		setSoftkeys("Cancel", "", "", false, false);
		divRef.focus();
	});

	const best = createMemo(() => getBestThumbnail(props.photo));

	return (
		<div class={styles.info_view}>
			<div class={styles.header}>File info</div>
			<div
				ref={divRef}
				onKeyDown={(e) => {
					if (e.key == "Backspace" || e.key == "SoftLeft") {
						e.preventDefault();
						sleep(100).then(() => {
							props.onClose();
						});
					}
				}}
				tabIndex={0}
				class={styles.description_container}
			>
				<div class={styles.description}>
					<div class={styles.detail_title}>Name</div>
					<div class={styles.detail_description}>{mediaFilename(props.photo)}</div>
					<Show when={best()?.fileSize !== undefined}>
						<div class={styles.detail_title}>Size</div>
						<div class={styles.detail_description}>{niceBytes(best()!.fileSize!)}</div>
					</Show>
					<div class={styles.detail_title}>Image Type</div>
					{/* it's always jpeg for some reason */}
					<div class={styles.detail_description}>image/jpeg</div>
					<div class={styles.detail_title}>Date Taken</div>
					<div class={styles.detail_description}>{props.photo.date.toLocaleDateString(navigator.language)}</div>
					<Show when={best()?.height && best()?.width}>
						<div class={styles.detail_title}>Resolution</div>
						<div class={styles.detail_description}>
							{best()!.width}x{best()!.height}
						</div>
					</Show>
					<div class={styles.detail_title}>DC</div>
					<div class={styles.detail_description}>{props.photo.dcId ?? "unknown"}</div>
				</div>
			</div>
		</div>
	);
}

export default function ImageViewer(props: { photo: Photo; onClose: () => void }) {
	const [src, setSrc] = createSignal("");
	const [loading, setLoading] = createSignal(true);
	const [thumb, setThumb] = createSignal("");
	const [state, setState] = createSignal(State.Initial);

	const [showOptions, setShowOptions] = createSignal(false);
	const [showFileInfo, setShowFileInfo] = createSignal(false);

	let divRef!: HTMLDivElement;
	let zoomRef!: ZoomRef;

	const [progress, setProgress] = createSignal(0);

	const SN_ID = createUniqueId();

	onMount(() => {
		setStatusbarColor("#000");
		setSoftkeys("", "", "Options", false, true);

		divRef.focus();

		SpatialNavigation.add(SN_ID, {
			selector: "." + styles.option,
			restrict: "self-only",
		});
	});

	onCleanup(() => {
		SpatialNavigation.remove(SN_ID);
	});

	createEffect(() => {
		const media = props.photo;
		const thumb = media.getThumbnail(Thumbnail.THUMB_STRIP);

		let url!: string;

		if (thumb && "byteLength" in thumb.location) {
			setThumb((url = URL.createObjectURL(new Blob([thumb.location as Uint8Array<ArrayBuffer>]))));
		}

		onCleanup(() => {
			URL.revokeObjectURL(url);
		});
	});

	createEffect(() => {
		const media = props.photo;

		const thumb = getBestThumbnail(media)!;

		if (!thumb) {
			console.error("THUMB M IS NOT PRESENT, SKIPPING");
			return;
		}

		downloadAsync(
			thumb,
			"url",
			(url) => {
				setLoading(false);
				setSrc(url);
			},
			setProgress,
		);
	});

	// softkey state handling!!!!

	createEffect(() => {
		const isInitial = state() == State.Initial;
		const srcAvailable = src();
		const showing = showOptions();
		const showingFileInfo = showFileInfo();

		if (isInitial && !showing && !showingFileInfo) {
			setSoftkeys(srcAvailable ? "Zoom" : "", "", "Options", false, true);
		}
	});

	createEffect(() => {
		const showing = showOptions();

		if (showing) {
			setSoftkeys("", "SELECT", "", false, false);
		}
	});

	let loaded = false;
	let _onLoad_callback = NOOP;

	return (
		<>
			<div
				onKeyDown={(e) => {
					const current = state();

					if (e.key == "Backspace") {
						e.preventDefault();
						if (current == State.Initial) {
							props.onClose();
						} else {
							setState(State.Initial);
						}
					}

					if (current == State.Initial) {
						if (e.key == "SoftLeft") {
							if (src()) {
								zoomRef.reset();
								setState(State.Zooming);
							} else if (cloudphone) {
								props.onClose();
							}
						}

						if (e.key == "SoftRight") {
							setShowOptions(true);
							sleep().then(() => {
								SpatialNavigation.focus(SN_ID);
							});
						}
					}

					if (current == State.Zooming) {
						if (e.key == "SoftRight") {
							if (zoomRef.scaleValue <= 11) zoomRef.zoomIn();
						}

						if (e.key == "SoftLeft") {
							if (zoomRef.scaleValue == 1 && cloudphone) {
								setState(State.Initial);
							}
							zoomRef.zoomOut();
						}

						if (e.key.startsWith("Arrow")) {
							const offset = 50;

							const moveImage = zoomRef?.moveImage;
							if (!moveImage) return;

							switch (e.key.slice(5)) {
								case "Up":
									moveImage(0, offset);
									break;
								case "Down":
									moveImage(0, -offset);
									break;
								case "Left":
									moveImage(offset, 0);
									break;
								case "Right":
									moveImage(-offset, -0);
									break;
							}
						}
					}
				}}
				ref={divRef}
				tabIndex={0}
				classList={{ [styles.photo]: true }}
			>
				<div class={styles.container}>
					<Transition
						onExit={async (el, done) => {
							await new Promise<void>((res) => {
								if (loaded) {
									res();
									return;
								}
								_onLoad_callback = res;
							});
							_onLoad_callback = NOOP;

							const a = el.animate([{ opacity: 1 }, { opacity: 0 }], {
								duration: 200,
							});

							a.finished.then(done);
						}}
					>
						<Show when={thumb() && (loading() || !src())}>
							<div class={styles.thumb_container}>
								<img class={styles.thumb} src={thumb()}></img>
								<ProgressSpinner class={styles.spinner} size={40} progress={progress()} showClose></ProgressSpinner>
							</div>
						</Show>
					</Transition>
					<Show when={src()}>
						<img
							onLoad={async () => {
								await sleep(1000);
								loaded = true;
								_onLoad_callback();
							}}
							src={src()}
						></img>
					</Show>
				</div>
			</div>
			<Portal>
				<div
					class={styles.zoom}
					style={{
						display: state() == State.Zooming && src() ? undefined : "none",
					}}
				>
					<Zoom
						ref={(ref) => {
							zoomRef = ref;

							console.error(ref.scaleValue);
						}}
						src={src()}
					></Zoom>
					<div class={softkeyStyles.softkeys}>
						<div class={softkeyStyles.current + " " + softkeyStyles.black + " " + styles.softkeys}>
							<div>
								<TelegramIcon name="zoomout" />
							</div>
							<div></div>
							<div>
								<TelegramIcon name="zoomin" />
							</div>
						</div>
					</div>
				</div>
			</Portal>
			<Show when={showOptions()}>
				<Portal>
					<Options
						onClose={() => {
							setShowOptions(false);
							divRef.focus();
						}}
						title="Options"
					>
						<OptionsMenuMaxHeight>
							<Show when={cloudphone}>
								<OptionsItem
									on:sn-enter-down={() => {
										sleep(100).then(() => {
											props.onClose();
										});
									}}
									class={styles.option}
									tabIndex={0}
								>
									Go Back
								</OptionsItem>
							</Show>
							<Show when={src() && (!cloudphone || cloudphone_features.FileDownload)}>
								<OptionsItem
									// use on:keydown for the isTrusted event handling
									on:keydown={(e) => {
										if (e.key == "Enter") {
											const photo = props.photo;

											const fileName = mediaFilename(photo);
											downloadToFile(src(), fileName);

											console.error("HI!!!", fileName);

											setShowOptions(false);
											divRef.focus();
										}
									}}
									class={styles.option}
									tabIndex={0}
								>
									Download
								</OptionsItem>
							</Show>

							<OptionsItem
								on:sn-enter-down={() => {
									divRef.focus();

									batch(() => {
										setShowOptions(false);
										setShowFileInfo(true);
									});
								}}
								class={styles.option}
								tabIndex={0}
							>
								File info
							</OptionsItem>
						</OptionsMenuMaxHeight>
					</Options>
				</Portal>
			</Show>
			<Show when={showFileInfo()}>
				<Portal>
					<ImageFileInfo
						onClose={() => {
							divRef.focus();
							setShowFileInfo(false);
						}}
						photo={props.photo}
					></ImageFileInfo>
				</Portal>
			</Show>
		</>
	);
}
