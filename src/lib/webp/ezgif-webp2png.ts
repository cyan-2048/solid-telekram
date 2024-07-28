import { md5 } from "../heavy-tasks";

const cache = new Map<string, Blob>();

export default async function webp2png(blob: Uint8Array) {
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

		xhr.open("POST", "https://ezgif.com/webp-to-png", true);
		xhr.onload = function () {
			if (this.readyState == XMLHttpRequest.DONE) {
				// https://ezgif.com/webp-to-png/ezgif-4-8525940e52.webp
				const redirect_location = this.responseURL;
				// console.log(redirect_location);

				// cancel the request
				// this.abort();

				// @ts-ignore: KAI
				const xhr = new XMLHttpRequest({ mozSystem: true, mozAnon: true });
				const file_name = redirect_location.split("/").at(-1) as string;

				const form2 = new FormData();

				form2.set("file", file_name);
				form2.set("ajax", "true");

				xhr.onreadystatechange = null;

				xhr.open("POST", redirect_location + "?ajax=true", true);
				xhr.responseType = "document";

				xhr.onload = function () {
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
				xhr.send(form2);
			}
		};

		xhr.send(form);
	});
}
