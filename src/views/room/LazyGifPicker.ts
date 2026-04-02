import { lazy } from "solid-js";

const LazyGifPicker = lazy(() => import("./GifPicker"));

export default LazyGifPicker;
