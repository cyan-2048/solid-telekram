import type { Audio } from "@mtcute/core";
import MusicPlayerShared from "./MusicPlayerShared.tsx";

export default function MusicPlayerFlac(props: { music: Audio; onClose: () => void }) {
	return <MusicPlayerShared {...props} useFlacDecoder />;
}
