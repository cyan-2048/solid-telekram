import { lazy } from "solid-js";

const LazyNewChat = lazy(() => import("./NewChat"));

export default LazyNewChat;
