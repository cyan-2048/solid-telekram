import type { Audio } from "@mtcute/core";
import * as styles from "./MusicPlayer.module.scss";

// lazy load this for performance reasons
import AV from "@/lib/flac";

console.error(AV);

export default function MusicPlayerFlac(props: { music: Audio; onClose: () => void }) {
	console.error(AV);

	return <></>;
}
