import { Chat, Peer } from "@mtcute/core";
import ChatPhotoIcon from "./ChatPhoto";

export function PeerPhotoIcon(props: { peer: Peer; showSavedIcon?: boolean }) {
	return <ChatPhotoIcon showSavedIcon={props.showSavedIcon} chat={props.peer as Chat} />;
}
