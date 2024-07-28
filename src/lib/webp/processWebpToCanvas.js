import decodeWebP from "./whatsapp_webp";

function convertToJpegBlob(_canvas, width, height) {
	return new Promise((resolve) => {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = 2 * height;

		const canvasCtx = canvas.getContext("2d", { willReadFrequently: !0 });
		// resize code?
		canvasCtx.drawImage(_canvas, 0, 0, width, height);
		const imgData = canvasCtx.getImageData(0, 0, width, 2 * height);
		const s = width * height * 4;

		for (let o = 0; o < s; o += 4) {
			imgData.data[s + o] = imgData.data[o + 3];
			imgData.data[s + o + 1] = imgData.data[o + 3];
			imgData.data[s + o + 2] = imgData.data[o + 3];
			imgData.data[s + o + 3] = imgData.data[o + 3];
		}

		canvasCtx.putImageData(imgData, 0, 0);
		canvas.toBlob(
			(blob) => {
				resolve(blob);
			},
			"image/jpeg",
			0.8
		);
	});
}

export default function processWebpToCanvas(canvas, bufferLike, saveToJpeg) {
	console.warn(`WebP: processing webp as device doesn't support Webp natively`);

	return decodeWebP(bufferLike, saveToJpeg ? 2 : 1).then((result) => {
		// is this a secret way of telling javascript to be performant?
		performance.now();
		canvas.width = result.width;
		canvas.height = result.height;
		const imageData = new ImageData(
			new Uint8ClampedArray(result.rgba),
			result.width,
			result.height
		);

		canvas.getContext("2d").putImageData(imageData, 0, 0);

		return saveToJpeg ? convertToJpegBlob(canvas, result.width, result.height) : null;
	});
}
