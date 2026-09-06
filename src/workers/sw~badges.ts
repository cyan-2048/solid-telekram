// NOTE (maybe todo fix?): on devices with outer displays the image look very low quality
// on the main screen the image will always be loaded <32px
// while on the outer screen it is loaded at 52px

const SVG_IMAGE =
	'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><foreignObject xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><div style="background-image: url(&quot;data:image/png;base64,REPLACE_WITH_ICON&quot;);height: 32px;position: relative;width: 32px;background-position: center;background-size: contain;" xmlns="http://www.w3.org/1999/xhtml"><div style="position: absolute;right: 1px;top: 0;background-color: white;box-shadow: 0 1px 2px rgba(68, 68, 68, 0.8), 0 1px rgba(255, 255, 255, 0.3) inset;border-radius: 10px;height: 14px;min-width: 14px;box-sizing: border-box;"><div xmlns="http://www.w3.org/1999/xhtml" style="height: 12px;background-color: #ce0408;background-image: linear-gradient(#fc5659, #ce0408);color: white;text-shadow: 0px 0px 2px #8d343b;min-width: 12px;line-height: 12px;border-radius: 10px;margin: 1px;padding: 0 3px;font-family: Roboto;box-sizing: border-box;display: block;font-size: 9px;font-weight: bold;text-align: center;-webkit-text-fill-color: white;" color="white">REPLACE_WITH_BADGE</div></div></div></foreignObject></svg>';

let cachedIconBase64: Promise<string> | null = null;

function getIconBase64(): Promise<string> {
	if (!cachedIconBase64) {
		cachedIconBase64 = fetch("/icon56.png")
			.then((res) => res.arrayBuffer())
			.then((buffer) => {
				const bytes = new Uint8Array(buffer);
				let binary = "";
				for (let i = 0; i < bytes.length; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				return btoa(binary);
			});
	}
	return cachedIconBase64;
}

export async function generateIcon(badge: string) {
	const iconBase64 = await getIconBase64();

	const svg = SVG_IMAGE.replace("REPLACE_WITH_ICON", iconBase64).replace("REPLACE_WITH_BADGE", badge);
	const svg64 = encodeURIComponent(svg);
	const b64Start = "data:image/svg+xml;charset=utf-8,";
	return b64Start + svg64;
}
