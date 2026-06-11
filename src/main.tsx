import { render } from "solid-js/web";

import "./lib/scrollBy.js";

import App from "./App.tsx";
import { cloudphone } from "./config.ts";

// if (import.meta.env.DEV)
import("./dev.ts");

if (import.meta.env.CLOUDPHONE) {
	if (cloudphone) import("./cloudphone.ts");
}

render(() => <App />, document.getElementById("root")!);

import "./workers/pushNotifications.ts";

// #region Integrity Check
// export const integrityCheck = import("./lib/checkIntegrity").then((m) =>
//   m.default(import.meta.url),
// );

// integrityCheck.then((integrity) => {
//   console.log("INTEGRITY CHECK PASSED:", integrity);
//   if (!integrity) {
//     alert(
//       "The app failed its integrity check, this means the app could have been modified maliciously, please don't use it.",
//     );
//   }
// });

// we request cpu wakelock because yes
if ("requestWakeLock" in navigator && typeof navigator.requestWakeLock == "function") {
	navigator.requestWakeLock("cpu");
}

// #endregion
