import type { Audio } from "@mtcute/core";
import { lazy, Show } from "solid-js";
import MusicPlayerShared from "./MusicPlayerShared.tsx";
const MusicPlayerFlac = lazy(() => import("./MusicPlayerFlac"));

export default function MusicPlayer(props: { music: Audio; onClose: () => void }) {
	return (
		<Show
			when={props.music.mimeType.includes("flac") && import.meta.env.KAIOS == 2}
			fallback={<MusicPlayerShared {...props} />}
		>
			<MusicPlayerFlac {...props} />
		</Show>
	);
}
