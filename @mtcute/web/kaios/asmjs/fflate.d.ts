/**
 * Options for decompressing a DEFLATE stream
 */
export interface InflateStreamOptions {
	/**
	 * The dictionary used to compress the original data. If no dictionary was used during compression, this option has no effect.
	 *
	 * Supplying the wrong dictionary during decompression usually yields corrupt output or causes an invalid distance error.
	 */
	dictionary?: Uint8Array;
}

/**
 * Options for compressing data into a DEFLATE format
 */
export interface DeflateOptions {
	/**
	 * The level of compression to use, ranging from 0-9.
	 *
	 * 0 will store the data without compression.
	 * 1 is fastest but compresses the worst, 9 is slowest but compresses the best.
	 * The default level is 6.
	 *
	 * Typically, binary data benefits much more from higher values than text data.
	 * In both cases, higher values usually take disproportionately longer than the reduction in final size that results.
	 *
	 * For example, a 1 MB text file could:
	 * - become 1.01 MB with level 0 in 1ms
	 * - become 400 kB with level 1 in 10ms
	 * - become 320 kB with level 9 in 100ms
	 */
	level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
	/**
	 * The memory level to use, ranging from 0-12. Increasing this increases speed and compression ratio at the cost of memory.
	 *
	 * Note that this is exponential: while level 0 uses 4 kB, level 4 uses 64 kB, level 8 uses 1 MB, and level 12 uses 16 MB.
	 * It is recommended not to lower the value below 4, since that tends to hurt performance.
	 * In addition, values above 8 tend to help very little on most data and can even hurt performance.
	 *
	 * The default value is automatically determined based on the size of the input data.
	 */
	mem?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
	/**
	 * A buffer containing common byte sequences in the input data that can be used to significantly improve compression ratios.
	 *
	 * Dictionaries should be 32kB or smaller and include strings or byte sequences likely to appear in the input.
	 * The decompressor must supply the same dictionary as the compressor to extract the original data.
	 *
	 * Dictionaries only improve aggregate compression ratio when reused across multiple small inputs. They should typically not be used otherwise.
	 *
	 * Avoid using dictionaries with GZIP and ZIP to maximize software compatibility.
	 */
	dictionary?: Uint8Array;
}

export interface GunzipOptions extends InflateStreamOptions {
	/**
	 * The buffer into which to write the decompressed data. GZIP already encodes the output size, so providing this doesn't save memory.
	 *
	 * Note that if the decompression result is larger than the size of this buffer, it will be truncated to fit.
	 */
	out?: Uint8Array;
}

/**
 * Options for compressing data into a GZIP format
 */
export interface GzipOptions extends DeflateOptions {
	/**
	 * When the file was last modified. Defaults to the current time.
	 * Set this to 0 to avoid revealing a modification date entirely.
	 */
	mtime?: Date | string | number;
	/**
	 * The filename of the data. If the `gunzip` command is used to decompress the data, it will output a file
	 * with this name instead of the name of the compressed file.
	 */
	filename?: string;
}

/**
 * Expands GZIP data
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
export declare function gunzipSync(data: Uint8Array, opts?: GunzipOptions): Uint8Array;

/**
 * Compresses data with GZIP
 * @param data The data to compress
 * @param opts The compression options
 * @returns The gzipped version of the data
 */
export declare function gzipSync(data: Uint8Array, opts?: GzipOptions): Uint8Array;
