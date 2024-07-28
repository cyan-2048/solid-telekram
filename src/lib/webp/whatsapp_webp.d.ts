export default function decodeWebP(
	buffer: ArrayBufferLike,
	scaleCount: number
): Promise<{
	width: number;
	height: number;
	rgba: ArrayBufferLike;
}>;
