import { md5 } from "../heavy-tasks";

const cache = new Map<string, Blob>();

export default async function webm2png(blob: Uint8Array) {
	const hash = await md5(blob);
	const has = cache.get(hash);

	if (has) {
		return has;
	}

	return new Promise<Blob>((resolve, reject) => {
		// @ts-ignore: KAI
		const xhr = new XMLHttpRequest({ mozSystem: true, mozAnon: true });

		const form = new FormData();
		form.set(
			"new-image",
			new File([blob], Math.floor(Math.random() * 999).toString(36) + ".webp", {
				type: "application/octet-stream",
			})
		);
		form.set(
			"new-image-url",
			// URL
			//"https://cdn.discordapp.com/emojis/859084460489965598.webp?size=240&quality=lossless"
			""
		);

		xhr.open("POST", "https://ezgif.com/video-to-apng", true);
		xhr.responseType = "document";
		xhr.onload = function () {
			if (this.readyState == XMLHttpRequest.DONE) {
				// https://ezgif.com/webp-to-png/ezgif-4-8525940e52.webp
				const redirect_location = this.responseURL;
				// console.log(redirect_location);

				// cancel the request
				// this.abort();

				// @ts-ignore: KAI
				const _xhr = new XMLHttpRequest({ mozSystem: true, mozAnon: true });
				const file_name = redirect_location.split("/").at(-1) as string;

				const form2 = new FormData();

				form2.set("file", file_name);
				form2.set("size", "128");
				form2.set("fps", "20");
				form2.set("method", "ffmpeg");
				form2.set("start", "0");
				form2.set(
					"end",
					(xhr.response as Document)
						.querySelector<HTMLInputElement>("input#end")!
						.getAttribute("value")!
				);

				form2.set("ajax", "true");

				_xhr.onreadystatechange = null;

				_xhr.open("POST", redirect_location + "?ajax=true", true);
				_xhr.responseType = "document";

				_xhr.onload = function () {
					if (this.status === 200) {
						const src = (this.response as Document).querySelector("img")?.src;
						if (!src) {
							reject(new Error("Image not found"));
							return;
						}

						// @ts-ignore: KAI
						const xhr = new XMLHttpRequest({ mozSystem: true, mozAnon: true });
						xhr.open("GET", src, true);
						xhr.responseType = "blob";

						xhr.onload = function () {
							if (this.status === 200) {
								const blob = this.response;

								cache.set(hash, blob);

								resolve(blob);
							}
						};
						xhr.send();
					} else {
						reject(new Error(this.statusText));
					}
				};
				_xhr.send(form2);
			}
		};

		xhr.send(form);
	});
}
