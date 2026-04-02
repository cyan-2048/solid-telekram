export default function decodeWebP(
	buffer: Uint8Array,
	scaleCount: number
): Promise<{
	width: number;
	height: number;
	rgba: Uint8ClampedArray;
}>;
