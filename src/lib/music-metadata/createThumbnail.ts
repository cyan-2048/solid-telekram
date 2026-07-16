/**
 * Converts a Uint8Array image into a resized JPEG Blob under 200KB.
 * @param imageBytes - The raw image data.
 * @returns A promise that resolves to the optimized JPEG Blob.
 */
export async function createThumbnail(imageBytes: Uint8Array<ArrayBuffer>): Promise<Blob> {
	const MAX_DIMENSION = 320;
	const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200 KB

	// 1. Convert Uint8Array to Blob and create a temporary URL
	const initialBlob = new Blob([imageBytes]);
	const imageUrl = URL.createObjectURL(initialBlob);

	try {
		// 2. Load the image to get its dimensions
		const img = await loadImage(imageUrl);

		// 3. Calculate new dimensions while preserving aspect ratio
		let { width, height } = img;
		if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
			const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
			width = Math.round(width * ratio);
			height = Math.round(height * ratio);
		}

		// 4. Set up the hidden canvas
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");

		if (!ctx) {
			throw new Error("Failed to get canvas 2D context.");
		}

		// Fill background with white in case the original image has transparency (e.g., PNG)
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, width, height);

		// Draw the resized image onto the canvas
		ctx.drawImage(img, 0, 0, width, height);

		// 5. Extract to JPEG and compress if necessary
		let quality = 0.7;
		let resultBlob = await getCanvasBlob(canvas, quality);

		// While loop to ensure we strictly meet the 200KB limit
		while (resultBlob.size > MAX_FILE_SIZE_BYTES && quality > 0.1) {
			quality -= 0.1; // Reduce quality by 10% each iteration
			resultBlob = await getCanvasBlob(canvas, Math.max(quality, 0.1));
		}

		if (resultBlob.size > MAX_FILE_SIZE_BYTES) {
			throw new Error("Unable to compress the thumbnail below 200 KB.");
		}

		return resultBlob;
	} finally {
		// 6. Clean up memory
		URL.revokeObjectURL(imageUrl);
	}
}

// --- Helper Functions ---

/**
 * Promisifies the loading of an HTMLImageElement.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Failed to load image from Uint8Array."));
		img.src = url;
	});
}

/**
 * Promisifies the canvas.toBlob method for JPEGs.
 */
function getCanvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error("Canvas toBlob failed."));
				}
			},
			"image/jpeg",
			quality,
		);
	});
}
