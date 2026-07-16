const defaultMessages = 'End-Of-Stream';
/**
 * Thrown on read operation of the end of file or stream has been reached
 */
class EndOfStreamError extends Error {
    constructor() {
        super(defaultMessages);
        this.name = "EndOfStreamError";
    }
}
class AbortError extends Error {
    constructor(message = "The operation was aborted") {
        super(message);
        this.name = "AbortError";
    }
}

class AbstractStreamReader {
    constructor() {
        this.endOfStream = false;
        this.interrupted = false;
        /**
         * Store peeked data
         * @type {Array}
         */
        this.peekQueue = [];
    }
    async peek(uint8Array, mayBeLess = false) {
        const bytesRead = await this.read(uint8Array, mayBeLess);
        this.peekQueue.push(uint8Array.subarray(0, bytesRead)); // Put read data back to peek buffer
        return bytesRead;
    }
    async read(buffer, mayBeLess = false) {
        if (buffer.length === 0) {
            return 0;
        }
        let bytesRead = this.readFromPeekBuffer(buffer);
        if (!this.endOfStream) {
            bytesRead += await this.readRemainderFromStream(buffer.subarray(bytesRead), mayBeLess);
        }
        if (bytesRead === 0 && !mayBeLess) {
            throw new EndOfStreamError();
        }
        return bytesRead;
    }
    /**
     * Read chunk from stream
     * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
     * @returns Number of bytes read
     */
    readFromPeekBuffer(buffer) {
        let remaining = buffer.length;
        let bytesRead = 0;
        // consume peeked data first
        while (this.peekQueue.length > 0 && remaining > 0) {
            const peekData = this.peekQueue.pop(); // Front of queue
            if (!peekData)
                throw new Error('peekData should be defined');
            const lenCopy = Math.min(peekData.length, remaining);
            buffer.set(peekData.subarray(0, lenCopy), bytesRead);
            bytesRead += lenCopy;
            remaining -= lenCopy;
            if (lenCopy < peekData.length) {
                // remainder back to queue
                this.peekQueue.push(peekData.subarray(lenCopy));
            }
        }
        return bytesRead;
    }
    async readRemainderFromStream(buffer, mayBeLess) {
        let bytesRead = 0;
        // Continue reading from stream if required
        while (bytesRead < buffer.length && !this.endOfStream) {
            if (this.interrupted) {
                throw new AbortError();
            }
            const chunkLen = await this.readFromStream(buffer.subarray(bytesRead), mayBeLess);
            if (chunkLen === 0)
                break;
            bytesRead += chunkLen;
        }
        if (!mayBeLess && bytesRead < buffer.length) {
            throw new EndOfStreamError();
        }
        return bytesRead;
    }
}

class WebStreamReader extends AbstractStreamReader {
    constructor(reader) {
        super();
        this.reader = reader;
    }
    async abort() {
        return this.close();
    }
    async close() {
        this.reader.releaseLock();
    }
}

/**
 * Read from a WebStream using a BYOB reader
 * Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
 */
class WebStreamByobReader extends WebStreamReader {
    /**
     * Read from stream
     * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
     * @param mayBeLess - If true, may fill the buffer partially
     * @protected Bytes read
     */
    async readFromStream(buffer, mayBeLess) {
        if (buffer.length === 0)
            return 0;
        // @ts-expect-error
        const result = await this.reader.read(new Uint8Array(buffer.length), { min: mayBeLess ? undefined : buffer.length });
        if (result.done) {
            this.endOfStream = result.done;
        }
        if (result.value) {
            buffer.set(result.value);
            return result.value.length;
        }
        return 0;
    }
}

class WebStreamDefaultReader extends AbstractStreamReader {
    constructor(reader) {
        super();
        this.reader = reader;
        this.buffer = null; // Internal buffer to store excess data
    }
    /**
     * Copy chunk to target, and store the remainder in this.buffer
     */
    writeChunk(target, chunk) {
        const written = Math.min(chunk.length, target.length);
        target.set(chunk.subarray(0, written));
        // Adjust the remainder of the buffer
        if (written < chunk.length) {
            this.buffer = chunk.subarray(written);
        }
        else {
            this.buffer = null;
        }
        return written;
    }
    /**
     * Read from stream
     * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
     * @param mayBeLess - If true, may fill the buffer partially
     * @protected Bytes read
     */
    async readFromStream(buffer, mayBeLess) {
        if (buffer.length === 0)
            return 0;
        let totalBytesRead = 0;
        // Serve from the internal buffer first
        if (this.buffer) {
            totalBytesRead += this.writeChunk(buffer, this.buffer);
        }
        // Continue reading from the stream if more data is needed
        while (totalBytesRead < buffer.length && !this.endOfStream) {
            const result = await this.reader.read();
            if (result.done) {
                this.endOfStream = true;
                break;
            }
            if (result.value) {
                totalBytesRead += this.writeChunk(buffer.subarray(totalBytesRead), result.value);
            }
        }
        if (!mayBeLess && totalBytesRead === 0 && this.endOfStream) {
            throw new EndOfStreamError();
        }
        return totalBytesRead;
    }
    abort() {
        this.interrupted = true;
        return this.reader.cancel();
    }
    async close() {
        await this.abort();
        this.reader.releaseLock();
    }
}

function makeWebStreamReader(stream) {
    try {
        const reader = stream.getReader({ mode: "byob" });
        if (reader instanceof ReadableStreamDefaultReader) {
            // Fallback to default reader in case `mode: byob` is ignored
            return new WebStreamDefaultReader(reader);
        }
        return new WebStreamByobReader(reader);
    }
    catch (error) {
        if (error instanceof TypeError) {
            // Fallback to default reader in case `mode: byob` rejected by a `TypeError`
            return new WebStreamDefaultReader(stream.getReader());
        }
        throw error;
    }
}

/**
 * Core tokenizer
 */
class AbstractTokenizer {
    /**
     * Constructor
     * @param options Tokenizer options
     * @protected
     */
    constructor(options) {
        this.numBuffer = new Uint8Array(8);
        /**
         * Tokenizer-stream position
         */
        this.position = 0;
        this.onClose = options?.onClose;
        if (options?.abortSignal) {
            options.abortSignal.addEventListener('abort', () => {
                this.abort();
            });
        }
    }
    /**
     * Read a token from the tokenizer-stream
     * @param token - The token to read
     * @param position - If provided, the desired position in the tokenizer-stream
     * @returns Promise with token data
     */
    async readToken(token, position = this.position) {
        const uint8Array = new Uint8Array(token.len);
        const len = await this.readBuffer(uint8Array, { position });
        if (len < token.len)
            throw new EndOfStreamError();
        return token.get(uint8Array, 0);
    }
    /**
     * Peek a token from the tokenizer-stream.
     * @param token - Token to peek from the tokenizer-stream.
     * @param position - Offset where to begin reading within the file. If position is null, data will be read from the current file position.
     * @returns Promise with token data
     */
    async peekToken(token, position = this.position) {
        const uint8Array = new Uint8Array(token.len);
        const len = await this.peekBuffer(uint8Array, { position });
        if (len < token.len)
            throw new EndOfStreamError();
        return token.get(uint8Array, 0);
    }
    /**
     * Read a numeric token from the stream
     * @param token - Numeric token
     * @returns Promise with number
     */
    async readNumber(token) {
        const len = await this.readBuffer(this.numBuffer, { length: token.len });
        if (len < token.len)
            throw new EndOfStreamError();
        return token.get(this.numBuffer, 0);
    }
    /**
     * Read a numeric token from the stream
     * @param token - Numeric token
     * @returns Promise with number
     */
    async peekNumber(token) {
        const len = await this.peekBuffer(this.numBuffer, { length: token.len });
        if (len < token.len)
            throw new EndOfStreamError();
        return token.get(this.numBuffer, 0);
    }
    /**
     * Ignore number of bytes, advances the pointer in under tokenizer-stream.
     * @param length - Number of bytes to ignore.  Must be ≥ 0.
     * @return resolves the number of bytes ignored, equals length if this available, otherwise the number of bytes available
     */
    async ignore(length) {
        if (length < 0) {
            throw new RangeError('ignore length must be ≥ 0 bytes');
        }
        if (this.fileInfo.size !== undefined) {
            const bytesLeft = this.fileInfo.size - this.position;
            if (length > bytesLeft) {
                this.position += bytesLeft;
                return bytesLeft;
            }
        }
        this.position += length;
        return length;
    }
    async close() {
        await this.abort();
        await this.onClose?.();
    }
    normalizeOptions(uint8Array, options) {
        if (!this.supportsRandomAccess() && options && options.position !== undefined && options.position < this.position) {
            throw new Error('`options.position` must be equal or greater than `tokenizer.position`');
        }
        return {
            ...{
                mayBeLess: false,
                offset: 0,
                length: uint8Array.length,
                position: this.position
            }, ...options
        };
    }
    abort() {
        return Promise.resolve(); // Ignore abort signal
    }
}

const maxBufferSize = 256000;
class ReadStreamTokenizer extends AbstractTokenizer {
    /**
     * Constructor
     * @param streamReader stream-reader to read from
     * @param options Tokenizer options
     */
    constructor(streamReader, options) {
        super(options);
        this.streamReader = streamReader;
        this.fileInfo = options?.fileInfo ?? {};
    }
    /**
     * Read buffer from tokenizer
     * @param uint8Array - Target Uint8Array to fill with data read from the tokenizer-stream
     * @param options - Read behaviour options
     * @returns Promise with number of bytes read
     */
    async readBuffer(uint8Array, options) {
        const normOptions = this.normalizeOptions(uint8Array, options);
        const skipBytes = normOptions.position - this.position;
        if (skipBytes > 0) {
            await this.ignore(skipBytes);
            return this.readBuffer(uint8Array, options);
        }
        if (skipBytes < 0) {
            throw new Error('`options.position` must be equal or greater than `tokenizer.position`');
        }
        if (normOptions.length === 0) {
            return 0;
        }
        const bytesRead = await this.streamReader.read(uint8Array.subarray(0, normOptions.length), normOptions.mayBeLess);
        this.position += bytesRead;
        if ((!options || !options.mayBeLess) && bytesRead < normOptions.length) {
            throw new EndOfStreamError();
        }
        return bytesRead;
    }
    /**
     * Peek (read ahead) buffer from tokenizer
     * @param uint8Array - Uint8Array (or Buffer) to write data to
     * @param options - Read behaviour options
     * @returns Promise with number of bytes peeked
     */
    async peekBuffer(uint8Array, options) {
        const normOptions = this.normalizeOptions(uint8Array, options);
        let bytesRead = 0;
        if (normOptions.position) {
            const skipBytes = normOptions.position - this.position;
            if (skipBytes > 0) {
                const skipBuffer = new Uint8Array(normOptions.length + skipBytes);
                bytesRead = await this.peekBuffer(skipBuffer, { mayBeLess: normOptions.mayBeLess });
                uint8Array.set(skipBuffer.subarray(skipBytes));
                return bytesRead - skipBytes;
            }
            if (skipBytes < 0) {
                throw new Error('Cannot peek from a negative offset in a stream');
            }
        }
        if (normOptions.length > 0) {
            try {
                bytesRead = await this.streamReader.peek(uint8Array.subarray(0, normOptions.length), normOptions.mayBeLess);
            }
            catch (err) {
                if (options?.mayBeLess && err instanceof EndOfStreamError) {
                    return 0;
                }
                throw err;
            }
            if ((!normOptions.mayBeLess) && bytesRead < normOptions.length) {
                throw new EndOfStreamError();
            }
        }
        return bytesRead;
    }
    /**
     * @param length Number of bytes to ignore. Must be ≥ 0.
     */
    async ignore(length) {
        if (length < 0) {
            throw new RangeError('ignore length must be ≥ 0 bytes');
        }
        const bufSize = Math.min(maxBufferSize, length);
        const buf = new Uint8Array(bufSize);
        let totBytesRead = 0;
        while (totBytesRead < length) {
            const remaining = length - totBytesRead;
            const bytesRead = await this.readBuffer(buf, { length: Math.min(bufSize, remaining) });
            if (bytesRead < 0) {
                return bytesRead;
            }
            totBytesRead += bytesRead;
        }
        return totBytesRead;
    }
    abort() {
        return this.streamReader.abort();
    }
    async close() {
        return this.streamReader.close();
    }
    supportsRandomAccess() {
        return false;
    }
}

class BufferTokenizer extends AbstractTokenizer {
    /**
     * Construct BufferTokenizer
     * @param uint8Array - Uint8Array to tokenize
     * @param options Tokenizer options
     */
    constructor(uint8Array, options) {
        super(options);
        this.uint8Array = uint8Array;
        this.fileInfo = { ...options?.fileInfo ?? {}, ...{ size: uint8Array.length } };
    }
    /**
     * Read buffer from tokenizer
     * @param uint8Array - Uint8Array to tokenize
     * @param options - Read behaviour options
     * @returns {Promise<number>}
     */
    async readBuffer(uint8Array, options) {
        if (options?.position) {
            this.position = options.position;
        }
        const bytesRead = await this.peekBuffer(uint8Array, options);
        this.position += bytesRead;
        return bytesRead;
    }
    /**
     * Peek (read ahead) buffer from tokenizer
     * @param uint8Array
     * @param options - Read behaviour options
     * @returns {Promise<number>}
     */
    async peekBuffer(uint8Array, options) {
        const normOptions = this.normalizeOptions(uint8Array, options);
        const bytes2read = Math.min(this.uint8Array.length - normOptions.position, normOptions.length);
        if ((!normOptions.mayBeLess) && bytes2read < normOptions.length) {
            throw new EndOfStreamError();
        }
        uint8Array.set(this.uint8Array.subarray(normOptions.position, normOptions.position + bytes2read));
        return bytes2read;
    }
    close() {
        return super.close();
    }
    supportsRandomAccess() {
        return true;
    }
    setPosition(position) {
        this.position = position;
    }
}

class BlobTokenizer extends AbstractTokenizer {
    /**
     * Construct BufferTokenizer
     * @param blob - Uint8Array to tokenize
     * @param options Tokenizer options
     */
    constructor(blob, options) {
        super(options);
        this.blob = blob;
        this.fileInfo = { ...options?.fileInfo ?? {}, ...{ size: blob.size, mimeType: blob.type } };
    }
    /**
     * Read buffer from tokenizer
     * @param uint8Array - Uint8Array to tokenize
     * @param options - Read behaviour options
     * @returns {Promise<number>}
     */
    async readBuffer(uint8Array, options) {
        if (options?.position) {
            this.position = options.position;
        }
        const bytesRead = await this.peekBuffer(uint8Array, options);
        this.position += bytesRead;
        return bytesRead;
    }
    /**
     * Peek (read ahead) buffer from tokenizer
     * @param buffer
     * @param options - Read behaviour options
     * @returns {Promise<number>}
     */
    async peekBuffer(buffer, options) {
        const normOptions = this.normalizeOptions(buffer, options);
        const bytes2read = Math.min(this.blob.size - normOptions.position, normOptions.length);
        if ((!normOptions.mayBeLess) && bytes2read < normOptions.length) {
            throw new EndOfStreamError();
        }
        const arrayBuffer = await this.blob.slice(normOptions.position, normOptions.position + bytes2read).arrayBuffer();
        buffer.set(new Uint8Array(arrayBuffer));
        return bytes2read;
    }
    close() {
        return super.close();
    }
    supportsRandomAccess() {
        return true;
    }
    setPosition(position) {
        this.position = position;
    }
}

/**
 * Construct ReadStreamTokenizer from given ReadableStream (WebStream API).
 * Will set fileSize, if provided given Stream has set the .path property/
 * @param webStream - Read from Node.js Stream.Readable (must be a byte stream)
 * @param options - Tokenizer options
 * @returns ReadStreamTokenizer
 */
function fromWebStream(webStream, options) {
    const webStreamReader = makeWebStreamReader(webStream);
    const _options = options ?? {};
    const chainedClose = _options.onClose;
    _options.onClose = async () => {
        await webStreamReader.close();
        if (chainedClose) {
            return chainedClose();
        }
    };
    return new ReadStreamTokenizer(webStreamReader, _options);
}
/**
 * Construct ReadStreamTokenizer from given Buffer.
 * @param uint8Array - Uint8Array to tokenize
 * @param options - Tokenizer options
 * @returns BufferTokenizer
 */
function fromBuffer(uint8Array, options) {
    return new BufferTokenizer(uint8Array, options);
}
/**
 * Construct ReadStreamTokenizer from given Blob.
 * @param blob - Uint8Array to tokenize
 * @param options - Tokenizer options
 * @returns BufferTokenizer
 */
function fromBlob(blob, options) {
    return new BlobTokenizer(blob, options);
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var ieee754 = {};

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */

var hasRequiredIeee754;

function requireIeee754 () {
	if (hasRequiredIeee754) return ieee754;
	hasRequiredIeee754 = 1;
	ieee754.read = function (buffer, offset, isLE, mLen, nBytes) {
	  var e, m;
	  var eLen = (nBytes * 8) - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var nBits = -7;
	  var i = isLE ? (nBytes - 1) : 0;
	  var d = isLE ? -1 : 1;
	  var s = buffer[offset + i];

	  i += d;

	  e = s & ((1 << (-nBits)) - 1);
	  s >>= (-nBits);
	  nBits += eLen;
	  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

	  m = e & ((1 << (-nBits)) - 1);
	  e >>= (-nBits);
	  nBits += mLen;
	  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

	  if (e === 0) {
	    e = 1 - eBias;
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity)
	  } else {
	    m = m + Math.pow(2, mLen);
	    e = e - eBias;
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
	};

	ieee754.write = function (buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c;
	  var eLen = (nBytes * 8) - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
	  var i = isLE ? 0 : (nBytes - 1);
	  var d = isLE ? 1 : -1;
	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

	  value = Math.abs(value);

	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0;
	    e = eMax;
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2);
	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--;
	      c *= 2;
	    }
	    if (e + eBias >= 1) {
	      value += rt / c;
	    } else {
	      value += rt * Math.pow(2, 1 - eBias);
	    }
	    if (value * c >= 2) {
	      e++;
	      c /= 2;
	    }

	    if (e + eBias >= eMax) {
	      m = 0;
	      e = eMax;
	    } else if (e + eBias >= 1) {
	      m = ((value * c) - 1) * Math.pow(2, mLen);
	      e = e + eBias;
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
	      e = 0;
	    }
	  }

	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

	  e = (e << mLen) | m;
	  eLen += mLen;
	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

	  buffer[offset + i - d] |= s * 128;
	};
	return ieee754;
}

var ieee754Exports = requireIeee754();

const WINDOWS_1252_EXTRA = {
    0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†",
    0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ",
    0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•",
    0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›",
    0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};
const WINDOWS_1252_REVERSE = {};
for (const [code, char] of Object.entries(WINDOWS_1252_EXTRA)) {
    WINDOWS_1252_REVERSE[char] = Number.parseInt(code, 10);
}
let _utf8Decoder;
let _utf8Encoder;
function utf8Decoder() {
    if (typeof globalThis.TextDecoder === "undefined")
        return undefined;
    return (_utf8Decoder !== null && _utf8Decoder !== void 0 ? _utf8Decoder : (_utf8Decoder = new globalThis.TextDecoder("utf-8")));
}
function utf8Encoder() {
    if (typeof globalThis.TextEncoder === "undefined")
        return undefined;
    return (_utf8Encoder !== null && _utf8Encoder !== void 0 ? _utf8Encoder : (_utf8Encoder = new globalThis.TextEncoder()));
}
const CHUNK = 32 * 1024;
const REPLACEMENT = 0xfffd;
/**
 * Decode text from binary data
 */
function textDecode(bytes, encoding = "utf-8") {
    switch (encoding.toLowerCase()) {
        case "utf-8":
        case "utf8": {
            const dec = utf8Decoder();
            return dec ? dec.decode(bytes) : decodeUTF8(bytes);
        }
        case "utf-16le":
            return decodeUTF16LE(bytes);
        case "us-ascii":
        case "ascii":
            return decodeASCII(bytes);
        case "latin1":
        case "iso-8859-1":
            return decodeLatin1(bytes);
        case "windows-1252":
            return decodeWindows1252(bytes);
        default:
            throw new RangeError(`Encoding '${encoding}' not supported`);
    }
}
function textEncode(input = "", encoding = "utf-8") {
    switch (encoding.toLowerCase()) {
        case "utf-8":
        case "utf8": {
            const enc = utf8Encoder();
            return enc ? enc.encode(input) : encodeUTF8(input);
        }
        case "utf-16le":
            return encodeUTF16LE(input);
        case "us-ascii":
        case "ascii":
            return encodeASCII(input);
        case "latin1":
        case "iso-8859-1":
            return encodeLatin1(input);
        case "windows-1252":
            return encodeWindows1252(input);
        default:
            throw new RangeError(`Encoding '${encoding}' not supported`);
    }
}
function flushChunk(parts, chunk) {
    if (chunk.length === 0)
        return;
    parts.push(String.fromCharCode.apply(null, chunk));
    chunk.length = 0;
}
function pushCodeUnit(parts, chunk, codeUnit) {
    chunk.push(codeUnit);
    if (chunk.length >= CHUNK)
        flushChunk(parts, chunk);
}
function pushCodePoint(parts, chunk, cp) {
    if (cp <= 0xffff) {
        pushCodeUnit(parts, chunk, cp);
        return;
    }
    cp -= 0x10000;
    pushCodeUnit(parts, chunk, 0xd800 + (cp >> 10));
    pushCodeUnit(parts, chunk, 0xdc00 + (cp & 0x3ff));
}
function decodeUTF8(bytes) {
    const parts = [];
    const chunk = [];
    let i = 0;
    // Match TextDecoder("utf-8") default BOM handling
    if (bytes.length >= 3 &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf) {
        i = 3;
    }
    while (i < bytes.length) {
        const b1 = bytes[i];
        if (b1 <= 0x7f) {
            pushCodeUnit(parts, chunk, b1);
            i++;
            continue;
        }
        // Invalid leading bytes: continuation byte or impossible prefixes
        if (b1 < 0xc2 || b1 > 0xf4) {
            pushCodeUnit(parts, chunk, REPLACEMENT);
            i++;
            continue;
        }
        // 2-byte sequence
        if (b1 <= 0xdf) {
            if (i + 1 >= bytes.length) {
                pushCodeUnit(parts, chunk, REPLACEMENT);
                i++;
                continue;
            }
            const b2 = bytes[i + 1];
            if ((b2 & 0xc0) !== 0x80) {
                pushCodeUnit(parts, chunk, REPLACEMENT);
                i++;
                continue;
            }
            const cp = ((b1 & 0x1f) << 6) | (b2 & 0x3f);
            pushCodeUnit(parts, chunk, cp);
            i += 2;
            continue;
        }
        // 3-byte sequence
        if (b1 <= 0xef) {
            if (i + 2 >= bytes.length) {
                pushCodeUnit(parts, chunk, REPLACEMENT);
                i++;
                continue;
            }
            const b2 = bytes[i + 1];
            const b3 = bytes[i + 2];
            const valid = (b2 & 0xc0) === 0x80 &&
                (b3 & 0xc0) === 0x80 &&
                !(b1 === 0xe0 && b2 < 0xa0) && // overlong
                !(b1 === 0xed && b2 >= 0xa0); // surrogate range
            if (!valid) {
                pushCodeUnit(parts, chunk, REPLACEMENT);
                i++;
                continue;
            }
            const cp = ((b1 & 0x0f) << 12) |
                ((b2 & 0x3f) << 6) |
                (b3 & 0x3f);
            pushCodeUnit(parts, chunk, cp);
            i += 3;
            continue;
        }
        // 4-byte sequence
        if (i + 3 >= bytes.length) {
            pushCodeUnit(parts, chunk, REPLACEMENT);
            i++;
            continue;
        }
        const b2 = bytes[i + 1];
        const b3 = bytes[i + 2];
        const b4 = bytes[i + 3];
        const valid = (b2 & 0xc0) === 0x80 &&
            (b3 & 0xc0) === 0x80 &&
            (b4 & 0xc0) === 0x80 &&
            !(b1 === 0xf0 && b2 < 0x90) && // overlong
            !(b1 === 0xf4 && b2 > 0x8f); // > U+10FFFF
        if (!valid) {
            pushCodeUnit(parts, chunk, REPLACEMENT);
            i++;
            continue;
        }
        const cp = ((b1 & 0x07) << 18) |
            ((b2 & 0x3f) << 12) |
            ((b3 & 0x3f) << 6) |
            (b4 & 0x3f);
        pushCodePoint(parts, chunk, cp);
        i += 4;
    }
    flushChunk(parts, chunk);
    return parts.join("");
}
function decodeUTF16LE(bytes) {
    const parts = [];
    const chunk = [];
    const len = bytes.length;
    let i = 0;
    while (i + 1 < len) {
        const u1 = bytes[i] | (bytes[i + 1] << 8);
        i += 2;
        // High surrogate
        if (u1 >= 0xd800 && u1 <= 0xdbff) {
            if (i + 1 < len) {
                const u2 = bytes[i] | (bytes[i + 1] << 8);
                if (u2 >= 0xdc00 && u2 <= 0xdfff) {
                    pushCodeUnit(parts, chunk, u1);
                    pushCodeUnit(parts, chunk, u2);
                    i += 2;
                }
                else {
                    pushCodeUnit(parts, chunk, REPLACEMENT);
                }
            }
            else {
                pushCodeUnit(parts, chunk, REPLACEMENT);
            }
            continue;
        }
        // Lone low surrogate
        if (u1 >= 0xdc00 && u1 <= 0xdfff) {
            pushCodeUnit(parts, chunk, REPLACEMENT);
            continue;
        }
        pushCodeUnit(parts, chunk, u1);
    }
    // Odd trailing byte
    if (i < len) {
        pushCodeUnit(parts, chunk, REPLACEMENT);
    }
    flushChunk(parts, chunk);
    return parts.join("");
}
function decodeASCII(bytes) {
    const parts = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
        const end = Math.min(bytes.length, i + CHUNK);
        const codes = new Array(end - i);
        for (let j = i, k = 0; j < end; j++, k++) {
            codes[k] = bytes[j] & 0x7f;
        }
        parts.push(String.fromCharCode.apply(null, codes));
    }
    return parts.join("");
}
function decodeLatin1(bytes) {
    const parts = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
        const end = Math.min(bytes.length, i + CHUNK);
        const codes = new Array(end - i);
        for (let j = i, k = 0; j < end; j++, k++) {
            codes[k] = bytes[j];
        }
        parts.push(String.fromCharCode.apply(null, codes));
    }
    return parts.join("");
}
function decodeWindows1252(bytes) {
    const parts = [];
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        const extra = b >= 0x80 && b <= 0x9f ? WINDOWS_1252_EXTRA[b] : undefined;
        out += extra !== null && extra !== void 0 ? extra : String.fromCharCode(b);
        if (out.length >= CHUNK) {
            parts.push(out);
            out = "";
        }
    }
    if (out)
        parts.push(out);
    return parts.join("");
}
function encodeUTF8(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let cp = str.charCodeAt(i);
        // Valid surrogate pair
        if (cp >= 0xd800 && cp <= 0xdbff) {
            if (i + 1 < str.length) {
                const lo = str.charCodeAt(i + 1);
                if (lo >= 0xdc00 && lo <= 0xdfff) {
                    cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
                    i++;
                }
                else {
                    cp = REPLACEMENT;
                }
            }
            else {
                cp = REPLACEMENT;
            }
        }
        else if (cp >= 0xdc00 && cp <= 0xdfff) {
            // Lone low surrogate
            cp = REPLACEMENT;
        }
        if (cp < 0x80) {
            out.push(cp);
        }
        else if (cp < 0x800) {
            out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
        }
        else if (cp < 0x10000) {
            out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        }
        else {
            out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        }
    }
    return new Uint8Array(out);
}
function encodeUTF16LE(str) {
    // Preserve JS string code units, but do not emit non-well-formed UTF-16.
    // Replace lone surrogates with U+FFFD.
    const units = [];
    for (let i = 0; i < str.length; i++) {
        const u = str.charCodeAt(i);
        if (u >= 0xd800 && u <= 0xdbff) {
            if (i + 1 < str.length) {
                const lo = str.charCodeAt(i + 1);
                if (lo >= 0xdc00 && lo <= 0xdfff) {
                    units.push(u, lo);
                    i++;
                }
                else {
                    units.push(REPLACEMENT);
                }
            }
            else {
                units.push(REPLACEMENT);
            }
            continue;
        }
        if (u >= 0xdc00 && u <= 0xdfff) {
            units.push(REPLACEMENT);
            continue;
        }
        units.push(u);
    }
    const out = new Uint8Array(units.length * 2);
    for (let i = 0; i < units.length; i++) {
        const code = units[i];
        const o = i * 2;
        out[o] = code & 0xff;
        out[o + 1] = code >>> 8;
    }
    return out;
}
function encodeASCII(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++)
        out[i] = str.charCodeAt(i) & 0x7f;
    return out;
}
function encodeLatin1(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++)
        out[i] = str.charCodeAt(i) & 0xff;
    return out;
}
function encodeWindows1252(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        const code = ch.charCodeAt(0);
        if (WINDOWS_1252_REVERSE[ch] !== undefined) {
            out[i] = WINDOWS_1252_REVERSE[ch];
            continue;
        }
        if ((code >= 0x00 && code <= 0x7f) ||
            (code >= 0xa0 && code <= 0xff)) {
            out[i] = code;
            continue;
        }
        out[i] = 0x3f; // '?'
    }
    return out;
}

// Primitive types
function dv(array) {
    return new DataView(array.buffer, array.byteOffset);
}
/*
 * 8-bit unsigned integer
 */
const UINT8 = {
    len: 1,
    get(array, offset) {
        return dv(array).getUint8(offset);
    },
    put(array, offset, value) {
        dv(array).setUint8(offset, value);
        return offset + 1;
    }
};
/**
 * 16-bit unsigned integer, Little Endian byte order
 */
const UINT16_LE = {
    len: 2,
    get(array, offset) {
        return dv(array).getUint16(offset, true);
    },
    put(array, offset, value) {
        dv(array).setUint16(offset, value, true);
        return offset + 2;
    }
};
/**
 * 16-bit unsigned integer, Big Endian byte order
 */
const UINT16_BE = {
    len: 2,
    get(array, offset) {
        return dv(array).getUint16(offset);
    },
    put(array, offset, value) {
        dv(array).setUint16(offset, value);
        return offset + 2;
    }
};
/**
 * 24-bit unsigned integer, Little Endian byte order
 */
const UINT24_LE = {
    len: 3,
    get(array, offset) {
        const dataView = dv(array);
        return dataView.getUint8(offset) + (dataView.getUint16(offset + 1, true) << 8);
    },
    put(array, offset, value) {
        const dataView = dv(array);
        dataView.setUint8(offset, value & 0xff);
        dataView.setUint16(offset + 1, value >> 8, true);
        return offset + 3;
    }
};
/**
 * 24-bit unsigned integer, Big Endian byte order
 */
const UINT24_BE = {
    len: 3,
    get(array, offset) {
        const dataView = dv(array);
        return (dataView.getUint16(offset) << 8) + dataView.getUint8(offset + 2);
    },
    put(array, offset, value) {
        const dataView = dv(array);
        dataView.setUint16(offset, value >> 8);
        dataView.setUint8(offset + 2, value & 0xff);
        return offset + 3;
    }
};
/**
 * 32-bit unsigned integer, Little Endian byte order
 */
const UINT32_LE = {
    len: 4,
    get(array, offset) {
        return dv(array).getUint32(offset, true);
    },
    put(array, offset, value) {
        dv(array).setUint32(offset, value, true);
        return offset + 4;
    }
};
/**
 * 32-bit unsigned integer, Big Endian byte order
 */
const UINT32_BE = {
    len: 4,
    get(array, offset) {
        return dv(array).getUint32(offset);
    },
    put(array, offset, value) {
        dv(array).setUint32(offset, value);
        return offset + 4;
    }
};
/**
 * 8-bit signed integer
 */
const INT8 = {
    len: 1,
    get(array, offset) {
        return dv(array).getInt8(offset);
    },
    put(array, offset, value) {
        dv(array).setInt8(offset, value);
        return offset + 1;
    }
};
/**
 * 16-bit signed integer, Big Endian byte order
 */
const INT16_BE = {
    len: 2,
    get(array, offset) {
        return dv(array).getInt16(offset);
    },
    put(array, offset, value) {
        dv(array).setInt16(offset, value);
        return offset + 2;
    }
};
/**
 * 16-bit signed integer, Little Endian byte order
 */
const INT16_LE = {
    len: 2,
    get(array, offset) {
        return dv(array).getInt16(offset, true);
    },
    put(array, offset, value) {
        dv(array).setInt16(offset, value, true);
        return offset + 2;
    }
};
/**
 * 24-bit signed integer, Little Endian byte order
 */
const INT24_LE = {
    len: 3,
    get(array, offset) {
        const unsigned = UINT24_LE.get(array, offset);
        return unsigned > 0x7fffff ? unsigned - 0x1000000 : unsigned;
    },
    put(array, offset, value) {
        const dataView = dv(array);
        dataView.setUint8(offset, value & 0xff);
        dataView.setUint16(offset + 1, value >> 8, true);
        return offset + 3;
    }
};
/**
 * 24-bit signed integer, Big Endian byte order
 */
const INT24_BE = {
    len: 3,
    get(array, offset) {
        const unsigned = UINT24_BE.get(array, offset);
        return unsigned > 0x7fffff ? unsigned - 0x1000000 : unsigned;
    },
    put(array, offset, value) {
        const dataView = dv(array);
        dataView.setUint16(offset, value >> 8);
        dataView.setUint8(offset + 2, value & 0xff);
        return offset + 3;
    }
};
/**
 * 32-bit signed integer, Big Endian byte order
 */
const INT32_BE = {
    len: 4,
    get(array, offset) {
        return dv(array).getInt32(offset);
    },
    put(array, offset, value) {
        dv(array).setInt32(offset, value);
        return offset + 4;
    }
};
/**
 * 32-bit signed integer, Big Endian byte order
 */
const INT32_LE = {
    len: 4,
    get(array, offset) {
        return dv(array).getInt32(offset, true);
    },
    put(array, offset, value) {
        dv(array).setInt32(offset, value, true);
        return offset + 4;
    }
};
/**
 * 64-bit unsigned integer, Little Endian byte order
 */
const UINT64_LE = {
    len: 8,
    get(array, offset) {
        return dv(array).getBigUint64(offset, true);
    },
    put(array, offset, value) {
        dv(array).setBigUint64(offset, value, true);
        return offset + 8;
    }
};
/**
 * 64-bit signed integer, Little Endian byte order
 */
const INT64_LE = {
    len: 8,
    get(array, offset) {
        return dv(array).getBigInt64(offset, true);
    },
    put(array, offset, value) {
        dv(array).setBigInt64(offset, value, true);
        return offset + 8;
    }
};
/**
 * 64-bit unsigned integer, Big Endian byte order
 */
const UINT64_BE = {
    len: 8,
    get(array, offset) {
        return dv(array).getBigUint64(offset);
    },
    put(array, offset, value) {
        dv(array).setBigUint64(offset, value);
        return offset + 8;
    }
};
/**
 * 64-bit signed integer, Big Endian byte order
 */
const INT64_BE = {
    len: 8,
    get(array, offset) {
        return dv(array).getBigInt64(offset);
    },
    put(array, offset, value) {
        dv(array).setBigInt64(offset, value);
        return offset + 8;
    }
};
/**
 * IEEE 754 16-bit (half precision) float, big endian
 */
const Float16_BE = {
    len: 2,
    get(dataView, offset) {
        return ieee754Exports.read(dataView, offset, false, 10, this.len);
    },
    put(dataView, offset, value) {
        ieee754Exports.write(dataView, value, offset, false, 10, this.len);
        return offset + this.len;
    }
};
/**
 * IEEE 754 16-bit (half precision) float, little endian
 */
const Float16_LE = {
    len: 2,
    get(array, offset) {
        return ieee754Exports.read(array, offset, true, 10, this.len);
    },
    put(array, offset, value) {
        ieee754Exports.write(array, value, offset, true, 10, this.len);
        return offset + this.len;
    }
};
/**
 * IEEE 754 32-bit (single precision) float, big endian
 */
const Float32_BE = {
    len: 4,
    get(array, offset) {
        return dv(array).getFloat32(offset);
    },
    put(array, offset, value) {
        dv(array).setFloat32(offset, value);
        return offset + 4;
    }
};
/**
 * IEEE 754 32-bit (single precision) float, little endian
 */
const Float32_LE = {
    len: 4,
    get(array, offset) {
        return dv(array).getFloat32(offset, true);
    },
    put(array, offset, value) {
        dv(array).setFloat32(offset, value, true);
        return offset + 4;
    }
};
/**
 * IEEE 754 64-bit (double precision) float, big endian
 */
const Float64_BE = {
    len: 8,
    get(array, offset) {
        return dv(array).getFloat64(offset);
    },
    put(array, offset, value) {
        dv(array).setFloat64(offset, value);
        return offset + 8;
    }
};
/**
 * IEEE 754 64-bit (double precision) float, little endian
 */
const Float64_LE = {
    len: 8,
    get(array, offset) {
        return dv(array).getFloat64(offset, true);
    },
    put(array, offset, value) {
        dv(array).setFloat64(offset, value, true);
        return offset + 8;
    }
};
/**
 * IEEE 754 80-bit (extended precision) float, big endian
 */
const Float80_BE = {
    len: 10,
    get(array, offset) {
        return ieee754Exports.read(array, offset, false, 63, this.len);
    },
    put(array, offset, value) {
        ieee754Exports.write(array, value, offset, false, 63, this.len);
        return offset + this.len;
    }
};
/**
 * IEEE 754 80-bit (extended precision) float, little endian
 */
const Float80_LE = {
    len: 10,
    get(array, offset) {
        return ieee754Exports.read(array, offset, true, 63, this.len);
    },
    put(array, offset, value) {
        ieee754Exports.write(array, value, offset, true, 63, this.len);
        return offset + this.len;
    }
};
/**
 * Ignore a given number of bytes
 */
class IgnoreType {
    /**
     * @param len number of bytes to ignore
     */
    constructor(len) {
        this.len = len;
    }
    // ToDo: don't read, but skip data
    get(_array, _off) {
    }
}
class Uint8ArrayType {
    constructor(len) {
        this.len = len;
    }
    get(array, offset) {
        return array.subarray(offset, offset + this.len);
    }
}
/**
 * Consume a fixed number of bytes from the stream and return a string with a specified encoding.
 * Supports all encodings supported by TextDecoder, plus 'windows-1252'.
 */
class StringType {
    constructor(len, encoding) {
        this.len = len;
        this.encoding = encoding;
    }
    get(data, offset = 0) {
        const bytes = data.subarray(offset, offset + this.len);
        return textDecode(bytes, this.encoding);
    }
}
/**
 * ANSI Latin 1 String using Windows-1252 (Code Page 1252)
 * Windows-1252 is a superset of ISO 8859-1 / Latin-1.
 */
class AnsiStringType extends StringType {
    constructor(len) {
        super(len, 'windows-1252');
    }
}

var Token = /*#__PURE__*/Object.freeze({
    __proto__: null,
    AnsiStringType: AnsiStringType,
    Float16_BE: Float16_BE,
    Float16_LE: Float16_LE,
    Float32_BE: Float32_BE,
    Float32_LE: Float32_LE,
    Float64_BE: Float64_BE,
    Float64_LE: Float64_LE,
    Float80_BE: Float80_BE,
    Float80_LE: Float80_LE,
    INT16_BE: INT16_BE,
    INT16_LE: INT16_LE,
    INT24_BE: INT24_BE,
    INT24_LE: INT24_LE,
    INT32_BE: INT32_BE,
    INT32_LE: INT32_LE,
    INT64_BE: INT64_BE,
    INT64_LE: INT64_LE,
    INT8: INT8,
    IgnoreType: IgnoreType,
    StringType: StringType,
    UINT16_BE: UINT16_BE,
    UINT16_LE: UINT16_LE,
    UINT24_BE: UINT24_BE,
    UINT24_LE: UINT24_LE,
    UINT32_BE: UINT32_BE,
    UINT32_LE: UINT32_LE,
    UINT64_BE: UINT64_BE,
    UINT64_LE: UINT64_LE,
    UINT8: UINT8,
    Uint8ArrayType: Uint8ArrayType
});

var browser = {exports: {}};

/**
 * Helpers.
 */

var ms;
var hasRequiredMs;

function requireMs () {
	if (hasRequiredMs) return ms;
	hasRequiredMs = 1;
	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var w = d * 7;
	var y = d * 365.25;

	/**
	 * Parse or format the given `val`.
	 *
	 * Options:
	 *
	 *  - `long` verbose formatting [false]
	 *
	 * @param {String|Number} val
	 * @param {Object} [options]
	 * @throws {Error} throw an error if val is not a non-empty string or a number
	 * @return {String|Number}
	 * @api public
	 */

	ms = function (val, options) {
	  options = options || {};
	  var type = typeof val;
	  if (type === 'string' && val.length > 0) {
	    return parse(val);
	  } else if (type === 'number' && isFinite(val)) {
	    return options.long ? fmtLong(val) : fmtShort(val);
	  }
	  throw new Error(
	    'val is not a non-empty string or a valid number. val=' +
	      JSON.stringify(val)
	  );
	};

	/**
	 * Parse the given `str` and return milliseconds.
	 *
	 * @param {String} str
	 * @return {Number}
	 * @api private
	 */

	function parse(str) {
	  str = String(str);
	  if (str.length > 100) {
	    return;
	  }
	  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
	    str
	  );
	  if (!match) {
	    return;
	  }
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'yrs':
	    case 'yr':
	    case 'y':
	      return n * y;
	    case 'weeks':
	    case 'week':
	    case 'w':
	      return n * w;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'hrs':
	    case 'hr':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'mins':
	    case 'min':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 'secs':
	    case 'sec':
	    case 's':
	      return n * s;
	    case 'milliseconds':
	    case 'millisecond':
	    case 'msecs':
	    case 'msec':
	    case 'ms':
	      return n;
	    default:
	      return undefined;
	  }
	}

	/**
	 * Short format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function fmtShort(ms) {
	  var msAbs = Math.abs(ms);
	  if (msAbs >= d) {
	    return Math.round(ms / d) + 'd';
	  }
	  if (msAbs >= h) {
	    return Math.round(ms / h) + 'h';
	  }
	  if (msAbs >= m) {
	    return Math.round(ms / m) + 'm';
	  }
	  if (msAbs >= s) {
	    return Math.round(ms / s) + 's';
	  }
	  return ms + 'ms';
	}

	/**
	 * Long format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function fmtLong(ms) {
	  var msAbs = Math.abs(ms);
	  if (msAbs >= d) {
	    return plural(ms, msAbs, d, 'day');
	  }
	  if (msAbs >= h) {
	    return plural(ms, msAbs, h, 'hour');
	  }
	  if (msAbs >= m) {
	    return plural(ms, msAbs, m, 'minute');
	  }
	  if (msAbs >= s) {
	    return plural(ms, msAbs, s, 'second');
	  }
	  return ms + ' ms';
	}

	/**
	 * Pluralization helper.
	 */

	function plural(ms, msAbs, n, name) {
	  var isPlural = msAbs >= n * 1.5;
	  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
	}
	return ms;
}

var common;
var hasRequiredCommon;

function requireCommon () {
	if (hasRequiredCommon) return common;
	hasRequiredCommon = 1;
	/**
	 * This is the common logic for both the Node.js and web browser
	 * implementations of `debug()`.
	 */

	function setup(env) {
		createDebug.debug = createDebug;
		createDebug.default = createDebug;
		createDebug.coerce = coerce;
		createDebug.disable = disable;
		createDebug.enable = enable;
		createDebug.enabled = enabled;
		createDebug.humanize = requireMs();
		createDebug.destroy = destroy;

		Object.keys(env).forEach(key => {
			createDebug[key] = env[key];
		});

		/**
		* The currently active debug mode names, and names to skip.
		*/

		createDebug.names = [];
		createDebug.skips = [];

		/**
		* Map of special "%n" handling functions, for the debug "format" argument.
		*
		* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
		*/
		createDebug.formatters = {};

		/**
		* Selects a color for a debug namespace
		* @param {String} namespace The namespace string for the debug instance to be colored
		* @return {Number|String} An ANSI color code for the given namespace
		* @api private
		*/
		function selectColor(namespace) {
			let hash = 0;

			for (let i = 0; i < namespace.length; i++) {
				hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
				hash |= 0; // Convert to 32bit integer
			}

			return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
		}
		createDebug.selectColor = selectColor;

		/**
		* Create a debugger with the given `namespace`.
		*
		* @param {String} namespace
		* @return {Function}
		* @api public
		*/
		function createDebug(namespace) {
			let prevTime;
			let enableOverride = null;
			let namespacesCache;
			let enabledCache;

			function debug(...args) {
				// Disabled?
				if (!debug.enabled) {
					return;
				}

				const self = debug;

				// Set `diff` timestamp
				const curr = Number(new Date());
				const ms = curr - (prevTime || curr);
				self.diff = ms;
				self.prev = prevTime;
				self.curr = curr;
				prevTime = curr;

				args[0] = createDebug.coerce(args[0]);

				if (typeof args[0] !== 'string') {
					// Anything else let's inspect with %O
					args.unshift('%O');
				}

				// Apply any `formatters` transformations
				let index = 0;
				args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
					// If we encounter an escaped % then don't increase the array index
					if (match === '%%') {
						return '%';
					}
					index++;
					const formatter = createDebug.formatters[format];
					if (typeof formatter === 'function') {
						const val = args[index];
						match = formatter.call(self, val);

						// Now we need to remove `args[index]` since it's inlined in the `format`
						args.splice(index, 1);
						index--;
					}
					return match;
				});

				// Apply env-specific formatting (colors, etc.)
				createDebug.formatArgs.call(self, args);

				const logFn = self.log || createDebug.log;
				logFn.apply(self, args);
			}

			debug.namespace = namespace;
			debug.useColors = createDebug.useColors();
			debug.color = createDebug.selectColor(namespace);
			debug.extend = extend;
			debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

			Object.defineProperty(debug, 'enabled', {
				enumerable: true,
				configurable: false,
				get: () => {
					if (enableOverride !== null) {
						return enableOverride;
					}
					if (namespacesCache !== createDebug.namespaces) {
						namespacesCache = createDebug.namespaces;
						enabledCache = createDebug.enabled(namespace);
					}

					return enabledCache;
				},
				set: v => {
					enableOverride = v;
				}
			});

			// Env-specific initialization logic for debug instances
			if (typeof createDebug.init === 'function') {
				createDebug.init(debug);
			}

			return debug;
		}

		function extend(namespace, delimiter) {
			const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
			newDebug.log = this.log;
			return newDebug;
		}

		/**
		* Enables a debug mode by namespaces. This can include modes
		* separated by a colon and wildcards.
		*
		* @param {String} namespaces
		* @api public
		*/
		function enable(namespaces) {
			createDebug.save(namespaces);
			createDebug.namespaces = namespaces;

			createDebug.names = [];
			createDebug.skips = [];

			const split = (typeof namespaces === 'string' ? namespaces : '')
				.trim()
				.replace(/\s+/g, ',')
				.split(',')
				.filter(Boolean);

			for (const ns of split) {
				if (ns[0] === '-') {
					createDebug.skips.push(ns.slice(1));
				} else {
					createDebug.names.push(ns);
				}
			}
		}

		/**
		 * Checks if the given string matches a namespace template, honoring
		 * asterisks as wildcards.
		 *
		 * @param {String} search
		 * @param {String} template
		 * @return {Boolean}
		 */
		function matchesTemplate(search, template) {
			let searchIndex = 0;
			let templateIndex = 0;
			let starIndex = -1;
			let matchIndex = 0;

			while (searchIndex < search.length) {
				if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')) {
					// Match character or proceed with wildcard
					if (template[templateIndex] === '*') {
						starIndex = templateIndex;
						matchIndex = searchIndex;
						templateIndex++; // Skip the '*'
					} else {
						searchIndex++;
						templateIndex++;
					}
				} else if (starIndex !== -1) { // eslint-disable-line no-negated-condition
					// Backtrack to the last '*' and try to match more characters
					templateIndex = starIndex + 1;
					matchIndex++;
					searchIndex = matchIndex;
				} else {
					return false; // No match
				}
			}

			// Handle trailing '*' in template
			while (templateIndex < template.length && template[templateIndex] === '*') {
				templateIndex++;
			}

			return templateIndex === template.length;
		}

		/**
		* Disable debug output.
		*
		* @return {String} namespaces
		* @api public
		*/
		function disable() {
			const namespaces = [
				...createDebug.names,
				...createDebug.skips.map(namespace => '-' + namespace)
			].join(',');
			createDebug.enable('');
			return namespaces;
		}

		/**
		* Returns true if the given mode name is enabled, false otherwise.
		*
		* @param {String} name
		* @return {Boolean}
		* @api public
		*/
		function enabled(name) {
			for (const skip of createDebug.skips) {
				if (matchesTemplate(name, skip)) {
					return false;
				}
			}

			for (const ns of createDebug.names) {
				if (matchesTemplate(name, ns)) {
					return true;
				}
			}

			return false;
		}

		/**
		* Coerce `val`.
		*
		* @param {Mixed} val
		* @return {Mixed}
		* @api private
		*/
		function coerce(val) {
			if (val instanceof Error) {
				return val.stack || val.message;
			}
			return val;
		}

		/**
		* XXX DO NOT USE. This is a temporary stub function.
		* XXX It WILL be removed in the next major release.
		*/
		function destroy() {
			console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
		}

		createDebug.enable(createDebug.load());

		return createDebug;
	}

	common = setup;
	return common;
}

/* eslint-env browser */

var hasRequiredBrowser;

function requireBrowser () {
	if (hasRequiredBrowser) return browser.exports;
	hasRequiredBrowser = 1;
	(function (module, exports) {
		/**
		 * This is the web browser implementation of `debug()`.
		 */

		exports.formatArgs = formatArgs;
		exports.save = save;
		exports.load = load;
		exports.useColors = useColors;
		exports.storage = localstorage();
		exports.destroy = (() => {
			let warned = false;

			return () => {
				if (!warned) {
					warned = true;
					console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
				}
			};
		})();

		/**
		 * Colors.
		 */

		exports.colors = [
			'#0000CC',
			'#0000FF',
			'#0033CC',
			'#0033FF',
			'#0066CC',
			'#0066FF',
			'#0099CC',
			'#0099FF',
			'#00CC00',
			'#00CC33',
			'#00CC66',
			'#00CC99',
			'#00CCCC',
			'#00CCFF',
			'#3300CC',
			'#3300FF',
			'#3333CC',
			'#3333FF',
			'#3366CC',
			'#3366FF',
			'#3399CC',
			'#3399FF',
			'#33CC00',
			'#33CC33',
			'#33CC66',
			'#33CC99',
			'#33CCCC',
			'#33CCFF',
			'#6600CC',
			'#6600FF',
			'#6633CC',
			'#6633FF',
			'#66CC00',
			'#66CC33',
			'#9900CC',
			'#9900FF',
			'#9933CC',
			'#9933FF',
			'#99CC00',
			'#99CC33',
			'#CC0000',
			'#CC0033',
			'#CC0066',
			'#CC0099',
			'#CC00CC',
			'#CC00FF',
			'#CC3300',
			'#CC3333',
			'#CC3366',
			'#CC3399',
			'#CC33CC',
			'#CC33FF',
			'#CC6600',
			'#CC6633',
			'#CC9900',
			'#CC9933',
			'#CCCC00',
			'#CCCC33',
			'#FF0000',
			'#FF0033',
			'#FF0066',
			'#FF0099',
			'#FF00CC',
			'#FF00FF',
			'#FF3300',
			'#FF3333',
			'#FF3366',
			'#FF3399',
			'#FF33CC',
			'#FF33FF',
			'#FF6600',
			'#FF6633',
			'#FF9900',
			'#FF9933',
			'#FFCC00',
			'#FFCC33'
		];

		/**
		 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
		 * and the Firebug extension (any Firefox version) are known
		 * to support "%c" CSS customizations.
		 *
		 * TODO: add a `localStorage` variable to explicitly enable/disable colors
		 */

		// eslint-disable-next-line complexity
		function useColors() {
			// NB: In an Electron preload script, document will be defined but not fully
			// initialized. Since we know we're in Chrome, we'll just detect this case
			// explicitly
			if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
				return true;
			}

			// Internet Explorer and Edge do not support colors.
			if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
				return false;
			}

			let m;

			// Is webkit? http://stackoverflow.com/a/16459606/376773
			// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
			// eslint-disable-next-line no-return-assign
			return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
				// Is firebug? http://stackoverflow.com/a/398120/376773
				(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
				// Is firefox >= v31?
				// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
				(typeof navigator !== 'undefined' && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31) ||
				// Double check webkit in userAgent just in case we are in a worker
				(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
		}

		/**
		 * Colorize log arguments if enabled.
		 *
		 * @api public
		 */

		function formatArgs(args) {
			args[0] = (this.useColors ? '%c' : '') +
				this.namespace +
				(this.useColors ? ' %c' : ' ') +
				args[0] +
				(this.useColors ? '%c ' : ' ') +
				'+' + module.exports.humanize(this.diff);

			if (!this.useColors) {
				return;
			}

			const c = 'color: ' + this.color;
			args.splice(1, 0, c, 'color: inherit');

			// The final "%c" is somewhat tricky, because there could be other
			// arguments passed either before or after the %c, so we need to
			// figure out the correct index to insert the CSS into
			let index = 0;
			let lastC = 0;
			args[0].replace(/%[a-zA-Z%]/g, match => {
				if (match === '%%') {
					return;
				}
				index++;
				if (match === '%c') {
					// We only are interested in the *last* %c
					// (the user may have provided their own)
					lastC = index;
				}
			});

			args.splice(lastC, 0, c);
		}

		/**
		 * Invokes `console.debug()` when available.
		 * No-op when `console.debug` is not a "function".
		 * If `console.debug` is not available, falls back
		 * to `console.log`.
		 *
		 * @api public
		 */
		exports.log = console.debug || console.log || (() => {});

		/**
		 * Save `namespaces`.
		 *
		 * @param {String} namespaces
		 * @api private
		 */
		function save(namespaces) {
			try {
				if (namespaces) {
					exports.storage.setItem('debug', namespaces);
				} else {
					exports.storage.removeItem('debug');
				}
			} catch (error) {
				// Swallow
				// XXX (@Qix-) should we be logging these?
			}
		}

		/**
		 * Load `namespaces`.
		 *
		 * @return {String} returns the previously persisted debug modes
		 * @api private
		 */
		function load() {
			let r;
			try {
				r = exports.storage.getItem('debug') || exports.storage.getItem('DEBUG') ;
			} catch (error) {
				// Swallow
				// XXX (@Qix-) should we be logging these?
			}

			// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
			if (!r && typeof process !== 'undefined' && 'env' in process) {
				r = process.env.DEBUG;
			}

			return r;
		}

		/**
		 * Localstorage attempts to return the localstorage.
		 *
		 * This is necessary because safari throws
		 * when a user disables cookies/localstorage
		 * and you attempt to access it.
		 *
		 * @return {LocalStorage}
		 * @api private
		 */

		function localstorage() {
			try {
				// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
				// The Browser also has localStorage in the global context.
				return localStorage;
			} catch (error) {
				// Swallow
				// XXX (@Qix-) should we be logging these?
			}
		}

		module.exports = requireCommon()(exports);

		const {formatters} = module.exports;

		/**
		 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
		 */

		formatters.j = function (v) {
			try {
				return JSON.stringify(v);
			} catch (error) {
				return '[UnexpectedJSONParseError]: ' + error.message;
			}
		}; 
	} (browser, browser.exports));
	return browser.exports;
}

var browserExports = requireBrowser();
var initDebug = /*@__PURE__*/getDefaultExportFromCjs(browserExports);

/**
 * Ref https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 */
const Signature = {
    LocalFileHeader: 0x04034b50,
    DataDescriptor: 0x08074b50,
    CentralFileHeader: 0x02014b50,
    EndOfCentralDirectory: 0x06054b50
};
const DataDescriptor = {
    get(array) {
        return {
            signature: UINT32_LE.get(array, 0),
            compressedSize: UINT32_LE.get(array, 8),
            uncompressedSize: UINT32_LE.get(array, 12),
        };
    }, len: 16
};
/**
 * First part of the ZIP Local File Header
 * Offset | Bytes| Description
 * -------|------+-------------------------------------------------------------------
 *      0 |    4 | Signature (0x04034b50)
 *      4 |    2 | Minimum version needed to extract
 *      6 |    2 | Bit flag
 *      8 |    2 | Compression method
 *     10 |    2 | File last modification time (MS-DOS format)
 *     12 |    2 | File last modification date (MS-DOS format)
 *     14 |    4 | CRC-32 of uncompressed data
 *     18 |    4 | Compressed size
 *     22 |    4 | Uncompressed size
 *     26 |    2 | File name length (n)
 *     28 |    2 | Extra field length (m)
 *     30 |    n | File name
 * 30 + n |    m | Extra field
 */
const LocalFileHeaderToken = {
    get(array) {
        const flags = UINT16_LE.get(array, 6);
        return {
            signature: UINT32_LE.get(array, 0),
            minVersion: UINT16_LE.get(array, 4),
            dataDescriptor: !!(flags & 0x0008),
            compressedMethod: UINT16_LE.get(array, 8),
            compressedSize: UINT32_LE.get(array, 18),
            uncompressedSize: UINT32_LE.get(array, 22),
            filenameLength: UINT16_LE.get(array, 26),
            extraFieldLength: UINT16_LE.get(array, 28),
            filename: null
        };
    }, len: 30
};
/**
 * 4.3.16  End of central directory record:
 *  end of central dir signature (0x06064b50)                                      4 bytes
 *  number of this disk                                                            2 bytes
 *  number of the disk with the start of the central directory                     2 bytes
 *  total number of entries in the central directory on this disk                  2 bytes
 *  total number of entries in the size of the central directory                   2 bytes
 *  sizeOfTheCentralDirectory                                                      4 bytes
 *  offset of start of central directory with respect to the starting disk number  4 bytes
 *  .ZIP file comment length                                                       2 bytes
 *  .ZIP file comment       (variable size)
 */
const EndOfCentralDirectoryRecordToken = {
    get(array) {
        return {
            signature: UINT32_LE.get(array, 0),
            nrOfThisDisk: UINT16_LE.get(array, 4),
            nrOfThisDiskWithTheStart: UINT16_LE.get(array, 6),
            nrOfEntriesOnThisDisk: UINT16_LE.get(array, 8),
            nrOfEntriesOfSize: UINT16_LE.get(array, 10),
            sizeOfCd: UINT32_LE.get(array, 12),
            offsetOfStartOfCd: UINT32_LE.get(array, 16),
            zipFileCommentLength: UINT16_LE.get(array, 20),
        };
    }, len: 22
};
/**
 * File header:
 *    central file header signature   4 bytes   0 (0x02014b50)
 *    version made by                 2 bytes   4
 *    version needed to extract       2 bytes   6
 *    general purpose bit flag        2 bytes   8
 *    compression method              2 bytes  10
 *    last mod file time              2 bytes  12
 *    last mod file date              2 bytes  14
 *    crc-32                          4 bytes  16
 *    compressed size                 4 bytes  20
 *    uncompressed size               4 bytes  24
 *    file name length                2 bytes  28
 *    extra field length              2 bytes  30
 *    file comment length             2 bytes  32
 *    disk number start               2 bytes  34
 *    internal file attributes        2 bytes  36
 *    external file attributes        4 bytes  38
 *    relative offset of local header 4 bytes  42
 */
const FileHeader = {
    get(array) {
        const flags = UINT16_LE.get(array, 8);
        return {
            signature: UINT32_LE.get(array, 0),
            minVersion: UINT16_LE.get(array, 6),
            dataDescriptor: !!(flags & 0x0008),
            compressedMethod: UINT16_LE.get(array, 10),
            compressedSize: UINT32_LE.get(array, 20),
            uncompressedSize: UINT32_LE.get(array, 24),
            filenameLength: UINT16_LE.get(array, 28),
            extraFieldLength: UINT16_LE.get(array, 30),
            fileCommentLength: UINT16_LE.get(array, 32),
            relativeOffsetOfLocalHeader: UINT32_LE.get(array, 42),
            filename: null
        };
    }, len: 46
};

function signatureToArray(signature) {
    const signatureBytes = new Uint8Array(UINT32_LE.len);
    UINT32_LE.put(signatureBytes, 0, signature);
    return signatureBytes;
}
const debug$4 = initDebug('tokenizer:inflate');
const syncBufferSize = 256 * 1024;
const ddSignatureArray = signatureToArray(Signature.DataDescriptor);
const eocdSignatureBytes = signatureToArray(Signature.EndOfCentralDirectory);
class ZipHandler {
    constructor(tokenizer) {
        this.tokenizer = tokenizer;
        this.syncBuffer = new Uint8Array(syncBufferSize);
    }
    async isZip() {
        return await this.peekSignature() === Signature.LocalFileHeader;
    }
    peekSignature() {
        return this.tokenizer.peekToken(UINT32_LE);
    }
    async findEndOfCentralDirectoryLocator() {
        const randomReadTokenizer = this.tokenizer;
        const chunkLength = Math.min(16 * 1024, randomReadTokenizer.fileInfo.size);
        const buffer = this.syncBuffer.subarray(0, chunkLength);
        await this.tokenizer.readBuffer(buffer, { position: randomReadTokenizer.fileInfo.size - chunkLength });
        // Search the buffer from end to beginning for EOCD signature
        // const signature = 0x06054b50;
        for (let i = buffer.length - 4; i >= 0; i--) {
            // Compare 4 bytes directly without calling readUInt32LE
            if (buffer[i] === eocdSignatureBytes[0] &&
                buffer[i + 1] === eocdSignatureBytes[1] &&
                buffer[i + 2] === eocdSignatureBytes[2] &&
                buffer[i + 3] === eocdSignatureBytes[3]) {
                return randomReadTokenizer.fileInfo.size - chunkLength + i;
            }
        }
        return -1;
    }
    async readCentralDirectory() {
        if (!this.tokenizer.supportsRandomAccess()) {
            debug$4('Cannot reading central-directory without random-read support');
            return;
        }
        debug$4('Reading central-directory...');
        const pos = this.tokenizer.position;
        const offset = await this.findEndOfCentralDirectoryLocator();
        if (offset > 0) {
            debug$4('Central-directory 32-bit signature found');
            const eocdHeader = await this.tokenizer.readToken(EndOfCentralDirectoryRecordToken, offset);
            const files = [];
            this.tokenizer.setPosition(eocdHeader.offsetOfStartOfCd);
            for (let n = 0; n < eocdHeader.nrOfEntriesOfSize; ++n) {
                const entry = await this.tokenizer.readToken(FileHeader);
                if (entry.signature !== Signature.CentralFileHeader) {
                    throw new Error('Expected Central-File-Header signature');
                }
                entry.filename = await this.tokenizer.readToken(new StringType(entry.filenameLength, 'utf-8'));
                await this.tokenizer.ignore(entry.extraFieldLength);
                await this.tokenizer.ignore(entry.fileCommentLength);
                files.push(entry);
                debug$4(`Add central-directory file-entry: n=${n + 1}/${files.length}: filename=${files[n].filename}`);
            }
            this.tokenizer.setPosition(pos);
            return files;
        }
        this.tokenizer.setPosition(pos);
    }
    async unzip(fileCb) {
        const entries = await this.readCentralDirectory();
        if (entries) {
            // Use Central Directory to iterate over files
            return this.iterateOverCentralDirectory(entries, fileCb);
        }
        // Scan Zip files for local-file-header
        let stop = false;
        do {
            const zipHeader = await this.readLocalFileHeader();
            if (!zipHeader)
                break;
            const next = fileCb(zipHeader);
            stop = !!next.stop;
            let fileData;
            await this.tokenizer.ignore(zipHeader.extraFieldLength);
            if (zipHeader.dataDescriptor && zipHeader.compressedSize === 0) {
                const chunks = [];
                let len = syncBufferSize;
                debug$4('Compressed-file-size unknown, scanning for next data-descriptor-signature....');
                let nextHeaderIndex = -1;
                while (nextHeaderIndex < 0 && len === syncBufferSize) {
                    len = await this.tokenizer.peekBuffer(this.syncBuffer, { mayBeLess: true });
                    nextHeaderIndex = indexOf(this.syncBuffer.subarray(0, len), ddSignatureArray);
                    const size = nextHeaderIndex >= 0 ? nextHeaderIndex : len;
                    if (next.handler) {
                        const data = new Uint8Array(size);
                        await this.tokenizer.readBuffer(data);
                        chunks.push(data);
                    }
                    else {
                        // Move position to the next header if found, skip the whole buffer otherwise
                        await this.tokenizer.ignore(size);
                    }
                }
                debug$4(`Found data-descriptor-signature at pos=${this.tokenizer.position}`);
                if (next.handler) {
                    await this.inflate(zipHeader, mergeArrays(chunks), next.handler);
                }
            }
            else {
                if (next.handler) {
                    debug$4(`Reading compressed-file-data: ${zipHeader.compressedSize} bytes`);
                    fileData = new Uint8Array(zipHeader.compressedSize);
                    await this.tokenizer.readBuffer(fileData);
                    await this.inflate(zipHeader, fileData, next.handler);
                }
                else {
                    debug$4(`Ignoring compressed-file-data: ${zipHeader.compressedSize} bytes`);
                    await this.tokenizer.ignore(zipHeader.compressedSize);
                }
            }
            debug$4(`Reading data-descriptor at pos=${this.tokenizer.position}`);
            if (zipHeader.dataDescriptor) {
                // await this.tokenizer.ignore(DataDescriptor.len);
                const dataDescriptor = await this.tokenizer.readToken(DataDescriptor);
                if (dataDescriptor.signature !== 0x08074b50) {
                    throw new Error(`Expected data-descriptor-signature at position ${this.tokenizer.position - DataDescriptor.len}`);
                }
            }
        } while (!stop);
    }
    async iterateOverCentralDirectory(entries, fileCb) {
        for (const fileHeader of entries) {
            const next = fileCb(fileHeader);
            if (next.handler) {
                this.tokenizer.setPosition(fileHeader.relativeOffsetOfLocalHeader);
                const zipHeader = await this.readLocalFileHeader();
                if (zipHeader) {
                    await this.tokenizer.ignore(zipHeader.extraFieldLength);
                    const fileData = new Uint8Array(fileHeader.compressedSize);
                    await this.tokenizer.readBuffer(fileData);
                    await this.inflate(zipHeader, fileData, next.handler);
                }
            }
            if (next.stop)
                break;
        }
    }
    async inflate(zipHeader, fileData, cb) {
        if (zipHeader.compressedMethod === 0) {
            // Stored (uncompressed)
            return cb(fileData);
        }
        if (zipHeader.compressedMethod !== 8) {
            throw new Error(`Unsupported ZIP compression method: ${zipHeader.compressedMethod}`);
        }
        debug$4(`Decompress filename=${zipHeader.filename}, compressed-size=${fileData.length}`);
        const uncompressedData = await ZipHandler.decompressDeflateRaw(fileData);
        return cb(uncompressedData);
    }
    static async decompressDeflateRaw(data) {
        // Wrap Uint8Array in a ReadableStream without copying
        const input = new ReadableStream({
            start(controller) {
                controller.enqueue(data);
                controller.close();
            }
        });
        const ds = new DecompressionStream("deflate-raw");
        const output = input.pipeThrough(ds);
        try {
            // Collect decompressed bytes from the output stream
            const response = new Response(output);
            const buffer = await response.arrayBuffer();
            return new Uint8Array(buffer);
        }
        catch (err) {
            // Provide ZIP-specific error context
            const message = err instanceof Error
                ? `Failed to deflate ZIP entry: ${err.message}`
                : "Unknown decompression error in ZIP entry";
            throw new TypeError(message);
        }
    }
    async readLocalFileHeader() {
        const signature = await this.tokenizer.peekToken(UINT32_LE);
        if (signature === Signature.LocalFileHeader) {
            const header = await this.tokenizer.readToken(LocalFileHeaderToken);
            header.filename = await this.tokenizer.readToken(new StringType(header.filenameLength, 'utf-8'));
            return header;
        }
        if (signature === Signature.CentralFileHeader) {
            return false;
        }
        if (signature === 0xE011CFD0) {
            throw new Error('Encrypted ZIP');
        }
        throw new Error('Unexpected signature');
    }
}
function indexOf(buffer, portion) {
    const bufferLength = buffer.length;
    const portionLength = portion.length;
    // Return -1 if the portion is longer than the buffer
    if (portionLength > bufferLength)
        return -1;
    // Search for the portion in the buffer
    for (let i = 0; i <= bufferLength - portionLength; i++) {
        let found = true;
        for (let j = 0; j < portionLength; j++) {
            if (buffer[i + j] !== portion[j]) {
                found = false;
                break;
            }
        }
        if (found) {
            return i; // Return the starting offset
        }
    }
    return -1; // Not found
}
function mergeArrays(chunks) {
    // Concatenate chunks into a single Uint8Array
    const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
    const mergedArray = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        mergedArray.set(chunk, offset);
        offset += chunk.length;
    }
    return mergedArray;
}

class GzipHandler {
    constructor(tokenizer) {
        this.tokenizer = tokenizer;
    }
    inflate() {
        const tokenizer = this.tokenizer;
        return new ReadableStream({
            async pull(controller) {
                const buffer = new Uint8Array(1024);
                const size = await tokenizer.readBuffer(buffer, { mayBeLess: true });
                if (size === 0) {
                    controller.close();
                    return;
                }
                controller.enqueue(buffer.subarray(0, size));
            }
        }).pipeThrough(new DecompressionStream("gzip"));
    }
}

const objectToString = Object.prototype.toString;
const uint8ArrayStringified = '[object Uint8Array]';

function isType(value, typeConstructor, typeStringified) {
	if (!value) {
		return false;
	}

	if (value.constructor === typeConstructor) {
		return true;
	}

	return objectToString.call(value) === typeStringified;
}

function isUint8Array(value) {
	return isType(value, Uint8Array, uint8ArrayStringified);
}

function assertUint8Array(value) {
	if (!isUint8Array(value)) {
		throw new TypeError(`Expected \`Uint8Array\`, got \`${typeof value}\``);
	}
}

({
	utf8: new globalThis.TextDecoder('utf8'),
});

new globalThis.TextEncoder();

const byteToHexLookupTable = Array.from({length: 256}, (_, index) => index.toString(16).padStart(2, '0'));

function uint8ArrayToHex(array) {
	assertUint8Array(array);

	// Concatenating a string is faster than using an array.
	let hexString = '';

	// eslint-disable-next-line unicorn/no-for-loop -- Max performance is critical.
	for (let index = 0; index < array.length; index++) {
		hexString += byteToHexLookupTable[array[index]];
	}

	return hexString;
}

/**
@param {DataView} view
@returns {number}
*/
function getUintBE(view) {
	const {byteLength} = view;

	if (byteLength === 6) {
		return (view.getUint16(0) * (2 ** 32)) + view.getUint32(2);
	}

	if (byteLength === 5) {
		return (view.getUint8(0) * (2 ** 32)) + view.getUint32(1);
	}

	if (byteLength === 4) {
		return view.getUint32(0);
	}

	if (byteLength === 3) {
		return (view.getUint8(0) * (2 ** 16)) + view.getUint16(1);
	}

	if (byteLength === 2) {
		return view.getUint16(0);
	}

	if (byteLength === 1) {
		return view.getUint8(0);
	}
}

function stringToBytes(string, encoding) {
	if (encoding === 'utf-16le') {
		const bytes = [];
		for (let index = 0; index < string.length; index++) {
			const code = string.charCodeAt(index); // eslint-disable-line unicorn/prefer-code-point
			bytes.push(code & 0xFF, (code >> 8) & 0xFF); // High byte
		}

		return bytes;
	}

	if (encoding === 'utf-16be') {
		const bytes = [];
		for (let index = 0; index < string.length; index++) {
			const code = string.charCodeAt(index); // eslint-disable-line unicorn/prefer-code-point
			bytes.push((code >> 8) & 0xFF, code & 0xFF); // Low byte
		}

		return bytes;
	}

	return [...string].map(character => character.charCodeAt(0)); // eslint-disable-line unicorn/prefer-code-point
}

/**
Checks whether the TAR checksum is valid.

@param {Uint8Array} arrayBuffer - The TAR header `[offset ... offset + 512]`.
@param {number} offset - TAR header offset.
@returns {boolean} `true` if the TAR checksum is valid, otherwise `false`.
*/
function tarHeaderChecksumMatches(arrayBuffer, offset = 0) {
	const readSum = Number.parseInt(new StringType(6).get(arrayBuffer, 148).replace(/\0.*$/, '').trim(), 8); // Read sum in header
	if (Number.isNaN(readSum)) {
		return false;
	}

	let sum = 8 * 0x20; // Initialize signed bit sum

	for (let index = offset; index < offset + 148; index++) {
		sum += arrayBuffer[index];
	}

	for (let index = offset + 156; index < offset + 512; index++) {
		sum += arrayBuffer[index];
	}

	return readSum === sum;
}

/**
ID3 UINT32 sync-safe tokenizer token.
28 bits (representing up to 256MB) integer, the msb is 0 to avoid "false syncsignals".
*/
const uint32SyncSafeToken = {
	get: (buffer, offset) => (buffer[offset + 3] & 0x7F) | ((buffer[offset + 2]) << 7) | ((buffer[offset + 1]) << 14) | ((buffer[offset]) << 21),
	len: 4,
};

const extensions = [
	'jpg',
	'png',
	'apng',
	'gif',
	'webp',
	'flif',
	'xcf',
	'cr2',
	'cr3',
	'orf',
	'arw',
	'dng',
	'nef',
	'rw2',
	'raf',
	'tif',
	'bmp',
	'icns',
	'jxr',
	'psd',
	'indd',
	'zip',
	'tar',
	'rar',
	'gz',
	'bz2',
	'7z',
	'dmg',
	'mp4',
	'mid',
	'mkv',
	'webm',
	'mov',
	'avi',
	'mpg',
	'mp2',
	'mp3',
	'm4a',
	'oga',
	'ogg',
	'ogv',
	'opus',
	'flac',
	'wav',
	'spx',
	'amr',
	'pdf',
	'epub',
	'elf',
	'macho',
	'exe',
	'swf',
	'rtf',
	'wasm',
	'woff',
	'woff2',
	'eot',
	'ttf',
	'otf',
	'ttc',
	'ico',
	'flv',
	'ps',
	'xz',
	'sqlite',
	'nes',
	'crx',
	'xpi',
	'cab',
	'deb',
	'ar',
	'rpm',
	'Z',
	'lz',
	'cfb',
	'mxf',
	'mts',
	'blend',
	'bpg',
	'docx',
	'pptx',
	'xlsx',
	'3gp',
	'3g2',
	'j2c',
	'jp2',
	'jpm',
	'jpx',
	'mj2',
	'aif',
	'qcp',
	'odt',
	'ods',
	'odp',
	'xml',
	'mobi',
	'heic',
	'cur',
	'ktx',
	'ape',
	'wv',
	'dcm',
	'ics',
	'glb',
	'pcap',
	'dsf',
	'lnk',
	'alias',
	'voc',
	'ac3',
	'm4v',
	'm4p',
	'm4b',
	'f4v',
	'f4p',
	'f4b',
	'f4a',
	'mie',
	'asf',
	'ogm',
	'ogx',
	'mpc',
	'arrow',
	'shp',
	'aac',
	'mp1',
	'it',
	's3m',
	'xm',
	'skp',
	'avif',
	'eps',
	'lzh',
	'pgp',
	'asar',
	'stl',
	'chm',
	'3mf',
	'zst',
	'jxl',
	'vcf',
	'jls',
	'pst',
	'dwg',
	'parquet',
	'class',
	'arj',
	'cpio',
	'ace',
	'avro',
	'icc',
	'fbx',
	'vsdx',
	'vtt',
	'apk',
	'drc',
	'lz4',
	'potx',
	'xltx',
	'dotx',
	'xltm',
	'ott',
	'ots',
	'otp',
	'odg',
	'otg',
	'xlsm',
	'docm',
	'dotm',
	'potm',
	'pptm',
	'jar',
	'jmp',
	'rm',
	'sav',
	'ppsm',
	'ppsx',
	'tar.gz',
	'reg',
	'dat',
];

const mimeTypes = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/flif',
	'image/x-xcf',
	'image/x-canon-cr2',
	'image/x-canon-cr3',
	'image/tiff',
	'image/bmp',
	'image/vnd.ms-photo',
	'image/vnd.adobe.photoshop',
	'application/x-indesign',
	'application/epub+zip',
	'application/x-xpinstall',
	'application/vnd.ms-powerpoint.slideshow.macroenabled.12',
	'application/vnd.oasis.opendocument.text',
	'application/vnd.oasis.opendocument.spreadsheet',
	'application/vnd.oasis.opendocument.presentation',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
	'application/zip',
	'application/x-tar',
	'application/x-rar-compressed',
	'application/gzip',
	'application/x-bzip2',
	'application/x-7z-compressed',
	'application/x-apple-diskimage',
	'application/vnd.apache.arrow.file',
	'video/mp4',
	'audio/midi',
	'video/matroska',
	'video/webm',
	'video/quicktime',
	'video/vnd.avi',
	'audio/wav',
	'audio/qcelp',
	'audio/x-ms-asf',
	'video/x-ms-asf',
	'application/vnd.ms-asf',
	'video/mpeg',
	'video/3gpp',
	'audio/mpeg',
	'audio/mp4', // RFC 4337
	'video/ogg',
	'audio/ogg',
	'audio/ogg; codecs=opus',
	'application/ogg',
	'audio/flac',
	'audio/ape',
	'audio/wavpack',
	'audio/amr',
	'application/pdf',
	'application/x-elf',
	'application/x-mach-binary',
	'application/x-msdownload',
	'application/x-shockwave-flash',
	'application/rtf',
	'application/wasm',
	'font/woff',
	'font/woff2',
	'application/vnd.ms-fontobject',
	'font/ttf',
	'font/otf',
	'font/collection',
	'image/x-icon',
	'video/x-flv',
	'application/postscript',
	'application/eps',
	'application/x-xz',
	'application/x-sqlite3',
	'application/x-nintendo-nes-rom',
	'application/x-google-chrome-extension',
	'application/vnd.ms-cab-compressed',
	'application/x-deb',
	'application/x-unix-archive',
	'application/x-rpm',
	'application/x-compress',
	'application/x-lzip',
	'application/x-cfb',
	'application/x-mie',
	'application/mxf',
	'video/mp2t',
	'application/x-blender',
	'image/bpg',
	'image/j2c',
	'image/jp2',
	'image/jpx',
	'image/jpm',
	'image/mj2',
	'audio/aiff',
	'application/xml',
	'application/x-mobipocket-ebook',
	'image/heif',
	'image/heif-sequence',
	'image/heic',
	'image/heic-sequence',
	'image/icns',
	'image/ktx',
	'application/dicom',
	'audio/x-musepack',
	'text/calendar',
	'text/vcard',
	'text/vtt',
	'model/gltf-binary',
	'application/vnd.tcpdump.pcap',
	'audio/x-dsf', // Non-standard
	'application/x.ms.shortcut', // Invented by us
	'application/x.apple.alias', // Invented by us
	'audio/x-voc',
	'audio/vnd.dolby.dd-raw',
	'audio/x-m4a',
	'image/apng',
	'image/x-olympus-orf',
	'image/x-sony-arw',
	'image/x-adobe-dng',
	'image/x-nikon-nef',
	'image/x-panasonic-rw2',
	'image/x-fujifilm-raf',
	'video/x-m4v',
	'video/3gpp2',
	'application/x-esri-shape',
	'audio/aac',
	'audio/x-it',
	'audio/x-s3m',
	'audio/x-xm',
	'video/MP1S',
	'video/MP2P',
	'application/vnd.sketchup.skp',
	'image/avif',
	'application/x-lzh-compressed',
	'application/pgp-encrypted',
	'application/x-asar',
	'model/stl',
	'application/vnd.ms-htmlhelp',
	'model/3mf',
	'image/jxl',
	'application/zstd',
	'image/jls',
	'application/vnd.ms-outlook',
	'image/vnd.dwg',
	'application/vnd.apache.parquet',
	'application/java-vm',
	'application/x-arj',
	'application/x-cpio',
	'application/x-ace-compressed',
	'application/avro',
	'application/vnd.iccprofile',
	'application/x.autodesk.fbx', // Invented by us
	'application/vnd.visio',
	'application/vnd.android.package-archive',
	'application/vnd.google.draco', // Invented by us
	'application/x-lz4', // Invented by us
	'application/vnd.openxmlformats-officedocument.presentationml.template',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
	'application/vnd.ms-excel.template.macroenabled.12',
	'application/vnd.oasis.opendocument.text-template',
	'application/vnd.oasis.opendocument.spreadsheet-template',
	'application/vnd.oasis.opendocument.presentation-template',
	'application/vnd.oasis.opendocument.graphics',
	'application/vnd.oasis.opendocument.graphics-template',
	'application/vnd.ms-excel.sheet.macroenabled.12',
	'application/vnd.ms-word.document.macroenabled.12',
	'application/vnd.ms-word.template.macroenabled.12',
	'application/vnd.ms-powerpoint.template.macroenabled.12',
	'application/vnd.ms-powerpoint.presentation.macroenabled.12',
	'application/java-archive',
	'application/vnd.rn-realmedia',
	'application/x-spss-sav',
	'application/x-ms-regedit',
	'application/x-ft-windows-registry-hive',
	'application/x-jmp-data',
];

/**
Primary entry point, Node.js specific entry point is index.js
*/


const reasonableDetectionSizeInBytes = 4100; // A fair amount of file-types are detectable within this range.
// Keep defensive limits small enough to avoid accidental memory spikes from untrusted inputs.
const maximumMpegOffsetTolerance = reasonableDetectionSizeInBytes - 2;
const maximumZipEntrySizeInBytes = 1024 * 1024;
const maximumZipEntryCount = 1024;
const maximumZipBufferedReadSizeInBytes = (2 ** 31) - 1;
const maximumUntrustedSkipSizeInBytes = 16 * 1024 * 1024;
const maximumUnknownSizePayloadProbeSizeInBytes = maximumZipEntrySizeInBytes;
const maximumZipTextEntrySizeInBytes = maximumZipEntrySizeInBytes;
const maximumNestedGzipDetectionSizeInBytes = maximumUntrustedSkipSizeInBytes;
const maximumNestedGzipProbeDepth = 1;
const unknownSizeGzipProbeTimeoutInMilliseconds = 100;
const maximumId3HeaderSizeInBytes = maximumUntrustedSkipSizeInBytes;
const maximumEbmlDocumentTypeSizeInBytes = 64;
const maximumEbmlElementPayloadSizeInBytes = maximumUnknownSizePayloadProbeSizeInBytes;
const maximumEbmlElementCount = 256;
const maximumPngChunkCount = 512;
const maximumPngStreamScanBudgetInBytes = maximumUntrustedSkipSizeInBytes;
const maximumAsfHeaderObjectCount = 512;
const maximumTiffTagCount = 512;
const maximumDetectionReentryCount = 256;
const maximumPngChunkSizeInBytes = maximumUnknownSizePayloadProbeSizeInBytes;
const maximumAsfHeaderPayloadSizeInBytes = maximumUnknownSizePayloadProbeSizeInBytes;
const maximumTiffStreamIfdOffsetInBytes = maximumUnknownSizePayloadProbeSizeInBytes;
const maximumTiffIfdOffsetInBytes = maximumUntrustedSkipSizeInBytes;
const recoverableZipErrorMessages = new Set([
	'Unexpected signature',
	'Encrypted ZIP',
	'Expected Central-File-Header signature',
]);
const recoverableZipErrorMessagePrefixes = [
	'ZIP entry count exceeds ',
	'Unsupported ZIP compression method:',
	'ZIP entry compressed data exceeds ',
	'ZIP entry decompressed data exceeds ',
	'Expected data-descriptor-signature at position ',
];
const recoverableZipErrorCodes = new Set([
	'Z_BUF_ERROR',
	'Z_DATA_ERROR',
	'ERR_INVALID_STATE',
]);

class ParserHardLimitError extends Error {}

function patchWebByobTokenizerClose(tokenizer) {
	const streamReader = tokenizer?.streamReader;
	if (streamReader?.constructor?.name !== 'WebStreamByobReader') {
		return tokenizer;
	}

	const {reader} = streamReader;
	const cancelAndRelease = async () => {
		await reader.cancel();
		reader.releaseLock();
	};

	streamReader.close = cancelAndRelease;
	streamReader.abort = async () => {
		streamReader.interrupted = true;
		await cancelAndRelease();
	};

	return tokenizer;
}

function getSafeBound(value, maximum, reason) {
	if (
		!Number.isFinite(value)
		|| value < 0
		|| value > maximum
	) {
		throw new ParserHardLimitError(`${reason} has invalid size ${value} (maximum ${maximum} bytes)`);
	}

	return value;
}

async function safeIgnore(tokenizer, length, {maximumLength = maximumUntrustedSkipSizeInBytes, reason = 'skip'} = {}) {
	const safeLength = getSafeBound(length, maximumLength, reason);
	await tokenizer.ignore(safeLength);
}

async function safeReadBuffer(tokenizer, buffer, options, {maximumLength = buffer.length, reason = 'read'} = {}) {
	const length = buffer.length;
	const safeLength = getSafeBound(length, maximumLength, reason);
	return tokenizer.readBuffer(buffer, {
		...options,
		length: safeLength,
	});
}

async function decompressDeflateRawWithLimit(data, {maximumLength = maximumZipEntrySizeInBytes} = {}) {
	const input = new ReadableStream({
		start(controller) {
			controller.enqueue(data);
			controller.close();
		},
	});
	const output = input.pipeThrough(new DecompressionStream('deflate-raw'));
	const reader = output.getReader();
	const chunks = [];
	let totalLength = 0;

	try {
		for (;;) {
			const {done, value} = await reader.read();
			if (done) {
				break;
			}

			totalLength += value.length;
			if (totalLength > maximumLength) {
				await reader.cancel();
				throw new Error(`ZIP entry decompressed data exceeds ${maximumLength} bytes`);
			}

			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const uncompressedData = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		uncompressedData.set(chunk, offset);
		offset += chunk.length;
	}

	return uncompressedData;
}

const zipDataDescriptorSignature = 0x08_07_4B_50;
const zipDataDescriptorLengthInBytes = 16;
const zipDataDescriptorOverlapLengthInBytes = zipDataDescriptorLengthInBytes - 1;

function findZipDataDescriptorOffset(buffer, bytesConsumed) {
	if (buffer.length < zipDataDescriptorLengthInBytes) {
		return -1;
	}

	const lastPossibleDescriptorOffset = buffer.length - zipDataDescriptorLengthInBytes;
	for (let index = 0; index <= lastPossibleDescriptorOffset; index++) {
		if (
			UINT32_LE.get(buffer, index) === zipDataDescriptorSignature
			&& UINT32_LE.get(buffer, index + 8) === bytesConsumed + index
		) {
			return index;
		}
	}

	return -1;
}

function isPngAncillaryChunk(type) {
	return (type.codePointAt(0) & 0x20) !== 0;
}

function mergeByteChunks(chunks, totalLength) {
	const merged = new Uint8Array(totalLength);
	let offset = 0;

	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.length;
	}

	return merged;
}

async function readZipDataDescriptorEntryWithLimit(zipHandler, {shouldBuffer, maximumLength = maximumZipEntrySizeInBytes} = {}) {
	const {syncBuffer} = zipHandler;
	const {length: syncBufferLength} = syncBuffer;
	const chunks = [];
	let bytesConsumed = 0;

	for (;;) {
		const length = await zipHandler.tokenizer.peekBuffer(syncBuffer, {mayBeLess: true});
		const dataDescriptorOffset = findZipDataDescriptorOffset(syncBuffer.subarray(0, length), bytesConsumed);
		const retainedLength = dataDescriptorOffset >= 0
			? 0
			: (
				length === syncBufferLength
					? Math.min(zipDataDescriptorOverlapLengthInBytes, length - 1)
					: 0
			);
		const chunkLength = dataDescriptorOffset >= 0 ? dataDescriptorOffset : length - retainedLength;

		if (chunkLength === 0) {
			break;
		}

		bytesConsumed += chunkLength;
		if (bytesConsumed > maximumLength) {
			throw new Error(`ZIP entry compressed data exceeds ${maximumLength} bytes`);
		}

		if (shouldBuffer) {
			const data = new Uint8Array(chunkLength);
			await zipHandler.tokenizer.readBuffer(data);
			chunks.push(data);
		} else {
			await zipHandler.tokenizer.ignore(chunkLength);
		}

		if (dataDescriptorOffset >= 0) {
			break;
		}
	}

	if (!hasUnknownFileSize(zipHandler.tokenizer)) {
		zipHandler.knownSizeDescriptorScannedBytes += bytesConsumed;
	}

	if (!shouldBuffer) {
		return;
	}

	return mergeByteChunks(chunks, bytesConsumed);
}

function getRemainingZipScanBudget(zipHandler, startOffset) {
	if (hasUnknownFileSize(zipHandler.tokenizer)) {
		return Math.max(0, maximumUntrustedSkipSizeInBytes - (zipHandler.tokenizer.position - startOffset));
	}

	return Math.max(0, maximumZipEntrySizeInBytes - zipHandler.knownSizeDescriptorScannedBytes);
}

async function readZipEntryData(zipHandler, zipHeader, {shouldBuffer, maximumDescriptorLength = maximumZipEntrySizeInBytes} = {}) {
	if (
		zipHeader.dataDescriptor
		&& zipHeader.compressedSize === 0
	) {
		return readZipDataDescriptorEntryWithLimit(zipHandler, {
			shouldBuffer,
			maximumLength: maximumDescriptorLength,
		});
	}

	if (!shouldBuffer) {
		await safeIgnore(zipHandler.tokenizer, zipHeader.compressedSize, {
			maximumLength: hasUnknownFileSize(zipHandler.tokenizer) ? maximumZipEntrySizeInBytes : zipHandler.tokenizer.fileInfo.size,
			reason: 'ZIP entry compressed data',
		});
		return;
	}

	const maximumLength = getMaximumZipBufferedReadLength(zipHandler.tokenizer);
	if (
		!Number.isFinite(zipHeader.compressedSize)
		|| zipHeader.compressedSize < 0
		|| zipHeader.compressedSize > maximumLength
	) {
		throw new Error(`ZIP entry compressed data exceeds ${maximumLength} bytes`);
	}

	const fileData = new Uint8Array(zipHeader.compressedSize);
	await zipHandler.tokenizer.readBuffer(fileData);
	return fileData;
}

// Override the default inflate to enforce decompression size limits, since @tokenizer/inflate does not expose a configuration hook for this.
ZipHandler.prototype.inflate = async function (zipHeader, fileData, callback) {
	if (zipHeader.compressedMethod === 0) {
		return callback(fileData);
	}

	if (zipHeader.compressedMethod !== 8) {
		throw new Error(`Unsupported ZIP compression method: ${zipHeader.compressedMethod}`);
	}

	const uncompressedData = await decompressDeflateRawWithLimit(fileData, {maximumLength: maximumZipEntrySizeInBytes});
	return callback(uncompressedData);
};

ZipHandler.prototype.unzip = async function (fileCallback) {
	let stop = false;
	let zipEntryCount = 0;
	const zipScanStart = this.tokenizer.position;
	this.knownSizeDescriptorScannedBytes = 0;
	do {
		if (hasExceededUnknownSizeScanBudget(this.tokenizer, zipScanStart, maximumUntrustedSkipSizeInBytes)) {
			throw new ParserHardLimitError(`ZIP stream probing exceeds ${maximumUntrustedSkipSizeInBytes} bytes`);
		}

		const zipHeader = await this.readLocalFileHeader();
		if (!zipHeader) {
			break;
		}

		zipEntryCount++;
		if (zipEntryCount > maximumZipEntryCount) {
			throw new Error(`ZIP entry count exceeds ${maximumZipEntryCount}`);
		}

		const next = fileCallback(zipHeader);
		stop = Boolean(next.stop);
		await this.tokenizer.ignore(zipHeader.extraFieldLength);
		const fileData = await readZipEntryData(this, zipHeader, {
			shouldBuffer: Boolean(next.handler),
			maximumDescriptorLength: Math.min(maximumZipEntrySizeInBytes, getRemainingZipScanBudget(this, zipScanStart)),
		});

		if (next.handler) {
			await this.inflate(zipHeader, fileData, next.handler);
		}

		if (zipHeader.dataDescriptor) {
			const dataDescriptor = new Uint8Array(zipDataDescriptorLengthInBytes);
			await this.tokenizer.readBuffer(dataDescriptor);
			if (UINT32_LE.get(dataDescriptor, 0) !== zipDataDescriptorSignature) {
				throw new Error(`Expected data-descriptor-signature at position ${this.tokenizer.position - dataDescriptor.length}`);
			}
		}

		if (hasExceededUnknownSizeScanBudget(this.tokenizer, zipScanStart, maximumUntrustedSkipSizeInBytes)) {
			throw new ParserHardLimitError(`ZIP stream probing exceeds ${maximumUntrustedSkipSizeInBytes} bytes`);
		}
	} while (!stop);
};

function createByteLimitedReadableStream(stream, maximumBytes) {
	const reader = stream.getReader();
	let emittedBytes = 0;
	let sourceDone = false;
	let sourceCanceled = false;

	const cancelSource = async reason => {
		if (
			sourceDone
			|| sourceCanceled
		) {
			return;
		}

		sourceCanceled = true;
		await reader.cancel(reason);
	};

	return new ReadableStream({
		async pull(controller) {
			if (emittedBytes >= maximumBytes) {
				controller.close();
				await cancelSource();
				return;
			}

			const {done, value} = await reader.read();
			if (
				done
				|| !value
			) {
				sourceDone = true;
				controller.close();
				return;
			}

			const remainingBytes = maximumBytes - emittedBytes;
			if (value.length > remainingBytes) {
				controller.enqueue(value.subarray(0, remainingBytes));
				emittedBytes += remainingBytes;
				controller.close();
				await cancelSource();
				return;
			}

			controller.enqueue(value);
			emittedBytes += value.length;
		},
		async cancel(reason) {
			await cancelSource(reason);
		},
	});
}

async function fileTypeFromBuffer(input, options) {
	return new FileTypeParser(options).fromBuffer(input);
}

function getFileTypeFromMimeType(mimeType) {
	mimeType = mimeType.toLowerCase();
	switch (mimeType) {
		case 'application/epub+zip':
			return {
				ext: 'epub',
				mime: mimeType,
			};
		case 'application/vnd.oasis.opendocument.text':
			return {
				ext: 'odt',
				mime: mimeType,
			};
		case 'application/vnd.oasis.opendocument.text-template':
			return {
				ext: 'ott',
				mime: mimeType,
			};
		case 'application/vnd.oasis.opendocument.spreadsheet':
			return {
				ext: 'ods',
				mime: mimeType,
			};
		case 'application/vnd.oasis.opendocument.spreadsheet-template':
			return {
				ext: 'ots',
				mime: mimeType,
			};
		case 'application/vnd.oasis.opendocument.presentation':
			return {
				ext: 'odp',
				mime: mimeType,
			};
		case 'application/vnd.oasis.opendocument.presentation-template':
			return {
				ext: 'otp',
				mime: mimeType,
			};
		case 'application/vnd.oasis.opendocument.graphics':
			return {
				ext: 'odg',
				mime: mimeType,
			};
		case 'application/vnd.oasis.opendocument.graphics-template':
			return {
				ext: 'otg',
				mime: mimeType,
			};
		case 'application/vnd.openxmlformats-officedocument.presentationml.slideshow':
			return {
				ext: 'ppsx',
				mime: mimeType,
			};
		case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
			return {
				ext: 'xlsx',
				mime: mimeType,
			};
		case 'application/vnd.ms-excel.sheet.macroenabled':
			return {
				ext: 'xlsm',
				mime: 'application/vnd.ms-excel.sheet.macroenabled.12',
			};
		case 'application/vnd.openxmlformats-officedocument.spreadsheetml.template':
			return {
				ext: 'xltx',
				mime: mimeType,
			};
		case 'application/vnd.ms-excel.template.macroenabled':
			return {
				ext: 'xltm',
				mime: 'application/vnd.ms-excel.template.macroenabled.12',
			};
		case 'application/vnd.ms-powerpoint.slideshow.macroenabled':
			return {
				ext: 'ppsm',
				mime: 'application/vnd.ms-powerpoint.slideshow.macroenabled.12',
			};
		case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
			return {
				ext: 'docx',
				mime: mimeType,
			};
		case 'application/vnd.ms-word.document.macroenabled':
			return {
				ext: 'docm',
				mime: 'application/vnd.ms-word.document.macroenabled.12',
			};
		case 'application/vnd.openxmlformats-officedocument.wordprocessingml.template':
			return {
				ext: 'dotx',
				mime: mimeType,
			};
		case 'application/vnd.ms-word.template.macroenabledtemplate':
			return {
				ext: 'dotm',
				mime: 'application/vnd.ms-word.template.macroenabled.12',
			};
		case 'application/vnd.openxmlformats-officedocument.presentationml.template':
			return {
				ext: 'potx',
				mime: mimeType,
			};
		case 'application/vnd.ms-powerpoint.template.macroenabled':
			return {
				ext: 'potm',
				mime: 'application/vnd.ms-powerpoint.template.macroenabled.12',
			};
		case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
			return {
				ext: 'pptx',
				mime: mimeType,
			};
		case 'application/vnd.ms-powerpoint.presentation.macroenabled':
			return {
				ext: 'pptm',
				mime: 'application/vnd.ms-powerpoint.presentation.macroenabled.12',
			};
		case 'application/vnd.ms-visio.drawing':
			return {
				ext: 'vsdx',
				mime: 'application/vnd.visio',
			};
		case 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml':
			return {
				ext: '3mf',
				mime: 'model/3mf',
			};
	}
}

function _check(buffer, headers, options) {
	options = {
		offset: 0,
		...options,
	};

	for (const [index, header] of headers.entries()) {
		// If a bitmask is set
		if (options.mask) {
			// If header doesn't equal `buf` with bits masked off
			if (header !== (options.mask[index] & buffer[index + options.offset])) {
				return false;
			}
		} else if (header !== buffer[index + options.offset]) {
			return false;
		}
	}

	return true;
}

function normalizeSampleSize(sampleSize) {
	// `sampleSize` is an explicit caller-controlled tuning knob, not untrusted file input.
	// Preserve valid caller-requested probe depth here; applications must bound attacker-derived option values themselves.
	if (!Number.isFinite(sampleSize)) {
		return reasonableDetectionSizeInBytes;
	}

	return Math.max(1, Math.trunc(sampleSize));
}

function readByobReaderWithSignal(reader, buffer, signal) {
	if (signal === undefined) {
		return reader.read(buffer);
	}

	signal.throwIfAborted();

	return new Promise((resolve, reject) => {
		const cleanup = () => {
			signal.removeEventListener('abort', onAbort);
		};

		const onAbort = () => {
			const abortReason = signal.reason;
			cleanup();

			(async () => {
				try {
					await reader.cancel(abortReason);
				} catch {}
			})();

			reject(abortReason);
		};

		signal.addEventListener('abort', onAbort, {once: true});
		(async () => {
			try {
				const result = await reader.read(buffer);
				cleanup();
				resolve(result);
			} catch (error) {
				cleanup();
				reject(error);
			}
		})();
	});
}

function normalizeMpegOffsetTolerance(mpegOffsetTolerance) {
	// This value controls scan depth and therefore worst-case CPU work.
	if (!Number.isFinite(mpegOffsetTolerance)) {
		return 0;
	}

	return Math.max(0, Math.min(maximumMpegOffsetTolerance, Math.trunc(mpegOffsetTolerance)));
}

function getKnownFileSizeOrMaximum(fileSize) {
	if (!Number.isFinite(fileSize)) {
		return Number.MAX_SAFE_INTEGER;
	}

	return Math.max(0, fileSize);
}

function hasUnknownFileSize(tokenizer) {
	const fileSize = tokenizer.fileInfo.size;
	return (
		!Number.isFinite(fileSize)
		|| fileSize === Number.MAX_SAFE_INTEGER
	);
}

function hasExceededUnknownSizeScanBudget(tokenizer, startOffset, maximumBytes) {
	return (
		hasUnknownFileSize(tokenizer)
		&& tokenizer.position - startOffset > maximumBytes
	);
}

function getMaximumZipBufferedReadLength(tokenizer) {
	const fileSize = tokenizer.fileInfo.size;
	const remainingBytes = Number.isFinite(fileSize)
		? Math.max(0, fileSize - tokenizer.position)
		: Number.MAX_SAFE_INTEGER;

	return Math.min(remainingBytes, maximumZipBufferedReadSizeInBytes);
}

function isRecoverableZipError(error) {
	if (error instanceof EndOfStreamError) {
		return true;
	}

	if (error instanceof ParserHardLimitError) {
		return true;
	}

	if (!(error instanceof Error)) {
		return false;
	}

	if (recoverableZipErrorMessages.has(error.message)) {
		return true;
	}

	if (recoverableZipErrorCodes.has(error.code)) {
		return true;
	}

	for (const prefix of recoverableZipErrorMessagePrefixes) {
		if (error.message.startsWith(prefix)) {
			return true;
		}
	}

	return false;
}

function canReadZipEntryForDetection(zipHeader, maximumSize = maximumZipEntrySizeInBytes) {
	const sizes = [zipHeader.compressedSize, zipHeader.uncompressedSize];
	for (const size of sizes) {
		if (
			!Number.isFinite(size)
			|| size < 0
			|| size > maximumSize
		) {
			return false;
		}
	}

	return true;
}

function createOpenXmlZipDetectionState() {
	return {
		hasContentTypesEntry: false,
		hasParsedContentTypesEntry: false,
		isParsingContentTypes: false,
		hasUnparseableContentTypes: false,
		hasWordDirectory: false,
		hasPresentationDirectory: false,
		hasSpreadsheetDirectory: false,
		hasThreeDimensionalModelEntry: false,
	};
}

function updateOpenXmlZipDetectionStateFromFilename(openXmlState, filename) {
	if (filename.startsWith('word/')) {
		openXmlState.hasWordDirectory = true;
	}

	if (filename.startsWith('ppt/')) {
		openXmlState.hasPresentationDirectory = true;
	}

	if (filename.startsWith('xl/')) {
		openXmlState.hasSpreadsheetDirectory = true;
	}

	if (
		filename.startsWith('3D/')
		&& filename.endsWith('.model')
	) {
		openXmlState.hasThreeDimensionalModelEntry = true;
	}
}

function getOpenXmlFileTypeFromZipEntries(openXmlState) {
	// Only use directory-name heuristic when [Content_Types].xml was present in the archive
	// but its handler was skipped (not invoked, not currently running, and not already resolved).
	// This avoids guessing from directory names when content-type parsing already gave a definitive answer or failed.
	if (
		!openXmlState.hasContentTypesEntry
		|| openXmlState.hasUnparseableContentTypes
		|| openXmlState.isParsingContentTypes
		|| openXmlState.hasParsedContentTypesEntry
	) {
		return;
	}

	if (openXmlState.hasWordDirectory) {
		return {
			ext: 'docx',
			mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		};
	}

	if (openXmlState.hasPresentationDirectory) {
		return {
			ext: 'pptx',
			mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		};
	}

	if (openXmlState.hasSpreadsheetDirectory) {
		return {
			ext: 'xlsx',
			mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		};
	}

	if (openXmlState.hasThreeDimensionalModelEntry) {
		return {
			ext: '3mf',
			mime: 'model/3mf',
		};
	}
}

function getOpenXmlMimeTypeFromContentTypesXml(xmlContent) {
	// We only need the `ContentType="...main+xml"` value, so a small string scan is enough and avoids full XML parsing.
	const endPosition = xmlContent.indexOf('.main+xml"');
	if (endPosition === -1) {
		const mimeType = 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml';
		if (xmlContent.includes(`ContentType="${mimeType}"`)) {
			return mimeType;
		}

		return;
	}

	const truncatedContent = xmlContent.slice(0, endPosition);
	const firstQuotePosition = truncatedContent.lastIndexOf('"');
	// If no quote is found, `lastIndexOf` returns -1 and this intentionally falls back to the full truncated prefix.
	return truncatedContent.slice(firstQuotePosition + 1);
}

class FileTypeParser {
	constructor(options) {
		const normalizedMpegOffsetTolerance = normalizeMpegOffsetTolerance(options?.mpegOffsetTolerance);
		this.options = {
			...options,
			mpegOffsetTolerance: normalizedMpegOffsetTolerance,
		};

		this.detectors = [...(this.options.customDetectors ?? []),
			{id: 'core', detect: this.detectConfident},
			{id: 'core.imprecise', detect: this.detectImprecise}];
		this.tokenizerOptions = {
			abortSignal: this.options.signal,
		};
		this.gzipProbeDepth = 0;
	}

	getTokenizerOptions() {
		return {
			...this.tokenizerOptions,
		};
	}

	createTokenizerFromWebStream(stream) {
		return patchWebByobTokenizerClose(fromWebStream(stream, this.getTokenizerOptions()));
	}

	async parseTokenizer(tokenizer, detectionReentryCount = 0) {
		this.detectionReentryCount = detectionReentryCount;
		const initialPosition = tokenizer.position;
		// Iterate through all file-type detectors
		for (const detector of this.detectors) {
			let fileType;
			try {
				fileType = await detector.detect(tokenizer);
			} catch (error) {
				if (error instanceof EndOfStreamError) {
					return;
				}

				if (error instanceof ParserHardLimitError) {
					return;
				}

				throw error;
			}

			if (fileType) {
				return fileType;
			}

			if (initialPosition !== tokenizer.position) {
				return undefined; // Cannot proceed scanning of the tokenizer is at an arbitrary position
			}
		}
	}

	async fromTokenizer(tokenizer) {
		try {
			return await this.parseTokenizer(tokenizer);
		} finally {
			await tokenizer.close();
		}
	}

	async fromBuffer(input) {
		if (!(input instanceof Uint8Array || input instanceof ArrayBuffer)) {
			throw new TypeError(`Expected the \`input\` argument to be of type \`Uint8Array\` or \`ArrayBuffer\`, got \`${typeof input}\``);
		}

		const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);

		if (!(buffer?.length > 1)) {
			return;
		}

		return this.fromTokenizer(fromBuffer(buffer, this.getTokenizerOptions()));
	}

	async fromBlob(blob) {
		this.options.signal?.throwIfAborted();
		const tokenizer = fromBlob(blob, this.getTokenizerOptions());
		return this.fromTokenizer(tokenizer);
	}

	async fromStream(stream) {
		this.options.signal?.throwIfAborted();
		const tokenizer = this.createTokenizerFromWebStream(stream);
		return this.fromTokenizer(tokenizer);
	}

	async toDetectionStream(stream, options) {
		const sampleSize = normalizeSampleSize(options?.sampleSize ?? reasonableDetectionSizeInBytes);
		let detectedFileType;
		let firstChunk;

		const reader = stream.getReader({mode: 'byob'});
		try {
			// Read the first chunk from the stream
			const {value: chunk, done} = await readByobReaderWithSignal(reader, new Uint8Array(sampleSize), this.options.signal);
			firstChunk = chunk;
			if (!done && chunk) {
				try {
					// Attempt to detect the file type from the chunk
					detectedFileType = await this.fromBuffer(chunk.subarray(0, sampleSize));
				} catch (error) {
					if (!(error instanceof EndOfStreamError)) {
						throw error; // Re-throw non-EndOfStreamError
					}

					detectedFileType = undefined;
				}
			}

			firstChunk = chunk;
		} finally {
			reader.releaseLock(); // Ensure the reader is released
		}

		// Create a new ReadableStream to manage locking issues
		const transformStream = new TransformStream({
			async start(controller) {
				controller.enqueue(firstChunk); // Enqueue the initial chunk
			},
			transform(chunk, controller) {
				// Pass through the chunks without modification
				controller.enqueue(chunk);
			},
		});

		const newStream = stream.pipeThrough(transformStream);
		newStream.fileType = detectedFileType;

		return newStream;
	}

	async detectGzip(tokenizer) {
		if (this.gzipProbeDepth >= maximumNestedGzipProbeDepth) {
			return {
				ext: 'gz',
				mime: 'application/gzip',
			};
		}

		const gzipHandler = new GzipHandler(tokenizer);
		const limitedInflatedStream = createByteLimitedReadableStream(gzipHandler.inflate(), maximumNestedGzipDetectionSizeInBytes);
		const hasUnknownSize = hasUnknownFileSize(tokenizer);
		let timeout;
		let probeSignal;
		let probeParser;
		let compressedFileType;

		if (hasUnknownSize) {
			const timeoutController = new AbortController();
			timeout = setTimeout(() => {
				timeoutController.abort(new DOMException(`Operation timed out after ${unknownSizeGzipProbeTimeoutInMilliseconds} ms`, 'TimeoutError'));
			}, unknownSizeGzipProbeTimeoutInMilliseconds);
			probeSignal = this.options.signal === undefined
				? timeoutController.signal
				// eslint-disable-next-line n/no-unsupported-features/node-builtins
				: AbortSignal.any([this.options.signal, timeoutController.signal]);
			probeParser = new FileTypeParser({
				...this.options,
				signal: probeSignal,
			});
			probeParser.gzipProbeDepth = this.gzipProbeDepth + 1;
		} else {
			this.gzipProbeDepth++;
		}

		try {
			compressedFileType = await (probeParser ?? this).fromStream(limitedInflatedStream);
		} catch (error) {
			if (
				error?.name === 'AbortError'
				&& probeSignal?.reason?.name !== 'TimeoutError'
			) {
				throw error;
			}

			// Timeout, decompression, or inner-detection failures are expected for non-tar gzip files.
		} finally {
			clearTimeout(timeout);
			if (!hasUnknownSize) {
				this.gzipProbeDepth--;
			}
		}

		if (compressedFileType?.ext === 'tar') {
			return {
				ext: 'tar.gz',
				mime: 'application/gzip',
			};
		}

		return {
			ext: 'gz',
			mime: 'application/gzip',
		};
	}

	check(header, options) {
		return _check(this.buffer, header, options);
	}

	checkString(header, options) {
		return this.check(stringToBytes(header, options?.encoding), options);
	}

	// Detections with a high degree of certainty in identifying the correct file type
	detectConfident = async tokenizer => {
		this.buffer = new Uint8Array(reasonableDetectionSizeInBytes);

		// Keep reading until EOF if the file size is unknown.
		if (tokenizer.fileInfo.size === undefined) {
			tokenizer.fileInfo.size = Number.MAX_SAFE_INTEGER;
		}

		this.tokenizer = tokenizer;

		if (hasUnknownFileSize(tokenizer)) {
			await tokenizer.peekBuffer(this.buffer, {length: 3, mayBeLess: true});
			if (this.check([0x1F, 0x8B, 0x8])) {
				return this.detectGzip(tokenizer);
			}
		}

		await tokenizer.peekBuffer(this.buffer, {length: 32, mayBeLess: true});

		// -- 2-byte signatures --

		if (this.check([0x42, 0x4D])) {
			return {
				ext: 'bmp',
				mime: 'image/bmp',
			};
		}

		if (this.check([0x0B, 0x77])) {
			return {
				ext: 'ac3',
				mime: 'audio/vnd.dolby.dd-raw',
			};
		}

		if (this.check([0x78, 0x01])) {
			return {
				ext: 'dmg',
				mime: 'application/x-apple-diskimage',
			};
		}

		if (this.check([0x4D, 0x5A])) {
			return {
				ext: 'exe',
				mime: 'application/x-msdownload',
			};
		}

		if (this.check([0x25, 0x21])) {
			await tokenizer.peekBuffer(this.buffer, {length: 24, mayBeLess: true});

			if (
				this.checkString('PS-Adobe-', {offset: 2})
				&& this.checkString(' EPSF-', {offset: 14})
			) {
				return {
					ext: 'eps',
					mime: 'application/eps',
				};
			}

			return {
				ext: 'ps',
				mime: 'application/postscript',
			};
		}

		if (
			this.check([0x1F, 0xA0])
			|| this.check([0x1F, 0x9D])
		) {
			return {
				ext: 'Z',
				mime: 'application/x-compress',
			};
		}

		if (this.check([0xC7, 0x71])) {
			return {
				ext: 'cpio',
				mime: 'application/x-cpio',
			};
		}

		if (this.check([0x60, 0xEA])) {
			return {
				ext: 'arj',
				mime: 'application/x-arj',
			};
		}

		// -- 3-byte signatures --

		if (this.check([0xEF, 0xBB, 0xBF])) { // UTF-8-BOM
			if (this.detectionReentryCount >= maximumDetectionReentryCount) {
				return;
			}

			this.detectionReentryCount++;
			// Strip off UTF-8-BOM
			await this.tokenizer.ignore(3);
			return this.detectConfident(tokenizer);
		}

		if (this.check([0x47, 0x49, 0x46])) {
			return {
				ext: 'gif',
				mime: 'image/gif',
			};
		}

		if (this.check([0x49, 0x49, 0xBC])) {
			return {
				ext: 'jxr',
				mime: 'image/vnd.ms-photo',
			};
		}

		if (this.check([0x1F, 0x8B, 0x8])) {
			return this.detectGzip(tokenizer);
		}

		if (this.check([0x42, 0x5A, 0x68])) {
			return {
				ext: 'bz2',
				mime: 'application/x-bzip2',
			};
		}

		if (this.checkString('ID3')) {
			await safeIgnore(tokenizer, 6, {
				maximumLength: 6,
				reason: 'ID3 header prefix',
			}); // Skip ID3 header until the header size
			const id3HeaderLength = await tokenizer.readToken(uint32SyncSafeToken);
			const isUnknownFileSize = hasUnknownFileSize(tokenizer);
			if (
				!Number.isFinite(id3HeaderLength)
					|| id3HeaderLength < 0
				// Keep ID3 probing bounded for unknown-size streams to avoid attacker-controlled large skips.
				|| (
					isUnknownFileSize
					&& (
						id3HeaderLength > maximumId3HeaderSizeInBytes
						|| (tokenizer.position + id3HeaderLength) > maximumId3HeaderSizeInBytes
					)
				)
			) {
				return;
			}

			if (tokenizer.position + id3HeaderLength > tokenizer.fileInfo.size) {
				if (isUnknownFileSize) {
					return;
				}

				return {
					ext: 'mp3',
					mime: 'audio/mpeg',
				};
			}

			try {
				await safeIgnore(tokenizer, id3HeaderLength, {
					maximumLength: isUnknownFileSize ? maximumId3HeaderSizeInBytes : tokenizer.fileInfo.size,
					reason: 'ID3 payload',
				});
			} catch (error) {
				if (error instanceof EndOfStreamError) {
					return;
				}

				throw error;
			}

			if (this.detectionReentryCount >= maximumDetectionReentryCount) {
				return;
			}

			this.detectionReentryCount++;
			return this.parseTokenizer(tokenizer, this.detectionReentryCount); // Skip ID3 header, recursion
		}

		// Musepack, SV7
		if (this.checkString('MP+')) {
			return {
				ext: 'mpc',
				mime: 'audio/x-musepack',
			};
		}

		if (
			(this.buffer[0] === 0x43 || this.buffer[0] === 0x46)
			&& this.check([0x57, 0x53], {offset: 1})
		) {
			return {
				ext: 'swf',
				mime: 'application/x-shockwave-flash',
			};
		}

		// -- 4-byte signatures --

		// Requires a sample size of 4 bytes
		if (this.check([0xFF, 0xD8, 0xFF])) {
			if (this.check([0xF7], {offset: 3})) { // JPG7/SOF55, indicating a ISO/IEC 14495 / JPEG-LS file
				return {
					ext: 'jls',
					mime: 'image/jls',
				};
			}

			return {
				ext: 'jpg',
				mime: 'image/jpeg',
			};
		}

		if (this.check([0x4F, 0x62, 0x6A, 0x01])) {
			return {
				ext: 'avro',
				mime: 'application/avro',
			};
		}

		if (this.checkString('FLIF')) {
			return {
				ext: 'flif',
				mime: 'image/flif',
			};
		}

		if (this.checkString('8BPS')) {
			return {
				ext: 'psd',
				mime: 'image/vnd.adobe.photoshop',
			};
		}

		// Musepack, SV8
		if (this.checkString('MPCK')) {
			return {
				ext: 'mpc',
				mime: 'audio/x-musepack',
			};
		}

		if (this.checkString('FORM')) {
			return {
				ext: 'aif',
				mime: 'audio/aiff',
			};
		}

		if (this.checkString('icns', {offset: 0})) {
			return {
				ext: 'icns',
				mime: 'image/icns',
			};
		}

		// Zip-based file formats
		// Need to be before the `zip` check
		if (this.check([0x50, 0x4B, 0x3, 0x4])) { // Local file header signature
			let fileType;
			const openXmlState = createOpenXmlZipDetectionState();

			try {
				await new ZipHandler(tokenizer).unzip(zipHeader => {
					updateOpenXmlZipDetectionStateFromFilename(openXmlState, zipHeader.filename);

					const isOpenXmlContentTypesEntry = zipHeader.filename === '[Content_Types].xml';
					const openXmlFileTypeFromEntries = getOpenXmlFileTypeFromZipEntries(openXmlState);
					if (
						!isOpenXmlContentTypesEntry
						&& openXmlFileTypeFromEntries
					) {
						fileType = openXmlFileTypeFromEntries;
						return {
							stop: true,
						};
					}

					switch (zipHeader.filename) {
						case 'META-INF/mozilla.rsa':
							fileType = {
								ext: 'xpi',
								mime: 'application/x-xpinstall',
							};
							return {
								stop: true,
							};
						case 'META-INF/MANIFEST.MF':
							fileType = {
								ext: 'jar',
								mime: 'application/java-archive',
							};
							return {
								stop: true,
							};
						case 'mimetype':
							if (!canReadZipEntryForDetection(zipHeader, maximumZipTextEntrySizeInBytes)) {
								return {};
							}

							return {
								async handler(fileData) {
									// Use TextDecoder to decode the UTF-8 encoded data
									const mimeType = new TextDecoder('utf-8').decode(fileData).trim();
									fileType = getFileTypeFromMimeType(mimeType);
								},
								stop: true,
							};

						case '[Content_Types].xml': {
							openXmlState.hasContentTypesEntry = true;

							if (!canReadZipEntryForDetection(zipHeader, maximumZipTextEntrySizeInBytes)) {
								openXmlState.hasUnparseableContentTypes = true;
								return {};
							}

							openXmlState.isParsingContentTypes = true;
							return {
								async handler(fileData) {
									// Use TextDecoder to decode the UTF-8 encoded data
									const xmlContent = new TextDecoder('utf-8').decode(fileData);
									const mimeType = getOpenXmlMimeTypeFromContentTypesXml(xmlContent);
									if (mimeType) {
										fileType = getFileTypeFromMimeType(mimeType);
									}

									openXmlState.hasParsedContentTypesEntry = true;
									openXmlState.isParsingContentTypes = false;
								},
								stop: true,
							};
						}

						default:
							if (/classes\d*\.dex/.test(zipHeader.filename)) {
								fileType = {
									ext: 'apk',
									mime: 'application/vnd.android.package-archive',
								};
								return {stop: true};
							}

							return {};
					}
				});
			} catch (error) {
				if (!isRecoverableZipError(error)) {
					throw error;
				}

				if (openXmlState.isParsingContentTypes) {
					openXmlState.isParsingContentTypes = false;
					openXmlState.hasUnparseableContentTypes = true;
				}
			}

			return fileType ?? getOpenXmlFileTypeFromZipEntries(openXmlState) ?? {
				ext: 'zip',
				mime: 'application/zip',
			};
		}

		if (this.checkString('OggS')) {
			// This is an OGG container
			await tokenizer.ignore(28);
			const type = new Uint8Array(8);
			await tokenizer.readBuffer(type);

			// Needs to be before `ogg` check
			if (_check(type, [0x4F, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64])) {
				return {
					ext: 'opus',
					mime: 'audio/ogg; codecs=opus',
				};
			}

			// If ' theora' in header.
			if (_check(type, [0x80, 0x74, 0x68, 0x65, 0x6F, 0x72, 0x61])) {
				return {
					ext: 'ogv',
					mime: 'video/ogg',
				};
			}

			// If '\x01video' in header.
			if (_check(type, [0x01, 0x76, 0x69, 0x64, 0x65, 0x6F, 0x00])) {
				return {
					ext: 'ogm',
					mime: 'video/ogg',
				};
			}

			// If ' FLAC' in header  https://xiph.org/flac/faq.html
			if (_check(type, [0x7F, 0x46, 0x4C, 0x41, 0x43])) {
				return {
					ext: 'oga',
					mime: 'audio/ogg',
				};
			}

			// 'Speex  ' in header https://en.wikipedia.org/wiki/Speex
			if (_check(type, [0x53, 0x70, 0x65, 0x65, 0x78, 0x20, 0x20])) {
				return {
					ext: 'spx',
					mime: 'audio/ogg',
				};
			}

			// If '\x01vorbis' in header
			if (_check(type, [0x01, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73])) {
				return {
					ext: 'ogg',
					mime: 'audio/ogg',
				};
			}

			// Default OGG container https://www.iana.org/assignments/media-types/application/ogg
			return {
				ext: 'ogx',
				mime: 'application/ogg',
			};
		}

		if (
			this.check([0x50, 0x4B])
			&& (this.buffer[2] === 0x3 || this.buffer[2] === 0x5 || this.buffer[2] === 0x7)
			&& (this.buffer[3] === 0x4 || this.buffer[3] === 0x6 || this.buffer[3] === 0x8)
		) {
			return {
				ext: 'zip',
				mime: 'application/zip',
			};
		}

		if (this.checkString('MThd')) {
			return {
				ext: 'mid',
				mime: 'audio/midi',
			};
		}

		if (
			this.checkString('wOFF')
			&& (
				this.check([0x00, 0x01, 0x00, 0x00], {offset: 4})
				|| this.checkString('OTTO', {offset: 4})
			)
		) {
			return {
				ext: 'woff',
				mime: 'font/woff',
			};
		}

		if (
			this.checkString('wOF2')
			&& (
				this.check([0x00, 0x01, 0x00, 0x00], {offset: 4})
				|| this.checkString('OTTO', {offset: 4})
			)
		) {
			return {
				ext: 'woff2',
				mime: 'font/woff2',
			};
		}

		if (this.check([0xD4, 0xC3, 0xB2, 0xA1]) || this.check([0xA1, 0xB2, 0xC3, 0xD4])) {
			return {
				ext: 'pcap',
				mime: 'application/vnd.tcpdump.pcap',
			};
		}

		// Sony DSD Stream File (DSF)
		if (this.checkString('DSD ')) {
			return {
				ext: 'dsf',
				mime: 'audio/x-dsf', // Non-standard
			};
		}

		if (this.checkString('LZIP')) {
			return {
				ext: 'lz',
				mime: 'application/x-lzip',
			};
		}

		if (this.checkString('fLaC')) {
			return {
				ext: 'flac',
				mime: 'audio/flac',
			};
		}

		if (this.check([0x42, 0x50, 0x47, 0xFB])) {
			return {
				ext: 'bpg',
				mime: 'image/bpg',
			};
		}

		if (this.checkString('wvpk')) {
			return {
				ext: 'wv',
				mime: 'audio/wavpack',
			};
		}

		if (this.checkString('%PDF')) {
			// Assume this is just a normal PDF
			return {
				ext: 'pdf',
				mime: 'application/pdf',
			};
		}

		if (this.check([0x00, 0x61, 0x73, 0x6D])) {
			return {
				ext: 'wasm',
				mime: 'application/wasm',
			};
		}

		// TIFF, little-endian type
		if (this.check([0x49, 0x49])) {
			const fileType = await this.readTiffHeader(false);
			if (fileType) {
				return fileType;
			}
		}

		// TIFF, big-endian type
		if (this.check([0x4D, 0x4D])) {
			const fileType = await this.readTiffHeader(true);
			if (fileType) {
				return fileType;
			}
		}

		if (this.checkString('MAC ')) {
			return {
				ext: 'ape',
				mime: 'audio/ape',
			};
		}

		// https://github.com/file/file/blob/master/magic/Magdir/matroska
		if (this.check([0x1A, 0x45, 0xDF, 0xA3])) { // Root element: EBML
			async function readField() {
				const msb = await tokenizer.peekNumber(UINT8);
				let mask = 0x80;
				let ic = 0; // 0 = A, 1 = B, 2 = C, 3 = D

				while ((msb & mask) === 0 && mask !== 0) {
					++ic;
					mask >>= 1;
				}

				const id = new Uint8Array(ic + 1);
				await safeReadBuffer(tokenizer, id, undefined, {
					maximumLength: id.length,
					reason: 'EBML field',
				});
				return id;
			}

			async function readElement() {
				const idField = await readField();
				const lengthField = await readField();

				lengthField[0] ^= 0x80 >> (lengthField.length - 1);
				const nrLength = Math.min(6, lengthField.length); // JavaScript can max read 6 bytes integer

				const idView = new DataView(idField.buffer);
				const lengthView = new DataView(lengthField.buffer, lengthField.length - nrLength, nrLength);

				return {
					id: getUintBE(idView),
					len: getUintBE(lengthView),
				};
			}

			async function readChildren(children) {
				let ebmlElementCount = 0;
				while (children > 0) {
					ebmlElementCount++;
					if (ebmlElementCount > maximumEbmlElementCount) {
						return;
					}

					if (hasExceededUnknownSizeScanBudget(tokenizer, ebmlScanStart, maximumUntrustedSkipSizeInBytes)) {
						return;
					}

					const previousPosition = tokenizer.position;
					const element = await readElement();

					if (element.id === 0x42_82) {
						// `DocType` is a short string ("webm", "matroska", ...), reject implausible lengths to avoid large allocations.
						if (element.len > maximumEbmlDocumentTypeSizeInBytes) {
							return;
						}

						const documentTypeLength = getSafeBound(element.len, maximumEbmlDocumentTypeSizeInBytes, 'EBML DocType');
						const rawValue = await tokenizer.readToken(new StringType(documentTypeLength));
						return rawValue.replaceAll(/\00.*$/g, ''); // Return DocType
					}

					if (
						hasUnknownFileSize(tokenizer)
						&& (
							!Number.isFinite(element.len)
							|| element.len < 0
							|| element.len > maximumEbmlElementPayloadSizeInBytes
						)
					) {
						return;
					}

					await safeIgnore(tokenizer, element.len, {
						maximumLength: hasUnknownFileSize(tokenizer) ? maximumEbmlElementPayloadSizeInBytes : tokenizer.fileInfo.size,
						reason: 'EBML payload',
					}); // ignore payload
					--children;

					// Safeguard against malformed files: bail if the position did not advance.
					if (tokenizer.position <= previousPosition) {
						return;
					}
				}
			}

			const rootElement = await readElement();
			const ebmlScanStart = tokenizer.position;
			const documentType = await readChildren(rootElement.len);

			switch (documentType) {
				case 'webm':
					return {
						ext: 'webm',
						mime: 'video/webm',
					};

				case 'matroska':
					return {
						ext: 'mkv',
						mime: 'video/matroska',
					};

				default:
					return;
			}
		}

		if (this.checkString('SQLi')) {
			return {
				ext: 'sqlite',
				mime: 'application/x-sqlite3',
			};
		}

		if (this.check([0x4E, 0x45, 0x53, 0x1A])) {
			return {
				ext: 'nes',
				mime: 'application/x-nintendo-nes-rom',
			};
		}

		if (this.checkString('Cr24')) {
			return {
				ext: 'crx',
				mime: 'application/x-google-chrome-extension',
			};
		}

		if (
			this.checkString('MSCF')
			|| this.checkString('ISc(')
		) {
			return {
				ext: 'cab',
				mime: 'application/vnd.ms-cab-compressed',
			};
		}

		if (this.check([0xED, 0xAB, 0xEE, 0xDB])) {
			return {
				ext: 'rpm',
				mime: 'application/x-rpm',
			};
		}

		if (this.check([0xC5, 0xD0, 0xD3, 0xC6])) {
			return {
				ext: 'eps',
				mime: 'application/eps',
			};
		}

		if (this.check([0x28, 0xB5, 0x2F, 0xFD])) {
			return {
				ext: 'zst',
				mime: 'application/zstd',
			};
		}

		if (this.check([0x7F, 0x45, 0x4C, 0x46])) {
			return {
				ext: 'elf',
				mime: 'application/x-elf',
			};
		}

		if (this.check([0x21, 0x42, 0x44, 0x4E])) {
			return {
				ext: 'pst',
				mime: 'application/vnd.ms-outlook',
			};
		}

		if (this.checkString('PAR1') || this.checkString('PARE')) {
			return {
				ext: 'parquet',
				mime: 'application/vnd.apache.parquet',
			};
		}

		if (this.checkString('ttcf')) {
			return {
				ext: 'ttc',
				mime: 'font/collection',
			};
		}

		if (
			this.check([0xFE, 0xED, 0xFA, 0xCE]) // 32-bit, big-endian
			|| this.check([0xFE, 0xED, 0xFA, 0xCF]) // 64-bit, big-endian
			|| this.check([0xCE, 0xFA, 0xED, 0xFE]) // 32-bit, little-endian
			|| this.check([0xCF, 0xFA, 0xED, 0xFE]) // 64-bit, little-endian
		) {
			return {
				ext: 'macho',
				mime: 'application/x-mach-binary',
			};
		}

		if (this.check([0x04, 0x22, 0x4D, 0x18])) {
			return {
				ext: 'lz4',
				mime: 'application/x-lz4', // Invented by us
			};
		}

		if (this.checkString('regf')) {
			return {
				ext: 'dat',
				mime: 'application/x-ft-windows-registry-hive',
			};
		}

		// SPSS Statistical Data File
		if (this.checkString('$FL2') || this.checkString('$FL3')) {
			return {
				ext: 'sav',
				mime: 'application/x-spss-sav',
			};
		}

		// -- 5-byte signatures --

		if (this.check([0x4F, 0x54, 0x54, 0x4F, 0x00])) {
			return {
				ext: 'otf',
				mime: 'font/otf',
			};
		}

		if (this.checkString('#!AMR')) {
			return {
				ext: 'amr',
				mime: 'audio/amr',
			};
		}

		if (this.checkString('{\\rtf')) {
			return {
				ext: 'rtf',
				mime: 'application/rtf',
			};
		}

		if (this.check([0x46, 0x4C, 0x56, 0x01])) {
			return {
				ext: 'flv',
				mime: 'video/x-flv',
			};
		}

		if (this.checkString('IMPM')) {
			return {
				ext: 'it',
				mime: 'audio/x-it',
			};
		}

		if (
			this.checkString('-lh0-', {offset: 2})
			|| this.checkString('-lh1-', {offset: 2})
			|| this.checkString('-lh2-', {offset: 2})
			|| this.checkString('-lh3-', {offset: 2})
			|| this.checkString('-lh4-', {offset: 2})
			|| this.checkString('-lh5-', {offset: 2})
			|| this.checkString('-lh6-', {offset: 2})
			|| this.checkString('-lh7-', {offset: 2})
			|| this.checkString('-lzs-', {offset: 2})
			|| this.checkString('-lz4-', {offset: 2})
			|| this.checkString('-lz5-', {offset: 2})
			|| this.checkString('-lhd-', {offset: 2})
		) {
			return {
				ext: 'lzh',
				mime: 'application/x-lzh-compressed',
			};
		}

		// MPEG program stream (PS or MPEG-PS)
		if (this.check([0x00, 0x00, 0x01, 0xBA])) {
			//  MPEG-PS, MPEG-1 Part 1
			if (this.check([0x21], {offset: 4, mask: [0xF1]})) {
				return {
					ext: 'mpg', // May also be .ps, .mpeg
					mime: 'video/MP1S',
				};
			}

			// MPEG-PS, MPEG-2 Part 1
			if (this.check([0x44], {offset: 4, mask: [0xC4]})) {
				return {
					ext: 'mpg', // May also be .mpg, .m2p, .vob or .sub
					mime: 'video/MP2P',
				};
			}
		}

		if (this.checkString('ITSF')) {
			return {
				ext: 'chm',
				mime: 'application/vnd.ms-htmlhelp',
			};
		}

		if (this.check([0xCA, 0xFE, 0xBA, 0xBE])) {
			// Java bytecode and Mach-O universal binaries have the same magic number.
			// We disambiguate based on the next 4 bytes, as done by `file`.
			// See https://github.com/file/file/blob/master/magic/Magdir/cafebabe
			const machOArchitectureCount = UINT32_BE.get(this.buffer, 4);
			const javaClassFileMajorVersion = UINT16_BE.get(this.buffer, 6);

			if (machOArchitectureCount > 0 && machOArchitectureCount <= 30) {
				return {
					ext: 'macho',
					mime: 'application/x-mach-binary',
				};
			}

			if (javaClassFileMajorVersion > 30) {
				return {
					ext: 'class',
					mime: 'application/java-vm',
				};
			}
		}

		if (this.checkString('.RMF')) {
			return {
				ext: 'rm',
				mime: 'application/vnd.rn-realmedia',
			};
		}

		// -- 5-byte signatures --

		if (this.checkString('DRACO')) {
			return {
				ext: 'drc',
				mime: 'application/vnd.google.draco', // Invented by us
			};
		}

		// -- 6-byte signatures --

		if (this.check([0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00])) {
			return {
				ext: 'xz',
				mime: 'application/x-xz',
			};
		}

		if (this.checkString('<?xml ')) {
			return {
				ext: 'xml',
				mime: 'application/xml',
			};
		}

		if (this.check([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C])) {
			return {
				ext: '7z',
				mime: 'application/x-7z-compressed',
			};
		}

		if (
			this.check([0x52, 0x61, 0x72, 0x21, 0x1A, 0x7])
			&& (this.buffer[6] === 0x0 || this.buffer[6] === 0x1)
		) {
			return {
				ext: 'rar',
				mime: 'application/x-rar-compressed',
			};
		}

		if (this.checkString('solid ')) {
			return {
				ext: 'stl',
				mime: 'model/stl',
			};
		}

		if (this.checkString('AC')) {
			const version = new StringType(4, 'latin1').get(this.buffer, 2);
			if (version.match('^d*') && version >= 1000 && version <= 1050) {
				return {
					ext: 'dwg',
					mime: 'image/vnd.dwg',
				};
			}
		}

		if (this.checkString('070707')) {
			return {
				ext: 'cpio',
				mime: 'application/x-cpio',
			};
		}

		// -- 7-byte signatures --

		if (this.checkString('BLENDER')) {
			return {
				ext: 'blend',
				mime: 'application/x-blender',
			};
		}

		if (this.checkString('!<arch>')) {
			await tokenizer.ignore(8);
			const string = await tokenizer.readToken(new StringType(13, 'ascii'));
			if (string === 'debian-binary') {
				return {
					ext: 'deb',
					mime: 'application/x-deb',
				};
			}

			return {
				ext: 'ar',
				mime: 'application/x-unix-archive',
			};
		}

		if (
			this.checkString('WEBVTT')
			&&	(
				// One of LF, CR, tab, space, or end of file must follow "WEBVTT" per the spec (see `fixture/fixture-vtt-*.vtt` for examples). Note that `\0` is technically the null character (there is no such thing as an EOF character). However, checking for `\0` gives us the same result as checking for the end of the stream.
				(['\n', '\r', '\t', ' ', '\0'].some(char7 => this.checkString(char7, {offset: 6}))))
		) {
			return {
				ext: 'vtt',
				mime: 'text/vtt',
			};
		}

		// -- 8-byte signatures --

		if (this.check([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
			const pngFileType = {
				ext: 'png',
				mime: 'image/png',
			};

			const apngFileType = {
				ext: 'apng',
				mime: 'image/apng',
			};

			// APNG format (https://wiki.mozilla.org/APNG_Specification)
			// 1. Find the first IDAT (image data) chunk (49 44 41 54)
			// 2. Check if there is an "acTL" chunk before the IDAT one (61 63 54 4C)

			// Offset calculated as follows:
			// - 8 bytes: PNG signature
			// - 4 (length) + 4 (chunk type) + 13 (chunk data) + 4 (CRC): IHDR chunk

			await tokenizer.ignore(8); // ignore PNG signature

			async function readChunkHeader() {
				return {
					length: await tokenizer.readToken(INT32_BE),
					type: await tokenizer.readToken(new StringType(4, 'latin1')),
				};
			}

			const isUnknownPngStream = hasUnknownFileSize(tokenizer);
			const pngScanStart = tokenizer.position;
			let pngChunkCount = 0;
			let hasSeenImageHeader = false;
			do {
				pngChunkCount++;
				if (pngChunkCount > maximumPngChunkCount) {
					break;
				}

				if (hasExceededUnknownSizeScanBudget(tokenizer, pngScanStart, maximumPngStreamScanBudgetInBytes)) {
					break;
				}

				const previousPosition = tokenizer.position;
				const chunk = await readChunkHeader();
				if (chunk.length < 0) {
					return; // Invalid chunk length
				}

				if (chunk.type === 'IHDR') {
					// PNG requires the first real image header to be a 13-byte IHDR chunk.
					if (chunk.length !== 13) {
						return;
					}

					hasSeenImageHeader = true;
				}

				switch (chunk.type) {
					case 'IDAT':
						return pngFileType;
					case 'acTL':
						return apngFileType;
					default:
						if (
							!hasSeenImageHeader
							&& chunk.type !== 'CgBI'
						) {
							return;
						}

						if (
							isUnknownPngStream
								&& chunk.length > maximumPngChunkSizeInBytes
						) {
							// Avoid huge attacker-controlled skips when probing unknown-size streams.
							return hasSeenImageHeader && isPngAncillaryChunk(chunk.type) ? pngFileType : undefined;
						}

						try {
							await safeIgnore(tokenizer, chunk.length + 4, {
								maximumLength: isUnknownPngStream ? maximumPngChunkSizeInBytes + 4 : tokenizer.fileInfo.size,
								reason: 'PNG chunk payload',
							}); // Ignore chunk-data + CRC
						} catch (error) {
							if (
								!isUnknownPngStream
									&& (
										error instanceof ParserHardLimitError
										|| error instanceof EndOfStreamError
									)
							) {
								return pngFileType;
							}

							throw error;
						}
				}

				// Safeguard against malformed files: bail if the position did not advance.
				if (tokenizer.position <= previousPosition) {
					break;
				}
			} while (tokenizer.position + 8 < tokenizer.fileInfo.size);

			return pngFileType;
		}

		if (this.check([0x41, 0x52, 0x52, 0x4F, 0x57, 0x31, 0x00, 0x00])) {
			return {
				ext: 'arrow',
				mime: 'application/vnd.apache.arrow.file',
			};
		}

		if (this.check([0x67, 0x6C, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00])) {
			return {
				ext: 'glb',
				mime: 'model/gltf-binary',
			};
		}

		// `mov` format variants
		if (
			this.check([0x66, 0x72, 0x65, 0x65], {offset: 4}) // `free`
			|| this.check([0x6D, 0x64, 0x61, 0x74], {offset: 4}) // `mdat` MJPEG
			|| this.check([0x6D, 0x6F, 0x6F, 0x76], {offset: 4}) // `moov`
			|| this.check([0x77, 0x69, 0x64, 0x65], {offset: 4}) // `wide`
		) {
			return {
				ext: 'mov',
				mime: 'video/quicktime',
			};
		}

		// -- 9-byte signatures --

		if (this.check([0x49, 0x49, 0x52, 0x4F, 0x08, 0x00, 0x00, 0x00, 0x18])) {
			return {
				ext: 'orf',
				mime: 'image/x-olympus-orf',
			};
		}

		if (this.checkString('gimp xcf ')) {
			return {
				ext: 'xcf',
				mime: 'image/x-xcf',
			};
		}

		// File Type Box (https://en.wikipedia.org/wiki/ISO_base_media_file_format)
		// It's not required to be first, but it's recommended to be. Almost all ISO base media files start with `ftyp` box.
		// `ftyp` box must contain a brand major identifier, which must consist of ISO 8859-1 printable characters.
		// Here we check for 8859-1 printable characters (for simplicity, it's a mask which also catches one non-printable character).
		if (
			this.checkString('ftyp', {offset: 4})
			&& (this.buffer[8] & 0x60) !== 0x00 // Brand major, first character ASCII?
		) {
			// They all can have MIME `video/mp4` except `application/mp4` special-case which is hard to detect.
			// For some cases, we're specific, everything else falls to `video/mp4` with `mp4` extension.
			const brandMajor = new StringType(4, 'latin1').get(this.buffer, 8).replace('\0', ' ').trim();
			switch (brandMajor) {
				case 'avif':
				case 'avis':
					return {ext: 'avif', mime: 'image/avif'};
				case 'mif1':
					return {ext: 'heic', mime: 'image/heif'};
				case 'msf1':
					return {ext: 'heic', mime: 'image/heif-sequence'};
				case 'heic':
				case 'heix':
					return {ext: 'heic', mime: 'image/heic'};
				case 'hevc':
				case 'hevx':
					return {ext: 'heic', mime: 'image/heic-sequence'};
				case 'qt':
					return {ext: 'mov', mime: 'video/quicktime'};
				case 'M4V':
				case 'M4VH':
				case 'M4VP':
					return {ext: 'm4v', mime: 'video/x-m4v'};
				case 'M4P':
					return {ext: 'm4p', mime: 'video/mp4'};
				case 'M4B':
					return {ext: 'm4b', mime: 'audio/mp4'};
				case 'M4A':
					return {ext: 'm4a', mime: 'audio/x-m4a'};
				case 'F4V':
					return {ext: 'f4v', mime: 'video/mp4'};
				case 'F4P':
					return {ext: 'f4p', mime: 'video/mp4'};
				case 'F4A':
					return {ext: 'f4a', mime: 'audio/mp4'};
				case 'F4B':
					return {ext: 'f4b', mime: 'audio/mp4'};
				case 'crx':
					return {ext: 'cr3', mime: 'image/x-canon-cr3'};
				default:
					if (brandMajor.startsWith('3g')) {
						if (brandMajor.startsWith('3g2')) {
							return {ext: '3g2', mime: 'video/3gpp2'};
						}

						return {ext: '3gp', mime: 'video/3gpp'};
					}

					return {ext: 'mp4', mime: 'video/mp4'};
			}
		}

		// -- 10-byte signatures --

		if (this.checkString('REGEDIT4\r\n')) {
			return {
				ext: 'reg',
				mime: 'application/x-ms-regedit',
			};
		}

		// -- 12-byte signatures --

		// RIFF file format which might be AVI, WAV, QCP, etc
		if (this.check([0x52, 0x49, 0x46, 0x46])) {
			if (this.checkString('WEBP', {offset: 8})) {
				return {
					ext: 'webp',
					mime: 'image/webp',
				};
			}

			if (this.check([0x41, 0x56, 0x49], {offset: 8})) {
				return {
					ext: 'avi',
					mime: 'video/vnd.avi',
				};
			}

			if (this.check([0x57, 0x41, 0x56, 0x45], {offset: 8})) {
				return {
					ext: 'wav',
					mime: 'audio/wav',
				};
			}

			// QLCM, QCP file
			if (this.check([0x51, 0x4C, 0x43, 0x4D], {offset: 8})) {
				return {
					ext: 'qcp',
					mime: 'audio/qcelp',
				};
			}
		}

		if (this.check([0x49, 0x49, 0x55, 0x00, 0x18, 0x00, 0x00, 0x00, 0x88, 0xE7, 0x74, 0xD8])) {
			return {
				ext: 'rw2',
				mime: 'image/x-panasonic-rw2',
			};
		}

		// ASF_Header_Object first 80 bytes
		if (this.check([0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11, 0xA6, 0xD9])) {
			let isMalformedAsf = false;
			try {
				async function readHeader() {
					const guid = new Uint8Array(16);
					await safeReadBuffer(tokenizer, guid, undefined, {
						maximumLength: guid.length,
						reason: 'ASF header GUID',
					});
					return {
						id: guid,
						size: Number(await tokenizer.readToken(UINT64_LE)),
					};
				}

				await safeIgnore(tokenizer, 30, {
					maximumLength: 30,
					reason: 'ASF header prelude',
				});
				const isUnknownFileSize = hasUnknownFileSize(tokenizer);
				const asfHeaderScanStart = tokenizer.position;
				let asfHeaderObjectCount = 0;
				while (tokenizer.position + 24 < tokenizer.fileInfo.size) {
					asfHeaderObjectCount++;
					if (asfHeaderObjectCount > maximumAsfHeaderObjectCount) {
						break;
					}

					if (hasExceededUnknownSizeScanBudget(tokenizer, asfHeaderScanStart, maximumUntrustedSkipSizeInBytes)) {
						break;
					}

					const previousPosition = tokenizer.position;
					const header = await readHeader();
					let payload = header.size - 24;
					if (
						!Number.isFinite(payload)
						|| payload < 0
					) {
						isMalformedAsf = true;
						break;
					}

					if (_check(header.id, [0x91, 0x07, 0xDC, 0xB7, 0xB7, 0xA9, 0xCF, 0x11, 0x8E, 0xE6, 0x00, 0xC0, 0x0C, 0x20, 0x53, 0x65])) {
						// Sync on Stream-Properties-Object (B7DC0791-A9B7-11CF-8EE6-00C00C205365)
						const typeId = new Uint8Array(16);
						payload -= await safeReadBuffer(tokenizer, typeId, undefined, {
							maximumLength: typeId.length,
							reason: 'ASF stream type GUID',
						});

						if (_check(typeId, [0x40, 0x9E, 0x69, 0xF8, 0x4D, 0x5B, 0xCF, 0x11, 0xA8, 0xFD, 0x00, 0x80, 0x5F, 0x5C, 0x44, 0x2B])) {
							// Found audio:
							return {
								ext: 'asf',
								mime: 'audio/x-ms-asf',
							};
						}

						if (_check(typeId, [0xC0, 0xEF, 0x19, 0xBC, 0x4D, 0x5B, 0xCF, 0x11, 0xA8, 0xFD, 0x00, 0x80, 0x5F, 0x5C, 0x44, 0x2B])) {
							// Found video:
							return {
								ext: 'asf',
								mime: 'video/x-ms-asf',
							};
						}

						break;
					}

					if (
						isUnknownFileSize
						&& payload > maximumAsfHeaderPayloadSizeInBytes
					) {
						isMalformedAsf = true;
						break;
					}

					await safeIgnore(tokenizer, payload, {
						maximumLength: isUnknownFileSize ? maximumAsfHeaderPayloadSizeInBytes : tokenizer.fileInfo.size,
						reason: 'ASF header payload',
					});

					// Safeguard against malformed files: break if the position did not advance.
					if (tokenizer.position <= previousPosition) {
						isMalformedAsf = true;
						break;
					}
				}
			} catch (error) {
				if (
					error instanceof EndOfStreamError
					|| error instanceof ParserHardLimitError
				) {
					if (hasUnknownFileSize(tokenizer)) {
						isMalformedAsf = true;
					}
				} else {
					throw error;
				}
			}

			if (isMalformedAsf) {
				return;
			}

			// Default to ASF generic extension
			return {
				ext: 'asf',
				mime: 'application/vnd.ms-asf',
			};
		}

		if (this.check([0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A])) {
			return {
				ext: 'ktx',
				mime: 'image/ktx',
			};
		}

		if ((this.check([0x7E, 0x10, 0x04]) || this.check([0x7E, 0x18, 0x04])) && this.check([0x30, 0x4D, 0x49, 0x45], {offset: 4})) {
			return {
				ext: 'mie',
				mime: 'application/x-mie',
			};
		}

		if (this.check([0x27, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], {offset: 2})) {
			return {
				ext: 'shp',
				mime: 'application/x-esri-shape',
			};
		}

		if (this.check([0xFF, 0x4F, 0xFF, 0x51])) {
			return {
				ext: 'j2c',
				mime: 'image/j2c',
			};
		}

		if (this.check([0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20, 0x0D, 0x0A, 0x87, 0x0A])) {
			// JPEG-2000 family

			await tokenizer.ignore(20);
			const type = await tokenizer.readToken(new StringType(4, 'ascii'));
			switch (type) {
				case 'jp2 ':
					return {
						ext: 'jp2',
						mime: 'image/jp2',
					};
				case 'jpx ':
					return {
						ext: 'jpx',
						mime: 'image/jpx',
					};
				case 'jpm ':
					return {
						ext: 'jpm',
						mime: 'image/jpm',
					};
				case 'mjp2':
					return {
						ext: 'mj2',
						mime: 'image/mj2',
					};
				default:
					return;
			}
		}

		if (
			this.check([0xFF, 0x0A])
			|| this.check([0x00, 0x00, 0x00, 0x0C, 0x4A, 0x58, 0x4C, 0x20, 0x0D, 0x0A, 0x87, 0x0A])
		) {
			return {
				ext: 'jxl',
				mime: 'image/jxl',
			};
		}

		if (this.check([0xFE, 0xFF])) { // UTF-16-BOM-BE
			if (this.checkString('<?xml ', {offset: 2, encoding: 'utf-16be'})) {
				return {
					ext: 'xml',
					mime: 'application/xml',
				};
			}

			return undefined; // Some unknown text based format
		}

		if (this.check([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) {
			// Detected Microsoft Compound File Binary File (MS-CFB) Format.
			return {
				ext: 'cfb',
				mime: 'application/x-cfb',
			};
		}

		// Increase sample size from 32 to 256.
		await tokenizer.peekBuffer(this.buffer, {length: Math.min(256, tokenizer.fileInfo.size), mayBeLess: true});

		if (this.check([0x61, 0x63, 0x73, 0x70], {offset: 36})) {
			return {
				ext: 'icc',
				mime: 'application/vnd.iccprofile',
			};
		}

		// ACE: requires 14 bytes in the buffer
		if (this.checkString('**ACE', {offset: 7}) && this.checkString('**', {offset: 12})) {
			return {
				ext: 'ace',
				mime: 'application/x-ace-compressed',
			};
		}

		// -- 15-byte signatures --

		if (this.checkString('BEGIN:')) {
			if (this.checkString('VCARD', {offset: 6})) {
				return {
					ext: 'vcf',
					mime: 'text/vcard',
				};
			}

			if (this.checkString('VCALENDAR', {offset: 6})) {
				return {
					ext: 'ics',
					mime: 'text/calendar',
				};
			}
		}

		// `raf` is here just to keep all the raw image detectors together.
		if (this.checkString('FUJIFILMCCD-RAW')) {
			return {
				ext: 'raf',
				mime: 'image/x-fujifilm-raf',
			};
		}

		if (this.checkString('Extended Module:')) {
			return {
				ext: 'xm',
				mime: 'audio/x-xm',
			};
		}

		if (this.checkString('Creative Voice File')) {
			return {
				ext: 'voc',
				mime: 'audio/x-voc',
			};
		}

		if (this.check([0x04, 0x00, 0x00, 0x00]) && this.buffer.length >= 16) { // Rough & quick check Pickle/ASAR
			const jsonSize = new DataView(this.buffer.buffer).getUint32(12, true);

			if (jsonSize > 12 && this.buffer.length >= jsonSize + 16) {
				try {
					const header = new TextDecoder().decode(this.buffer.subarray(16, jsonSize + 16));
					const json = JSON.parse(header);
					// Check if Pickle is ASAR
					if (json.files) { // Final check, assuring Pickle/ASAR format
						return {
							ext: 'asar',
							mime: 'application/x-asar',
						};
					}
				} catch {}
			}
		}

		if (this.check([0x06, 0x0E, 0x2B, 0x34, 0x02, 0x05, 0x01, 0x01, 0x0D, 0x01, 0x02, 0x01, 0x01, 0x02])) {
			return {
				ext: 'mxf',
				mime: 'application/mxf',
			};
		}

		if (this.checkString('SCRM', {offset: 44})) {
			return {
				ext: 's3m',
				mime: 'audio/x-s3m',
			};
		}

		// Raw MPEG-2 transport stream (188-byte packets)
		if (this.check([0x47]) && this.check([0x47], {offset: 188})) {
			return {
				ext: 'mts',
				mime: 'video/mp2t',
			};
		}

		// Blu-ray Disc Audio-Video (BDAV) MPEG-2 transport stream has 4-byte TP_extra_header before each 188-byte packet
		if (this.check([0x47], {offset: 4}) && this.check([0x47], {offset: 196})) {
			return {
				ext: 'mts',
				mime: 'video/mp2t',
			};
		}

		if (this.check([0x42, 0x4F, 0x4F, 0x4B, 0x4D, 0x4F, 0x42, 0x49], {offset: 60})) {
			return {
				ext: 'mobi',
				mime: 'application/x-mobipocket-ebook',
			};
		}

		if (this.check([0x44, 0x49, 0x43, 0x4D], {offset: 128})) {
			return {
				ext: 'dcm',
				mime: 'application/dicom',
			};
		}

		if (this.check([0x4C, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46])) {
			return {
				ext: 'lnk',
				mime: 'application/x.ms.shortcut', // Invented by us
			};
		}

		if (this.check([0x62, 0x6F, 0x6F, 0x6B, 0x00, 0x00, 0x00, 0x00, 0x6D, 0x61, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x00])) {
			return {
				ext: 'alias',
				mime: 'application/x.apple.alias', // Invented by us
			};
		}

		if (this.checkString('Kaydara FBX Binary  \u0000')) {
			return {
				ext: 'fbx',
				mime: 'application/x.autodesk.fbx', // Invented by us
			};
		}

		if (
			this.check([0x4C, 0x50], {offset: 34})
			&& (
				this.check([0x00, 0x00, 0x01], {offset: 8})
				|| this.check([0x01, 0x00, 0x02], {offset: 8})
				|| this.check([0x02, 0x00, 0x02], {offset: 8})
			)
		) {
			return {
				ext: 'eot',
				mime: 'application/vnd.ms-fontobject',
			};
		}

		if (this.check([0x06, 0x06, 0xED, 0xF5, 0xD8, 0x1D, 0x46, 0xE5, 0xBD, 0x31, 0xEF, 0xE7, 0xFE, 0x74, 0xB7, 0x1D])) {
			return {
				ext: 'indd',
				mime: 'application/x-indesign',
			};
		}

		// -- 16-byte signatures --

		// JMP files - check for both Little Endian and Big Endian signatures
		if (this.check([0xFF, 0xFF, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00])
			|| this.check([0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01, 0x00, 0x01])) {
			return {
				ext: 'jmp',
				mime: 'application/x-jmp-data',
			};
		}

		// Increase sample size from 256 to 512
		await tokenizer.peekBuffer(this.buffer, {length: Math.min(512, tokenizer.fileInfo.size), mayBeLess: true});

		// Requires a buffer size of 512 bytes
		if ((this.checkString('ustar', {offset: 257}) && (this.checkString('\0', {offset: 262}) || this.checkString(' ', {offset: 262})))
			|| (this.check([0, 0, 0, 0, 0, 0], {offset: 257}) && tarHeaderChecksumMatches(this.buffer))) {
			return {
				ext: 'tar',
				mime: 'application/x-tar',
			};
		}

		if (this.check([0xFF, 0xFE])) { // UTF-16-BOM-LE
			const encoding = 'utf-16le';
			if (this.checkString('<?xml ', {offset: 2, encoding})) {
				return {
					ext: 'xml',
					mime: 'application/xml',
				};
			}

			if (this.check([0xFF, 0x0E], {offset: 2}) && this.checkString('SketchUp Model', {offset: 4, encoding})) {
				return {
					ext: 'skp',
					mime: 'application/vnd.sketchup.skp',
				};
			}

			if (this.checkString('Windows Registry Editor Version 5.00\r\n', {offset: 2, encoding})) {
				return {
					ext: 'reg',
					mime: 'application/x-ms-regedit',
				};
			}

			return undefined; // Some text based format
		}

		if (this.checkString('-----BEGIN PGP MESSAGE-----')) {
			return {
				ext: 'pgp',
				mime: 'application/pgp-encrypted',
			};
		}
	};
	// Detections with limited supporting data, resulting in a higher likelihood of false positives
	detectImprecise = async tokenizer => {
		this.buffer = new Uint8Array(reasonableDetectionSizeInBytes);
		const fileSize = getKnownFileSizeOrMaximum(tokenizer.fileInfo.size);

		// Read initial sample size of 8 bytes
		await tokenizer.peekBuffer(this.buffer, {length: Math.min(8, fileSize), mayBeLess: true});

		if (
			this.check([0x0, 0x0, 0x1, 0xBA])
			|| this.check([0x0, 0x0, 0x1, 0xB3])
		) {
			return {
				ext: 'mpg',
				mime: 'video/mpeg',
			};
		}

		if (this.check([0x00, 0x01, 0x00, 0x00, 0x00])) {
			return {
				ext: 'ttf',
				mime: 'font/ttf',
			};
		}

		if (this.check([0x00, 0x00, 0x01, 0x00])) {
			return {
				ext: 'ico',
				mime: 'image/x-icon',
			};
		}

		if (this.check([0x00, 0x00, 0x02, 0x00])) {
			return {
				ext: 'cur',
				mime: 'image/x-icon',
			};
		}

		// Adjust buffer to `mpegOffsetTolerance`
		await tokenizer.peekBuffer(this.buffer, {length: Math.min(2 + this.options.mpegOffsetTolerance, fileSize), mayBeLess: true});

		// Check MPEG 1 or 2 Layer 3 header, or 'layer 0' for ADTS (MPEG sync-word 0xFFE)
		if (this.buffer.length >= (2 + this.options.mpegOffsetTolerance)) {
			for (let depth = 0; depth <= this.options.mpegOffsetTolerance; ++depth) {
				const type = this.scanMpeg(depth);
				if (type) {
					return type;
				}
			}
		}
	};

	async readTiffTag(bigEndian) {
		const tagId = await this.tokenizer.readToken(bigEndian ? UINT16_BE : UINT16_LE);
		await this.tokenizer.ignore(10);
		switch (tagId) {
			case 50_341:
				return {
					ext: 'arw',
					mime: 'image/x-sony-arw',
				};
			case 50_706:
				return {
					ext: 'dng',
					mime: 'image/x-adobe-dng',
				};
		}
	}

	async readTiffIFD(bigEndian) {
		const numberOfTags = await this.tokenizer.readToken(bigEndian ? UINT16_BE : UINT16_LE);
		if (numberOfTags > maximumTiffTagCount) {
			return;
		}

		if (
			hasUnknownFileSize(this.tokenizer)
			&& (2 + (numberOfTags * 12)) > maximumTiffIfdOffsetInBytes
		) {
			return;
		}

		for (let n = 0; n < numberOfTags; ++n) {
			const fileType = await this.readTiffTag(bigEndian);
			if (fileType) {
				return fileType;
			}
		}
	}

	async readTiffHeader(bigEndian) {
		const tiffFileType = {
			ext: 'tif',
			mime: 'image/tiff',
		};

		const version = (bigEndian ? UINT16_BE : UINT16_LE).get(this.buffer, 2);
		const ifdOffset = (bigEndian ? UINT32_BE : UINT32_LE).get(this.buffer, 4);

		if (version === 42) {
			// TIFF file header
			if (ifdOffset >= 6) {
				if (this.checkString('CR', {offset: 8})) {
					return {
						ext: 'cr2',
						mime: 'image/x-canon-cr2',
					};
				}

				if (ifdOffset >= 8) {
					const someId1 = (bigEndian ? UINT16_BE : UINT16_LE).get(this.buffer, 8);
					const someId2 = (bigEndian ? UINT16_BE : UINT16_LE).get(this.buffer, 10);

					if (
						(someId1 === 0x1C && someId2 === 0xFE)
						|| (someId1 === 0x1F && someId2 === 0x0B)) {
						return {
							ext: 'nef',
							mime: 'image/x-nikon-nef',
						};
					}
				}
			}

			if (
				hasUnknownFileSize(this.tokenizer)
				&& ifdOffset > maximumTiffStreamIfdOffsetInBytes
			) {
				return tiffFileType;
			}

			const maximumTiffOffset = hasUnknownFileSize(this.tokenizer) ? maximumTiffIfdOffsetInBytes : this.tokenizer.fileInfo.size;

			try {
				await safeIgnore(this.tokenizer, ifdOffset, {
					maximumLength: maximumTiffOffset,
					reason: 'TIFF IFD offset',
				});
			} catch (error) {
				if (error instanceof EndOfStreamError) {
					return;
				}

				throw error;
			}

			let fileType;
			try {
				fileType = await this.readTiffIFD(bigEndian);
			} catch (error) {
				if (error instanceof EndOfStreamError) {
					return;
				}

				throw error;
			}

			return fileType ?? tiffFileType;
		}

		if (version === 43) {	// Big TIFF file header
			return tiffFileType;
		}
	}

	/**
	Scan check MPEG 1 or 2 Layer 3 header, or 'layer 0' for ADTS (MPEG sync-word 0xFFE).

	@param offset - Offset to scan for sync-preamble.
	@returns {{ext: string, mime: string}}
	*/
	scanMpeg(offset) {
		if (this.check([0xFF, 0xE0], {offset, mask: [0xFF, 0xE0]})) {
			if (this.check([0x10], {offset: offset + 1, mask: [0x16]})) {
				// Check for (ADTS) MPEG-2
				if (this.check([0x08], {offset: offset + 1, mask: [0x08]})) {
					return {
						ext: 'aac',
						mime: 'audio/aac',
					};
				}

				// Must be (ADTS) MPEG-4
				return {
					ext: 'aac',
					mime: 'audio/aac',
				};
			}

			// MPEG 1 or 2 Layer 3 header
			// Check for MPEG layer 3
			if (this.check([0x02], {offset: offset + 1, mask: [0x06]})) {
				return {
					ext: 'mp3',
					mime: 'audio/mpeg',
				};
			}

			// Check for MPEG layer 2
			if (this.check([0x04], {offset: offset + 1, mask: [0x06]})) {
				return {
					ext: 'mp2',
					mime: 'audio/mpeg',
				};
			}

			// Check for MPEG layer 1
			if (this.check([0x06], {offset: offset + 1, mask: [0x06]})) {
				return {
					ext: 'mp1',
					mime: 'audio/mpeg',
				};
			}
		}
	}
}

new Set(extensions);
new Set(mimeTypes);

var dist = {};

var hasRequiredDist;

function requireDist () {
	if (hasRequiredDist) return dist;
	hasRequiredDist = 1;
	/*!
	 * content-type
	 * Copyright(c) 2015 Douglas Christopher Wilson
	 * MIT Licensed
	 */
	Object.defineProperty(dist, "__esModule", { value: true });
	dist.format = format;
	dist.parse = parse;
	const TEXT_REGEXP = /^[\u0009\u0020-\u007e\u0080-\u00ff]*$/;
	const TOKEN_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
	/**
	 * RegExp to match chars that must be quoted-pair in RFC 9110 sec 5.6.4
	 */
	const QUOTE_REGEXP = /[\\"]/g;
	/**
	 * RegExp to match type in RFC 9110 sec 8.3.1
	 *
	 * media-type = type "/" subtype
	 * type       = token
	 * subtype    = token
	 */
	const TYPE_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
	/**
	 * Null object perf optimization. Faster than `Object.create(null)` and `{ __proto__: null }`.
	 */
	const NullObject = /* @__PURE__ */ (() => {
	    const C = function () { };
	    C.prototype = Object.create(null);
	    return C;
	})();
	/**
	 * Format an object into a `Content-Type` header.
	 */
	function format(obj) {
	    const { type, parameters } = obj;
	    if (!type || !TYPE_REGEXP.test(type)) {
	        throw new TypeError(`Invalid type: ${type}`);
	    }
	    let result = type;
	    if (parameters) {
	        for (const param of Object.keys(parameters)) {
	            if (!TOKEN_REGEXP.test(param)) {
	                throw new TypeError(`Invalid parameter name: ${param}`);
	            }
	            result += `; ${param}=${qstring(parameters[param])}`;
	        }
	    }
	    return result;
	}
	/**
	 * Parse a `Content-Type` header.
	 */
	function parse(header, options) {
	    const len = header.length;
	    let index = skipOWS(header, 0, len);
	    const valueStart = index;
	    index = skipValue(header, index, len);
	    const valueEnd = trailingOWS(header, valueStart, index);
	    const type = header.slice(valueStart, valueEnd).toLowerCase();
	    const parameters = options?.parameters === false
	        ? new NullObject()
	        : parseParameters(header, index, len);
	    return { type, parameters };
	}
	const SP = 32; // " "
	const HTAB = 9; // "\t"
	const SEMI = 59; // ";"
	const EQ = 61; // "="
	const DQUOTE = 34; // '"'
	const BSLASH = 92; // "\\"
	/**
	 * Parses the parameters of a `Content-Type` header starting at the given index.
	 */
	function parseParameters(header, index, len) {
	    const parameters = new NullObject();
	    parameter: while (index < len) {
	        index = skipOWS(header, index + 1 /* Skip over ; */, len);
	        const keyStart = index;
	        while (index < len) {
	            const code = header.charCodeAt(index);
	            if (code === SEMI)
	                continue parameter;
	            if (code === EQ) {
	                const keyEnd = trailingOWS(header, keyStart, index);
	                const key = header.slice(keyStart, keyEnd).toLowerCase();
	                index = skipOWS(header, index + 1, len);
	                if (index < len && header.charCodeAt(index) === DQUOTE) {
	                    index++;
	                    let value = "";
	                    while (index < len) {
	                        const code = header.charCodeAt(index++);
	                        if (code === DQUOTE) {
	                            index = skipValue(header, index, len);
	                            if (parameters[key] === undefined)
	                                parameters[key] = value;
	                            break;
	                        }
	                        if (code === BSLASH && index < len) {
	                            value += header[index++];
	                            continue;
	                        }
	                        value += String.fromCharCode(code);
	                    }
	                    continue parameter;
	                }
	                const valueStart = index;
	                index = skipValue(header, index, len);
	                if (parameters[key] === undefined) {
	                    const valueEnd = trailingOWS(header, valueStart, index);
	                    parameters[key] = header.slice(valueStart, valueEnd);
	                }
	                continue parameter;
	            }
	            index++;
	        }
	    }
	    return parameters;
	}
	/**
	 * Skip over characters until a semicolon.
	 */
	function skipValue(str, index, len) {
	    while (index < len) {
	        const char = str.charCodeAt(index);
	        if (char === SEMI)
	            break;
	        index++;
	    }
	    return index;
	}
	/**
	 * Skip optional whitespace (OWS) in an HTTP header value.
	 *
	 * OWS is defined in RFC 9110 sec 5.6.3 as SP (" ") or HTAB ("\t").
	 */
	function skipOWS(header, index, len) {
	    while (index < len) {
	        const char = header.charCodeAt(index);
	        if (char !== SP && char !== HTAB)
	            break;
	        index++;
	    }
	    return index;
	}
	/**
	 * Trim optional whitespace (OWS) from the end of a substring.
	 *
	 * OWS is defined in RFC 9110 sec 5.6.3 as SP (" ") or HTAB ("\t").
	 */
	function trailingOWS(header, start, end) {
	    while (end > start) {
	        const char = header.charCodeAt(end - 1);
	        if (char !== SP && char !== HTAB)
	            break;
	        end--;
	    }
	    return end;
	}
	/**
	 * Serialize a parameter value.
	 */
	function qstring(str) {
	    if (TOKEN_REGEXP.test(str))
	        return str;
	    if (TEXT_REGEXP.test(str))
	        return `"${str.replace(QUOTE_REGEXP, "\\$&")}"`;
	    throw new TypeError(`Invalid parameter value: ${str}`);
	}
	
	return dist;
}

var distExports = requireDist();

/**
 * RegExp to match type in RFC 6838
 *
 * type-name = restricted-name
 * subtype-name = restricted-name
 * restricted-name = restricted-name-first *126restricted-name-chars
 * restricted-name-first  = ALPHA / DIGIT
 * restricted-name-chars  = ALPHA / DIGIT / "!" / "#" /
 *                          "$" / "&" / "-" / "^" / "_"
 * restricted-name-chars =/ "." ; Characters before first dot always
 *                              ; specify a facet name
 * restricted-name-chars =/ "+" ; Characters after last plus always
 *                              ; specify a structured syntax suffix
 * ALPHA =  %x41-5A / %x61-7A   ; A-Z / a-z
 * DIGIT =  %x30-39             ; 0-9
 */
const typeRegExp = /^[A-Za-z0-9][A-Za-z0-9!#$&^_-]{0,126}\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/;
/**
 * Parse media type to object.
 */
function parse(str) {
    if (!typeRegExp.test(str)) {
        throw new TypeError(`Invalid media type: ${str}`);
    }
    const slashIndex = str.indexOf("/");
    const type = str.slice(0, slashIndex).toLowerCase();
    let subtype = str.slice(slashIndex + 1).toLowerCase();
    let suffix;
    const index = subtype.lastIndexOf("+");
    if (index !== -1) {
        suffix = subtype.slice(index + 1);
        subtype = subtype.slice(0, index);
    }
    return { type, subtype, suffix };
}

const TargetType = {
    10: 'shot',
    20: 'scene',
    30: 'track',
    40: 'part',
    50: 'album',
    60: 'edition',
    70: 'collection'
};
const TrackType = {
    video: 0x01,
    audio: 0x02,
    complex: 0x03,
    logo: 0x04,
    subtitle: 0x11,
    button: 0x12,
    control: 0x20
};
const TrackTypeValueToKeyMap = {
    [TrackType.video]: 'video',
    [TrackType.audio]: 'audio',
    [TrackType.complex]: 'complex',
    [TrackType.logo]: 'logo',
    [TrackType.subtitle]: 'subtitle',
    [TrackType.button]: 'button',
    [TrackType.control]: 'control'
};

const makeParseError = (name) => {
    return class ParseError extends Error {
        constructor(message) {
            super(message);
            this.name = name;
        }
    };
};
// Concrete error class representing a file type determination failure.
class CouldNotDetermineFileTypeError extends makeParseError('CouldNotDetermineFileTypeError') {
}
// Concrete error class representing an unsupported file type.
class UnsupportedFileTypeError extends makeParseError('UnsupportedFileTypeError') {
}
// Concrete error class representing unexpected file content.
class UnexpectedFileContentError extends makeParseError('UnexpectedFileContentError') {
    constructor(fileType, message) {
        super(message);
        this.fileType = fileType;
    }
    // Override toString to include file type information.
    toString() {
        return `${this.name} (FileType: ${this.fileType}): ${this.message}`;
    }
}
// Concrete error class representing a field decoding error.
class FieldDecodingError extends makeParseError('FieldDecodingError') {
}
class InternalParserError extends makeParseError('InternalParserError') {
}
// Factory function to create a specific type of UnexpectedFileContentError.
const makeUnexpectedFileContentError = (fileType) => {
    return class extends UnexpectedFileContentError {
        constructor(message) {
            super(fileType, message);
        }
    };
};

function getBit(buf, off, bit) {
    return (buf[off] & (1 << bit)) !== 0;
}
/**
 * Find delimiting zero in uint8Array
 * @param uint8Array Uint8Array to find the zero delimiter in
 * @param encoding The string encoding used
 * @return position in uint8Array where zero found, or uint8Array.length if not found
 */
function findZero(uint8Array, encoding) {
    const len = uint8Array.length;
    if (encoding === 'utf-16le' || encoding === 'utf-16be') {
        // Look for 0x00 0x00 on 2-byte boundary
        for (let i = 0; i + 1 < len; i += 2) {
            if (uint8Array[i] === 0 && uint8Array[i + 1] === 0)
                return i;
        }
        return len;
    }
    // latin1 / utf8 / utf16be (caller typically handles utf16be separately or via decode)
    for (let i = 0; i < len; i++) {
        if (uint8Array[i] === 0)
            return i;
    }
    return len;
}
function trimRightNull(x) {
    const pos0 = x.indexOf('\0');
    return pos0 === -1 ? x : x.substring(0, pos0);
}
function swapBytes(uint8Array) {
    const l = uint8Array.length;
    if ((l & 1) !== 0)
        throw new FieldDecodingError('Buffer length must be even');
    for (let i = 0; i < l; i += 2) {
        const a = uint8Array[i];
        uint8Array[i] = uint8Array[i + 1];
        uint8Array[i + 1] = a;
    }
    return uint8Array;
}
/**
 * Decode string
 */
function decodeString(uint8Array, encoding) {
    // annoying workaround for a double BOM issue
    // https://github.com/leetreveil/musicmetadata/issues/84
    if (uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) { // little endian
        return decodeString(uint8Array.subarray(2), encoding);
    }
    if (encoding === 'utf-16le' && uint8Array[0] === 0xFE && uint8Array[1] === 0xFF) {
        // BOM, indicating big endian decoding
        if ((uint8Array.length & 1) !== 0)
            throw new FieldDecodingError('Expected even number of octets for 16-bit unicode string');
        return decodeString(swapBytes(uint8Array), encoding);
    }
    if (encoding === 'utf-16be') {
        // There is no native UTF-16BE decoder; swap to UTF-16LE and decode that.
        if ((uint8Array.length & 1) !== 0)
            throw new FieldDecodingError('Expected even number of octets for 16-bit unicode string');
        return new StringType(uint8Array.length, 'utf-16le').get(swapBytes(Uint8Array.from(uint8Array)), 0);
    }
    return new StringType(uint8Array.length, encoding).get(uint8Array, 0);
}
function stripNulls(str) {
    str = str.replace(/^\x00+/g, '');
    str = str.replace(/\x00+$/g, '');
    return str;
}
/**
 * Read bit-aligned number start from buffer
 * Total offset in bits = byteOffset * 8 + bitOffset
 * @param source Byte buffer
 * @param byteOffset Starting offset in bytes
 * @param bitOffset Starting offset in bits: 0 = lsb
 * @param len Length of number in bits
 * @return Decoded bit aligned number
 */
function getBitAllignedNumber(source, byteOffset, bitOffset, len) {
    const byteOff = byteOffset + ~~(bitOffset / 8);
    const bitOff = bitOffset % 8;
    let value = source[byteOff];
    value &= 0xff >> bitOff;
    const bitsRead = 8 - bitOff;
    const bitsLeft = len - bitsRead;
    if (bitsLeft < 0) {
        value >>= (8 - bitOff - len);
    }
    else if (bitsLeft > 0) {
        value <<= bitsLeft;
        value |= getBitAllignedNumber(source, byteOffset, bitOffset + bitsRead, bitsLeft);
    }
    return value;
}
/**
 * Read bit-aligned number start from buffer
 * Total offset in bits = byteOffset * 8 + bitOffset
 * @param source Byte Uint8Array
 * @param byteOffset Starting offset in bytes
 * @param bitOffset Starting offset in bits: 0 = most significant bit, 7 is the least significant bit
 * @return True if bit is set
 */
function isBitSet$1(source, byteOffset, bitOffset) {
    return getBitAllignedNumber(source, byteOffset, bitOffset, 1) === 1;
}
function a2hex(str) {
    const arr = [];
    for (let i = 0, l = str.length; i < l; i++) {
        const hex = Number(str.charCodeAt(i)).toString(16);
        arr.push(hex.length === 1 ? `0${hex}` : hex);
    }
    return arr.join(' ');
}
/**
 * Convert power ratio to DB
 * ratio: [0..1]
 */
function ratioToDb(ratio) {
    return 10 * Math.log10(ratio);
}
/**
 * Convert dB to ratio
 * db Decibels
 */
function dbToRatio(dB) {
    return 10 ** (dB / 10);
}
/**
 * Convert replay gain to ratio and Decibel
 * @param value string holding a ratio like '0.034' or '-7.54 dB'
 */
function toRatio(value) {
    const ps = value.split(' ').map(p => p.trim().toLowerCase());
    if (ps.length >= 1) {
        const v = Number.parseFloat(ps[0]);
        return ps.length === 2 && ps[1] === 'db' ? {
            dB: v,
            ratio: dbToRatio(v)
        } : {
            dB: ratioToDb(v),
            ratio: v
        };
    }
}
/**
 * Decode a big-endian unsigned integer from a Uint8Array.
 * Supports dynamic length (1–8 bytes).
 */
function decodeUintBE(uint8Array) {
    if (uint8Array.length === 0) {
        throw new Error("decodeUintBE: empty Uint8Array");
    }
    const view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
    return getUintBE(view);
}

/**
 * The picture type according to the ID3v2 APIC frame
 * Ref: http://id3.org/id3v2.3.0#Attached_picture
 */
const AttachedPictureType = {
    0: 'Other',
    1: "32x32 pixels 'file icon' (PNG only)",
    2: 'Other file icon',
    3: 'Cover (front)',
    4: 'Cover (back)',
    5: 'Leaflet page',
    6: 'Media (e.g. label side of CD)',
    7: 'Lead artist/lead performer/soloist',
    8: 'Artist/performer',
    9: 'Conductor',
    10: 'Band/Orchestra',
    11: 'Composer',
    12: 'Lyricist/text writer',
    13: 'Recording Location',
    14: 'During recording',
    15: 'During performance',
    16: 'Movie/video screen capture',
    17: 'A bright coloured fish',
    18: 'Illustration',
    19: 'Band/artist logotype',
    20: 'Publisher/Studio logotype'
};
/**
 * https://id3.org/id3v2.3.0#Synchronised_lyrics.2Ftext
 */
const LyricsContentType = {
    lyrics: 1};
const TimestampFormat = {
    notSynchronized: 0,
    milliseconds: 2
};
/**
 * 28 bits (representing up to 256MB) integer, the msb is 0 to avoid 'false syncsignals'.
 * 4 * %0xxxxxxx
 */
const UINT32SYNCSAFE = {
    get: (buf, off) => {
        return buf[off + 3] & 0x7f | ((buf[off + 2]) << 7) |
            ((buf[off + 1]) << 14) | ((buf[off]) << 21);
    },
    len: 4
};
/**
 * ID3v2 header
 * Ref: http://id3.org/id3v2.3.0#ID3v2_header
 * ToDo
 */
const ID3v2Header = {
    len: 10,
    get: (buf, off) => {
        return {
            // ID3v2/file identifier   "ID3"
            fileIdentifier: new StringType(3, 'ascii').get(buf, off),
            // ID3v2 versionIndex
            version: {
                major: INT8.get(buf, off + 3),
                revision: INT8.get(buf, off + 4)
            },
            // ID3v2 flags
            flags: {
                // Unsynchronisation
                unsynchronisation: getBit(buf, off + 5, 7),
                // Extended header
                isExtendedHeader: getBit(buf, off + 5, 6),
                // Experimental indicator
                expIndicator: getBit(buf, off + 5, 5),
                footer: getBit(buf, off + 5, 4)
            },
            size: UINT32SYNCSAFE.get(buf, off + 6)
        };
    }
};
const ExtendedHeader = {
    len: 10,
    get: (buf, off) => {
        return {
            // Extended header size
            size: UINT32_BE.get(buf, off),
            // Extended Flags
            extendedFlags: UINT16_BE.get(buf, off + 4),
            // Size of padding
            sizeOfPadding: UINT32_BE.get(buf, off + 6),
            // CRC data present
            crcDataPresent: getBit(buf, off + 4, 31)
        };
    }
};
const TextEncodingToken = {
    len: 1,
    get: (uint8Array, off) => {
        switch (uint8Array[off]) {
            case 0x00:
                return { encoding: 'latin1' }; // binary
            case 0x01:
                return { encoding: 'utf-16le', bom: true };
            case 0x02:
                return { encoding: 'utf-16be', bom: false };
            case 0x03:
                return { encoding: 'utf8', bom: false };
            default:
                return { encoding: 'utf8', bom: false };
        }
    }
};
/**
 * Used to read first portion of `SYLT` frame
 */
const TextHeader = {
    len: 4,
    get: (uint8Array, off) => {
        return {
            encoding: TextEncodingToken.get(uint8Array, off),
            language: new StringType(3, 'latin1').get(uint8Array, off + 1)
        };
    }
};
/**
 * Used to read first portion of `SYLT` frame
 */
const SyncTextHeader = {
    len: 6,
    get: (uint8Array, off) => {
        const text = TextHeader.get(uint8Array, off);
        return {
            encoding: text.encoding,
            language: text.language,
            timeStampFormat: UINT8.get(uint8Array, off + 4),
            contentType: UINT8.get(uint8Array, off + 5)
        };
    }
};

const defaultTagInfo = {
    multiple: false,
};
const commonTags = {
    year: defaultTagInfo,
    track: defaultTagInfo,
    disk: defaultTagInfo,
    title: defaultTagInfo,
    artist: defaultTagInfo,
    artists: { multiple: true, unique: true },
    albumartist: defaultTagInfo,
    albumartists: { multiple: true, unique: true },
    album: defaultTagInfo,
    date: defaultTagInfo,
    originaldate: defaultTagInfo,
    originalyear: defaultTagInfo,
    releasedate: defaultTagInfo,
    comment: { multiple: true, unique: false },
    genre: { multiple: true, unique: true },
    picture: { multiple: true, unique: true },
    composer: { multiple: true, unique: true },
    lyrics: { multiple: true, unique: false },
    albumsort: { multiple: false, unique: true },
    titlesort: { multiple: false, unique: true },
    work: { multiple: false, unique: true },
    artistsort: { multiple: false, unique: true },
    albumartistsort: { multiple: false, unique: true },
    composersort: { multiple: false, unique: true },
    lyricist: { multiple: true, unique: true },
    writer: { multiple: true, unique: true },
    conductor: { multiple: true, unique: true },
    remixer: { multiple: true, unique: true },
    arranger: { multiple: true, unique: true },
    engineer: { multiple: true, unique: true },
    producer: { multiple: true, unique: true },
    technician: { multiple: true, unique: true },
    djmixer: { multiple: true, unique: true },
    mixer: { multiple: true, unique: true },
    label: { multiple: true, unique: true },
    grouping: defaultTagInfo,
    subtitle: { multiple: true },
    discsubtitle: defaultTagInfo,
    totaltracks: defaultTagInfo,
    totaldiscs: defaultTagInfo,
    compilation: defaultTagInfo,
    rating: { multiple: true },
    bpm: defaultTagInfo,
    mood: defaultTagInfo,
    media: defaultTagInfo,
    catalognumber: { multiple: true, unique: true },
    tvShow: defaultTagInfo,
    tvShowSort: defaultTagInfo,
    tvSeason: defaultTagInfo,
    tvEpisode: defaultTagInfo,
    tvEpisodeId: defaultTagInfo,
    tvNetwork: defaultTagInfo,
    podcast: defaultTagInfo,
    podcasturl: defaultTagInfo,
    releasestatus: defaultTagInfo,
    releasetype: { multiple: true },
    releasecountry: defaultTagInfo,
    script: defaultTagInfo,
    language: defaultTagInfo,
    copyright: defaultTagInfo,
    license: defaultTagInfo,
    encodedby: defaultTagInfo,
    encodersettings: defaultTagInfo,
    gapless: defaultTagInfo,
    barcode: defaultTagInfo,
    isrc: { multiple: true },
    asin: defaultTagInfo,
    musicbrainz_recordingid: defaultTagInfo,
    musicbrainz_trackid: defaultTagInfo,
    musicbrainz_albumid: defaultTagInfo,
    musicbrainz_artistid: { multiple: true },
    musicbrainz_albumartistid: { multiple: true },
    musicbrainz_releasegroupid: defaultTagInfo,
    musicbrainz_workid: defaultTagInfo,
    musicbrainz_trmid: defaultTagInfo,
    musicbrainz_discid: defaultTagInfo,
    acoustid_id: defaultTagInfo,
    acoustid_fingerprint: defaultTagInfo,
    musicip_puid: defaultTagInfo,
    musicip_fingerprint: defaultTagInfo,
    website: defaultTagInfo,
    'performer:instrument': { multiple: true, unique: true },
    averageLevel: defaultTagInfo,
    peakLevel: defaultTagInfo,
    notes: { multiple: true, unique: false },
    key: defaultTagInfo,
    originalalbum: defaultTagInfo,
    originalartist: defaultTagInfo,
    discogs_artist_id: { multiple: true, unique: true },
    discogs_release_id: defaultTagInfo,
    discogs_label_id: defaultTagInfo,
    discogs_master_release_id: defaultTagInfo,
    discogs_votes: defaultTagInfo,
    discogs_rating: defaultTagInfo,
    replaygain_track_peak: defaultTagInfo,
    replaygain_track_gain: defaultTagInfo,
    replaygain_album_peak: defaultTagInfo,
    replaygain_album_gain: defaultTagInfo,
    replaygain_track_minmax: defaultTagInfo,
    replaygain_album_minmax: defaultTagInfo,
    replaygain_undo: defaultTagInfo,
    description: { multiple: true },
    longDescription: defaultTagInfo,
    category: { multiple: true },
    hdVideo: defaultTagInfo,
    keywords: { multiple: true },
    movement: defaultTagInfo,
    movementIndex: defaultTagInfo,
    movementTotal: defaultTagInfo,
    podcastId: defaultTagInfo,
    showMovement: defaultTagInfo,
    stik: defaultTagInfo,
    playCounter: defaultTagInfo
};
/**
 * @param alias Name of common tag
 * @returns {boolean|*} true if given alias is mapped as a singleton', otherwise false
 */
function isSingleton(alias) {
    return commonTags[alias] && !commonTags[alias].multiple;
}
/**
 * @param alias Common (generic) tag
 * @returns {boolean|*} true if given alias is a singleton or explicitly marked as unique
 */
function isUnique(alias) {
    return !commonTags[alias].multiple || commonTags[alias].unique || false;
}

class CommonTagMapper {
    static toIntOrNull(str) {
        const cleaned = Number.parseInt(str, 10);
        return Number.isNaN(cleaned) ? null : cleaned;
    }
    // TODO: a string of 1of1 would fail to be converted
    // converts 1/10 to no : 1, of : 10
    // or 1 to no : 1, of : 0
    static normalizeTrack(origVal) {
        const split = origVal.toString().split('/');
        return {
            no: Number.parseInt(split[0], 10) || null,
            of: Number.parseInt(split[1], 10) || null
        };
    }
    constructor(tagTypes, tagMap) {
        this.tagTypes = tagTypes;
        this.tagMap = tagMap;
    }
    /**
     * Process and set common tags
     * write common tags to
     * @param tag Native tag
     * @param warnings Register warnings
     * @return common name
     */
    mapGenericTag(tag, warnings) {
        tag = { id: tag.id, value: tag.value }; // clone object
        this.postMap(tag, warnings);
        // Convert native tag event to generic 'alias' tag
        const id = this.getCommonName(tag.id);
        return id ? { id, value: tag.value } : null;
    }
    /**
     * Convert native tag key to common tag key
     * @param tag Native header tag
     * @return common tag name (alias)
     */
    getCommonName(tag) {
        return this.tagMap[tag];
    }
    /**
     * Handle post mapping exceptions / correction
     * @param tag Tag e.g. {"©alb", "Buena Vista Social Club")
     * @param warnings Used to register warnings
     */
    postMap(_tag, _warnings) {
        return;
    }
}
CommonTagMapper.maxRatingScore = 1;

/**
 * ID3v1 tag mappings
 */
const id3v1TagMap = {
    title: 'title',
    artist: 'artist',
    album: 'album',
    year: 'year',
    comment: 'comment',
    track: 'track',
    genre: 'genre'
};
class ID3v1TagMapper extends CommonTagMapper {
    constructor() {
        super(['ID3v1'], id3v1TagMap);
    }
}

class CaseInsensitiveTagMap extends CommonTagMapper {
    constructor(tagTypes, tagMap) {
        const upperCaseMap = {};
        for (const tag of Object.keys(tagMap)) {
            upperCaseMap[tag.toUpperCase()] = tagMap[tag];
        }
        super(tagTypes, upperCaseMap);
    }
    /**
     * @tag  Native header tag
     * @return common tag name (alias)
     */
    getCommonName(tag) {
        return this.tagMap[tag.toUpperCase()];
    }
}

/**
 * ID3v2.3/ID3v2.4 tag mappings
 */
const id3v24TagMap = {
    // id3v2.3
    TIT2: 'title',
    TPE1: 'artist',
    'TXXX:Artists': 'artists',
    TPE2: 'albumartist',
    TALB: 'album',
    TDRV: 'date', // [ 'date', 'year' ] ToDo: improve 'year' mapping
    /**
     * Original release year
     */
    TORY: 'originalyear',
    TPOS: 'disk',
    TCON: 'genre',
    APIC: 'picture',
    TCOM: 'composer',
    USLT: 'lyrics',
    TSOA: 'albumsort',
    TSOT: 'titlesort',
    TOAL: 'originalalbum',
    TSOP: 'artistsort',
    TSO2: 'albumartistsort',
    TSOC: 'composersort',
    TEXT: 'lyricist',
    'TXXX:Writer': 'writer',
    TPE3: 'conductor',
    // 'IPLS:instrument': 'performer:instrument', // ToDo
    TPE4: 'remixer',
    'IPLS:arranger': 'arranger',
    'IPLS:engineer': 'engineer',
    'IPLS:producer': 'producer',
    'IPLS:DJ-mix': 'djmixer',
    'IPLS:mix': 'mixer',
    TPUB: 'label',
    TIT1: 'grouping',
    TIT3: 'subtitle',
    TRCK: 'track',
    TCMP: 'compilation',
    POPM: 'rating',
    TBPM: 'bpm',
    TMED: 'media',
    'TXXX:CATALOGNUMBER': 'catalognumber',
    'TXXX:MusicBrainz Album Status': 'releasestatus',
    'TXXX:MusicBrainz Album Type': 'releasetype',
    /**
     * Release country as documented: https://picard.musicbrainz.org/docs/mappings/#cite_note-0
     */
    'TXXX:MusicBrainz Album Release Country': 'releasecountry',
    /**
     * Release country as implemented // ToDo: report
     */
    'TXXX:RELEASECOUNTRY': 'releasecountry',
    'TXXX:SCRIPT': 'script',
    TLAN: 'language',
    TCOP: 'copyright',
    WCOP: 'license',
    TENC: 'encodedby',
    TSSE: 'encodersettings',
    'TXXX:BARCODE': 'barcode',
    'TXXX:ISRC': 'isrc',
    TSRC: 'isrc',
    'TXXX:ASIN': 'asin',
    'TXXX:originalyear': 'originalyear',
    'UFID:http://musicbrainz.org': 'musicbrainz_recordingid',
    'TXXX:MusicBrainz Release Track Id': 'musicbrainz_trackid',
    'TXXX:MusicBrainz Album Id': 'musicbrainz_albumid',
    'TXXX:MusicBrainz Artist Id': 'musicbrainz_artistid',
    'TXXX:MusicBrainz Album Artist Id': 'musicbrainz_albumartistid',
    'TXXX:MusicBrainz Release Group Id': 'musicbrainz_releasegroupid',
    'TXXX:MusicBrainz Work Id': 'musicbrainz_workid',
    'TXXX:MusicBrainz TRM Id': 'musicbrainz_trmid',
    'TXXX:MusicBrainz Disc Id': 'musicbrainz_discid',
    'TXXX:ACOUSTID_ID': 'acoustid_id',
    'TXXX:Acoustid Id': 'acoustid_id',
    'TXXX:Acoustid Fingerprint': 'acoustid_fingerprint',
    'TXXX:MusicIP PUID': 'musicip_puid',
    'TXXX:MusicMagic Fingerprint': 'musicip_fingerprint',
    WOAR: 'website',
    // id3v2.4
    // ToDo: In same sequence as defined at http://id3.org/id3v2.4.0-frames
    TDRC: 'date', // date YYYY-MM-DD
    TYER: 'year',
    TDOR: 'originaldate',
    // 'TMCL:instrument': 'performer:instrument',
    'TIPL:arranger': 'arranger',
    'TIPL:engineer': 'engineer',
    'TIPL:producer': 'producer',
    'TIPL:DJ-mix': 'djmixer',
    'TIPL:mix': 'mixer',
    TMOO: 'mood',
    // additional mappings:
    SYLT: 'lyrics',
    TSST: 'discsubtitle',
    TKEY: 'key',
    COMM: 'comment',
    TOPE: 'originalartist',
    // Windows Media Player
    'PRIV:AverageLevel': 'averageLevel',
    'PRIV:PeakLevel': 'peakLevel',
    // Discogs
    'TXXX:DISCOGS_ARTIST_ID': 'discogs_artist_id',
    'TXXX:DISCOGS_ARTISTS': 'artists',
    'TXXX:DISCOGS_ARTIST_NAME': 'artists',
    'TXXX:DISCOGS_ALBUM_ARTISTS': 'albumartist',
    'TXXX:DISCOGS_CATALOG': 'catalognumber',
    'TXXX:DISCOGS_COUNTRY': 'releasecountry',
    'TXXX:DISCOGS_DATE': 'originaldate',
    'TXXX:DISCOGS_LABEL': 'label',
    'TXXX:DISCOGS_LABEL_ID': 'discogs_label_id',
    'TXXX:DISCOGS_MASTER_RELEASE_ID': 'discogs_master_release_id',
    'TXXX:DISCOGS_RATING': 'discogs_rating',
    'TXXX:DISCOGS_RELEASED': 'date',
    'TXXX:DISCOGS_RELEASE_ID': 'discogs_release_id',
    'TXXX:DISCOGS_VOTES': 'discogs_votes',
    'TXXX:CATALOGID': 'catalognumber',
    'TXXX:STYLE': 'genre',
    'TXXX:REPLAYGAIN_TRACK_PEAK': 'replaygain_track_peak',
    'TXXX:REPLAYGAIN_TRACK_GAIN': 'replaygain_track_gain',
    'TXXX:REPLAYGAIN_ALBUM_PEAK': 'replaygain_album_peak',
    'TXXX:REPLAYGAIN_ALBUM_GAIN': 'replaygain_album_gain',
    'TXXX:MP3GAIN_MINMAX': 'replaygain_track_minmax',
    'TXXX:MP3GAIN_ALBUM_MINMAX': 'replaygain_album_minmax',
    'TXXX:MP3GAIN_UNDO': 'replaygain_undo',
    MVNM: 'movement',
    MVIN: 'movementIndex',
    PCST: 'podcast',
    TCAT: 'category',
    TDES: 'description',
    TDRL: 'releasedate',
    TGID: 'podcastId',
    TKWD: 'keywords',
    WFED: 'podcasturl',
    GRP1: 'grouping',
    PCNT: 'playCounter',
};
class ID3v24TagMapper extends CaseInsensitiveTagMap {
    static toRating(popm) {
        return {
            source: popm.email,
            rating: popm.rating > 0 ? (popm.rating - 1) / 254 * CommonTagMapper.maxRatingScore : undefined
        };
    }
    constructor() {
        super(['ID3v2.3', 'ID3v2.4'], id3v24TagMap);
    }
    /**
     * Handle post mapping exceptions / correction
     * @param tag to post map
     * @param warnings Wil be used to register (collect) warnings
     */
    postMap(tag, warnings) {
        switch (tag.id) {
            case 'UFID':
                {
                    // decode MusicBrainz Recording Id
                    const idTag = tag.value;
                    if (idTag.owner_identifier === 'http://musicbrainz.org') {
                        tag.id += `:${idTag.owner_identifier}`;
                        tag.value = decodeString(idTag.identifier, 'latin1'); // latin1 == iso-8859-1
                    }
                }
                break;
            case 'PRIV':
                {
                    const customTag = tag.value;
                    switch (customTag.owner_identifier) {
                        // decode Windows Media Player
                        case 'AverageLevel':
                        case 'PeakValue':
                            tag.id += `:${customTag.owner_identifier}`;
                            tag.value = customTag.data.length === 4 ? UINT32_LE.get(customTag.data, 0) : null;
                            if (tag.value === null) {
                                warnings.addWarning('Failed to parse PRIV:PeakValue');
                            }
                            break;
                        default:
                            warnings.addWarning(`Unknown PRIV owner-identifier: ${customTag.data}`);
                    }
                }
                break;
            case 'POPM':
                tag.value = ID3v24TagMapper.toRating(tag.value);
                break;
        }
    }
}

/**
 * ASF Metadata tag mappings.
 * See http://msdn.microsoft.com/en-us/library/ms867702.aspx
 */
const asfTagMap = {
    Title: 'title',
    Author: 'artist',
    'WM/AlbumArtist': 'albumartist',
    'WM/AlbumTitle': 'album',
    'WM/Year': 'date', // changed to 'year' to 'date' based on Picard mappings; ToDo: check me
    'WM/OriginalReleaseTime': 'originaldate',
    'WM/OriginalReleaseYear': 'originalyear',
    Description: 'comment',
    'WM/TrackNumber': 'track',
    'WM/PartOfSet': 'disk',
    'WM/Genre': 'genre',
    'WM/Composer': 'composer',
    'WM/Lyrics': 'lyrics',
    'WM/AlbumSortOrder': 'albumsort',
    'WM/TitleSortOrder': 'titlesort',
    'WM/ArtistSortOrder': 'artistsort',
    'WM/AlbumArtistSortOrder': 'albumartistsort',
    'WM/ComposerSortOrder': 'composersort',
    'WM/Writer': 'lyricist',
    'WM/Conductor': 'conductor',
    'WM/ModifiedBy': 'remixer',
    'WM/Engineer': 'engineer',
    'WM/Producer': 'producer',
    'WM/DJMixer': 'djmixer',
    'WM/Mixer': 'mixer',
    'WM/Publisher': 'label',
    'WM/ContentGroupDescription': 'grouping',
    'WM/SubTitle': 'subtitle',
    'WM/SetSubTitle': 'discsubtitle',
    // 'WM/PartOfSet': 'totaldiscs',
    'WM/IsCompilation': 'compilation',
    'WM/SharedUserRating': 'rating',
    'WM/BeatsPerMinute': 'bpm',
    'WM/Mood': 'mood',
    'WM/Media': 'media',
    'WM/CatalogNo': 'catalognumber',
    'MusicBrainz/Album Status': 'releasestatus',
    'MusicBrainz/Album Type': 'releasetype',
    'MusicBrainz/Album Release Country': 'releasecountry',
    'WM/Script': 'script',
    'WM/Language': 'language',
    Copyright: 'copyright',
    LICENSE: 'license',
    'WM/EncodedBy': 'encodedby',
    'WM/EncodingSettings': 'encodersettings',
    'WM/Barcode': 'barcode',
    'WM/ISRC': 'isrc',
    'MusicBrainz/Track Id': 'musicbrainz_recordingid',
    'MusicBrainz/Release Track Id': 'musicbrainz_trackid',
    'MusicBrainz/Album Id': 'musicbrainz_albumid',
    'MusicBrainz/Artist Id': 'musicbrainz_artistid',
    'MusicBrainz/Album Artist Id': 'musicbrainz_albumartistid',
    'MusicBrainz/Release Group Id': 'musicbrainz_releasegroupid',
    'MusicBrainz/Work Id': 'musicbrainz_workid',
    'MusicBrainz/TRM Id': 'musicbrainz_trmid',
    'MusicBrainz/Disc Id': 'musicbrainz_discid',
    'Acoustid/Id': 'acoustid_id',
    'Acoustid/Fingerprint': 'acoustid_fingerprint',
    'MusicIP/PUID': 'musicip_puid',
    'WM/ARTISTS': 'artists',
    'WM/InitialKey': 'key',
    ASIN: 'asin',
    'WM/Work': 'work',
    'WM/AuthorURL': 'website',
    'WM/Picture': 'picture'
};
class AsfTagMapper extends CommonTagMapper {
    static toRating(rating) {
        return {
            rating: Number.parseFloat(rating + 1) / 5
        };
    }
    constructor() {
        super(['asf'], asfTagMap);
    }
    postMap(tag) {
        switch (tag.id) {
            case 'WM/SharedUserRating': {
                const keys = tag.id.split(':');
                tag.value = AsfTagMapper.toRating(tag.value);
                tag.id = keys[0];
                break;
            }
        }
    }
}

/**
 * ID3v2.2 tag mappings
 */
const id3v22TagMap = {
    TT2: 'title',
    TP1: 'artist',
    TP2: 'albumartist',
    TAL: 'album',
    TYE: 'year',
    COM: 'comment',
    TRK: 'track',
    TPA: 'disk',
    TCO: 'genre',
    PIC: 'picture',
    TCM: 'composer',
    TOR: 'originaldate',
    TOT: 'originalalbum',
    TXT: 'lyricist',
    TP3: 'conductor',
    TPB: 'label',
    TT1: 'grouping',
    TT3: 'subtitle',
    TLA: 'language',
    TCR: 'copyright',
    WCP: 'license',
    TEN: 'encodedby',
    TSS: 'encodersettings',
    WAR: 'website',
    PCS: 'podcast',
    TCP: "compilation",
    TDR: 'date',
    TS2: 'albumartistsort',
    TSA: 'albumsort',
    TSC: 'composersort',
    TSP: 'artistsort',
    TST: 'titlesort',
    WFD: 'podcasturl',
    TBP: 'bpm',
    GP1: 'grouping'
};
class ID3v22TagMapper extends CaseInsensitiveTagMap {
    constructor() {
        super(['ID3v2.2'], id3v22TagMap);
    }
}

/**
 * ID3v2.2 tag mappings
 */
const apev2TagMap = {
    Title: 'title',
    Artist: 'artist',
    Artists: 'artists',
    'Album Artist': 'albumartist',
    Album: 'album',
    Year: 'date',
    Originalyear: 'originalyear',
    Originaldate: 'originaldate',
    Releasedate: 'releasedate',
    Comment: 'comment',
    Track: 'track',
    Disc: 'disk',
    DISCNUMBER: 'disk', // ToDo: backwards compatibility', valid tag?
    Genre: 'genre',
    'Cover Art (Front)': 'picture',
    'Cover Art (Back)': 'picture',
    Composer: 'composer',
    Lyrics: 'lyrics',
    ALBUMSORT: 'albumsort',
    TITLESORT: 'titlesort',
    WORK: 'work',
    ARTISTSORT: 'artistsort',
    ALBUMARTISTSORT: 'albumartistsort',
    COMPOSERSORT: 'composersort',
    Lyricist: 'lyricist',
    Writer: 'writer',
    Conductor: 'conductor',
    // 'Performer=artist (instrument)': 'performer:instrument',
    MixArtist: 'remixer',
    Arranger: 'arranger',
    Engineer: 'engineer',
    Producer: 'producer',
    DJMixer: 'djmixer',
    Mixer: 'mixer',
    Label: 'label',
    Grouping: 'grouping',
    Subtitle: 'subtitle',
    DiscSubtitle: 'discsubtitle',
    Compilation: 'compilation',
    BPM: 'bpm',
    Mood: 'mood',
    Media: 'media',
    CatalogNumber: 'catalognumber',
    MUSICBRAINZ_ALBUMSTATUS: 'releasestatus',
    MUSICBRAINZ_ALBUMTYPE: 'releasetype',
    RELEASECOUNTRY: 'releasecountry',
    Script: 'script',
    Language: 'language',
    Copyright: 'copyright',
    LICENSE: 'license',
    EncodedBy: 'encodedby',
    EncoderSettings: 'encodersettings',
    Barcode: 'barcode',
    ISRC: 'isrc',
    ASIN: 'asin',
    musicbrainz_trackid: 'musicbrainz_recordingid',
    musicbrainz_releasetrackid: 'musicbrainz_trackid',
    MUSICBRAINZ_ALBUMID: 'musicbrainz_albumid',
    MUSICBRAINZ_ARTISTID: 'musicbrainz_artistid',
    MUSICBRAINZ_ALBUMARTISTID: 'musicbrainz_albumartistid',
    MUSICBRAINZ_RELEASEGROUPID: 'musicbrainz_releasegroupid',
    MUSICBRAINZ_WORKID: 'musicbrainz_workid',
    MUSICBRAINZ_TRMID: 'musicbrainz_trmid',
    MUSICBRAINZ_DISCID: 'musicbrainz_discid',
    Acoustid_Id: 'acoustid_id',
    ACOUSTID_FINGERPRINT: 'acoustid_fingerprint',
    MUSICIP_PUID: 'musicip_puid',
    Weblink: 'website',
    REPLAYGAIN_TRACK_GAIN: 'replaygain_track_gain',
    REPLAYGAIN_TRACK_PEAK: 'replaygain_track_peak',
    MP3GAIN_MINMAX: 'replaygain_track_minmax',
    MP3GAIN_UNDO: 'replaygain_undo'
};
class APEv2TagMapper extends CaseInsensitiveTagMap {
    constructor() {
        super(['APEv2'], apev2TagMap);
    }
}

/**
 * Ref: https://github.com/sergiomb2/libmp4v2/wiki/iTunesMetadata
 */
const mp4TagMap = {
    '©nam': 'title',
    '©ART': 'artist',
    aART: 'albumartist',
    /**
     * ToDo: Album artist seems to be stored here while Picard documentation says: aART
     */
    '----:com.apple.iTunes:Band': 'albumartist',
    '©alb': 'album',
    '©day': 'date',
    '©cmt': 'comment',
    '©com': 'comment',
    trkn: 'track',
    disk: 'disk',
    '©gen': 'genre',
    covr: 'picture',
    '©wrt': 'composer',
    '©lyr': 'lyrics',
    soal: 'albumsort',
    sonm: 'titlesort',
    soar: 'artistsort',
    soaa: 'albumartistsort',
    soco: 'composersort',
    '----:com.apple.iTunes:LYRICIST': 'lyricist',
    '----:com.apple.iTunes:CONDUCTOR': 'conductor',
    '----:com.apple.iTunes:REMIXER': 'remixer',
    '----:com.apple.iTunes:ENGINEER': 'engineer',
    '----:com.apple.iTunes:PRODUCER': 'producer',
    '----:com.apple.iTunes:DJMIXER': 'djmixer',
    '----:com.apple.iTunes:MIXER': 'mixer',
    '----:com.apple.iTunes:LABEL': 'label',
    '©grp': 'grouping',
    '----:com.apple.iTunes:SUBTITLE': 'subtitle',
    '----:com.apple.iTunes:DISCSUBTITLE': 'discsubtitle',
    cpil: 'compilation',
    tmpo: 'bpm',
    '----:com.apple.iTunes:MOOD': 'mood',
    '----:com.apple.iTunes:MEDIA': 'media',
    '----:com.apple.iTunes:CATALOGNUMBER': 'catalognumber',
    tvsh: 'tvShow',
    tvsn: 'tvSeason',
    tves: 'tvEpisode',
    sosn: 'tvShowSort',
    tven: 'tvEpisodeId',
    tvnn: 'tvNetwork',
    pcst: 'podcast',
    purl: 'podcasturl',
    '----:com.apple.iTunes:MusicBrainz Album Status': 'releasestatus',
    '----:com.apple.iTunes:MusicBrainz Album Type': 'releasetype',
    '----:com.apple.iTunes:MusicBrainz Album Release Country': 'releasecountry',
    '----:com.apple.iTunes:SCRIPT': 'script',
    '----:com.apple.iTunes:LANGUAGE': 'language',
    cprt: 'copyright',
    '©cpy': 'copyright',
    '----:com.apple.iTunes:LICENSE': 'license',
    '©too': 'encodedby',
    pgap: 'gapless',
    '----:com.apple.iTunes:BARCODE': 'barcode',
    '----:com.apple.iTunes:ISRC': 'isrc',
    '----:com.apple.iTunes:ASIN': 'asin',
    '----:com.apple.iTunes:NOTES': 'comment',
    '----:com.apple.iTunes:MusicBrainz Track Id': 'musicbrainz_recordingid',
    '----:com.apple.iTunes:MusicBrainz Release Track Id': 'musicbrainz_trackid',
    '----:com.apple.iTunes:MusicBrainz Album Id': 'musicbrainz_albumid',
    '----:com.apple.iTunes:MusicBrainz Artist Id': 'musicbrainz_artistid',
    '----:com.apple.iTunes:MusicBrainz Album Artist Id': 'musicbrainz_albumartistid',
    '----:com.apple.iTunes:MusicBrainz Release Group Id': 'musicbrainz_releasegroupid',
    '----:com.apple.iTunes:MusicBrainz Work Id': 'musicbrainz_workid',
    '----:com.apple.iTunes:MusicBrainz TRM Id': 'musicbrainz_trmid',
    '----:com.apple.iTunes:MusicBrainz Disc Id': 'musicbrainz_discid',
    '----:com.apple.iTunes:Acoustid Id': 'acoustid_id',
    '----:com.apple.iTunes:Acoustid Fingerprint': 'acoustid_fingerprint',
    '----:com.apple.iTunes:MusicIP PUID': 'musicip_puid',
    '----:com.apple.iTunes:fingerprint': 'musicip_fingerprint',
    '----:com.apple.iTunes:replaygain_track_gain': 'replaygain_track_gain',
    '----:com.apple.iTunes:replaygain_track_peak': 'replaygain_track_peak',
    '----:com.apple.iTunes:replaygain_album_gain': 'replaygain_album_gain',
    '----:com.apple.iTunes:replaygain_album_peak': 'replaygain_album_peak',
    '----:com.apple.iTunes:replaygain_track_minmax': 'replaygain_track_minmax',
    '----:com.apple.iTunes:replaygain_album_minmax': 'replaygain_album_minmax',
    '----:com.apple.iTunes:replaygain_undo': 'replaygain_undo',
    // Additional mappings:
    gnre: 'genre', // ToDo: check mapping
    '----:com.apple.iTunes:ALBUMARTISTSORT': 'albumartistsort',
    '----:com.apple.iTunes:ARTISTS': 'artists',
    '----:com.apple.iTunes:ORIGINALDATE': 'originaldate',
    '----:com.apple.iTunes:ORIGINALYEAR': 'originalyear',
    '----:com.apple.iTunes:RELEASEDATE': 'releasedate',
    // '----:com.apple.iTunes:PERFORMER': 'performer'
    desc: 'description',
    ldes: 'longDescription',
    '©mvn': 'movement',
    '©mvi': 'movementIndex',
    '©mvc': 'movementTotal',
    '©wrk': 'work',
    catg: 'category',
    egid: 'podcastId',
    hdvd: 'hdVideo',
    keyw: 'keywords',
    shwm: 'showMovement',
    stik: 'stik',
    rate: 'rating'
};
const tagType = 'iTunes';
class MP4TagMapper extends CaseInsensitiveTagMap {
    constructor() {
        super([tagType], mp4TagMap);
    }
    postMap(tag, _warnings) {
        switch (tag.id) {
            case 'rate':
                tag.value = {
                    source: undefined,
                    rating: Number.parseFloat(tag.value) / 100
                };
                break;
        }
    }
}

/**
 * Vorbis tag mappings
 *
 * Mapping from native header format to one or possibly more 'common' entries
 * The common entries aim to read the same information from different media files
 * independent of the underlying format
 */
const vorbisTagMap = {
    TITLE: 'title',
    ARTIST: 'artist',
    ARTISTS: 'artists',
    ALBUMARTIST: 'albumartist',
    'ALBUM ARTIST': 'albumartist',
    ALBUM: 'album',
    DATE: 'date',
    ORIGINALDATE: 'originaldate',
    ORIGINALYEAR: 'originalyear',
    RELEASEDATE: 'releasedate',
    COMMENT: 'comment',
    TRACKNUMBER: 'track',
    DISCNUMBER: 'disk',
    GENRE: 'genre',
    METADATA_BLOCK_PICTURE: 'picture',
    COMPOSER: 'composer',
    LYRICS: 'lyrics',
    ALBUMSORT: 'albumsort',
    TITLESORT: 'titlesort',
    WORK: 'work',
    ARTISTSORT: 'artistsort',
    ALBUMARTISTSORT: 'albumartistsort',
    COMPOSERSORT: 'composersort',
    LYRICIST: 'lyricist',
    WRITER: 'writer',
    CONDUCTOR: 'conductor',
    // 'PERFORMER=artist (instrument)': 'performer:instrument', // ToDo
    REMIXER: 'remixer',
    ARRANGER: 'arranger',
    ENGINEER: 'engineer',
    PRODUCER: 'producer',
    DJMIXER: 'djmixer',
    MIXER: 'mixer',
    LABEL: 'label',
    GROUPING: 'grouping',
    SUBTITLE: 'subtitle',
    DISCSUBTITLE: 'discsubtitle',
    TRACKTOTAL: 'totaltracks',
    DISCTOTAL: 'totaldiscs',
    COMPILATION: 'compilation',
    RATING: 'rating',
    BPM: 'bpm',
    KEY: 'key',
    MOOD: 'mood',
    MEDIA: 'media',
    CATALOGNUMBER: 'catalognumber',
    RELEASESTATUS: 'releasestatus',
    RELEASETYPE: 'releasetype',
    RELEASECOUNTRY: 'releasecountry',
    SCRIPT: 'script',
    LANGUAGE: 'language',
    COPYRIGHT: 'copyright',
    LICENSE: 'license',
    ENCODEDBY: 'encodedby',
    ENCODERSETTINGS: 'encodersettings',
    BARCODE: 'barcode',
    ISRC: 'isrc',
    ASIN: 'asin',
    MUSICBRAINZ_TRACKID: 'musicbrainz_recordingid',
    MUSICBRAINZ_RELEASETRACKID: 'musicbrainz_trackid',
    MUSICBRAINZ_ALBUMID: 'musicbrainz_albumid',
    MUSICBRAINZ_ARTISTID: 'musicbrainz_artistid',
    MUSICBRAINZ_ALBUMARTISTID: 'musicbrainz_albumartistid',
    MUSICBRAINZ_RELEASEGROUPID: 'musicbrainz_releasegroupid',
    MUSICBRAINZ_WORKID: 'musicbrainz_workid',
    MUSICBRAINZ_TRMID: 'musicbrainz_trmid',
    MUSICBRAINZ_DISCID: 'musicbrainz_discid',
    ACOUSTID_ID: 'acoustid_id',
    ACOUSTID_ID_FINGERPRINT: 'acoustid_fingerprint',
    MUSICIP_PUID: 'musicip_puid',
    // 'FINGERPRINT=MusicMagic Fingerprint {fingerprint}': 'musicip_fingerprint', // ToDo
    WEBSITE: 'website',
    NOTES: 'notes',
    TOTALTRACKS: 'totaltracks',
    TOTALDISCS: 'totaldiscs',
    // Discogs
    DISCOGS_ARTIST_ID: 'discogs_artist_id',
    DISCOGS_ARTISTS: 'artists',
    DISCOGS_ARTIST_NAME: 'artists',
    DISCOGS_ALBUM_ARTISTS: 'albumartist',
    DISCOGS_CATALOG: 'catalognumber',
    DISCOGS_COUNTRY: 'releasecountry',
    DISCOGS_DATE: 'originaldate',
    DISCOGS_LABEL: 'label',
    DISCOGS_LABEL_ID: 'discogs_label_id',
    DISCOGS_MASTER_RELEASE_ID: 'discogs_master_release_id',
    DISCOGS_RATING: 'discogs_rating',
    DISCOGS_RELEASED: 'date',
    DISCOGS_RELEASE_ID: 'discogs_release_id',
    DISCOGS_VOTES: 'discogs_votes',
    CATALOGID: 'catalognumber',
    STYLE: 'genre',
    //
    REPLAYGAIN_TRACK_GAIN: 'replaygain_track_gain',
    REPLAYGAIN_TRACK_PEAK: 'replaygain_track_peak',
    REPLAYGAIN_ALBUM_GAIN: 'replaygain_album_gain',
    REPLAYGAIN_ALBUM_PEAK: 'replaygain_album_peak',
    // To Sure if these (REPLAYGAIN_MINMAX, REPLAYGAIN_ALBUM_MINMAX & REPLAYGAIN_UNDO) are used for Vorbis:
    REPLAYGAIN_MINMAX: 'replaygain_track_minmax',
    REPLAYGAIN_ALBUM_MINMAX: 'replaygain_album_minmax',
    REPLAYGAIN_UNDO: 'replaygain_undo'
};
class VorbisTagMapper extends CommonTagMapper {
    static toRating(email, rating, maxScore) {
        return {
            source: email ? email.toLowerCase() : undefined,
            rating: (Number.parseFloat(rating) / maxScore) * CommonTagMapper.maxRatingScore
        };
    }
    constructor() {
        super(['vorbis'], vorbisTagMap);
    }
    postMap(tag) {
        if (tag.id === 'RATING') {
            // The way Winamp 5.666 assigns rating
            tag.value = VorbisTagMapper.toRating(undefined, tag.value, 100);
        }
        else if (tag.id.indexOf('RATING:') === 0) {
            const keys = tag.id.split(':');
            tag.value = VorbisTagMapper.toRating(keys[1], tag.value, 1);
            tag.id = keys[0];
        }
    }
}

/**
 * RIFF Info Tags; part of the EXIF 2.3
 * Ref: http://owl.phy.queensu.ca/~phil/exiftool/TagNames/RIFF.html#Info
 */
const riffInfoTagMap = {
    IART: 'artist', // Artist
    ICRD: 'date', // DateCreated
    INAM: 'title', // Title
    TITL: 'title',
    IPRD: 'album', // Product
    ITRK: 'track',
    IPRT: 'track', // Additional tag for track index
    COMM: 'comment', // Comments
    ICMT: 'comment', // Country
    ICNT: 'releasecountry',
    GNRE: 'genre', // Genre
    IWRI: 'writer', // WrittenBy
    RATE: 'rating',
    YEAR: 'year',
    ISFT: 'encodedby', // Software
    CODE: 'encodedby', // EncodedBy
    TURL: 'website', // URL,
    IGNR: 'genre', // Genre
    IENG: 'engineer', // Engineer
    ITCH: 'technician', // Technician
    IMED: 'media', // Original Media
    IRPD: 'album' // Product, where the file was intended for
};
class RiffInfoTagMapper extends CommonTagMapper {
    constructor() {
        super(['exif'], riffInfoTagMap);
    }
}

/**
 * EBML Tag map
 */
const ebmlTagMap = {
    'segment:title': 'title',
    'album:ARTIST': 'albumartist',
    'album:ARTISTSORT': 'albumartistsort',
    'album:TITLE': 'album',
    'album:DATE_RECORDED': 'originaldate',
    'album:DATE_RELEASED': 'releasedate',
    'album:PART_NUMBER': 'disk',
    'album:TOTAL_PARTS': 'totaltracks',
    'track:ARTIST': 'artist',
    'track:ARTISTSORT': 'artistsort',
    'track:TITLE': 'title',
    'track:PART_NUMBER': 'track',
    'track:MUSICBRAINZ_TRACKID': 'musicbrainz_recordingid',
    'track:MUSICBRAINZ_ALBUMID': 'musicbrainz_albumid',
    'track:MUSICBRAINZ_ARTISTID': 'musicbrainz_artistid',
    'track:PUBLISHER': 'label',
    'track:GENRE': 'genre',
    'track:ENCODER': 'encodedby',
    'track:ENCODER_OPTIONS': 'encodersettings',
    'edition:TOTAL_PARTS': 'totaldiscs',
    picture: 'picture'
};
class MatroskaTagMapper extends CaseInsensitiveTagMap {
    constructor() {
        super(['matroska'], ebmlTagMap);
    }
}

/**
 * ID3v1 tag mappings
 */
const tagMap = {
    NAME: 'title',
    AUTH: 'artist',
    '(c) ': 'copyright',
    ANNO: 'comment'
};
class AiffTagMapper extends CommonTagMapper {
    constructor() {
        super(['AIFF'], tagMap);
    }
}

class CombinedTagMapper {
    constructor() {
        this.tagMappers = {};
        [
            new ID3v1TagMapper(),
            new ID3v22TagMapper(),
            new ID3v24TagMapper(),
            new MP4TagMapper(),
            new MP4TagMapper(),
            new VorbisTagMapper(),
            new APEv2TagMapper(),
            new AsfTagMapper(),
            new RiffInfoTagMapper(),
            new MatroskaTagMapper(),
            new AiffTagMapper()
        ].forEach(mapper => {
            this.registerTagMapper(mapper);
        });
    }
    /**
     * Convert native to generic (common) tags
     * @param tagType Originating tag format
     * @param tag     Native tag to map to a generic tag id
     * @param warnings
     * @return Generic tag result (output of this function)
     */
    mapTag(tagType, tag, warnings) {
        const tagMapper = this.tagMappers[tagType];
        if (tagMapper) {
            return this.tagMappers[tagType].mapGenericTag(tag, warnings);
        }
        throw new InternalParserError(`No generic tag mapper defined for tag-format: ${tagType}`);
    }
    registerTagMapper(genericTagMapper) {
        for (const tagType of genericTagMapper.tagTypes) {
            this.tagMappers[tagType] = genericTagMapper;
        }
    }
}

// Shared timestamp regex for LRC format
const TIMESTAMP_REGEX = /\[(\d{2}):(\d{2})\.(\d{2,3})]/;
function parseLyrics(input) {
    if (TIMESTAMP_REGEX.test(input)) {
        return parseLrc(input);
    }
    return toUnsyncedLyrics(input);
}
function toUnsyncedLyrics(lyrics) {
    return {
        contentType: LyricsContentType.lyrics,
        timeStampFormat: TimestampFormat.notSynchronized,
        text: lyrics.trim(),
        syncText: [],
    };
}
/**
 * Parse LRC (Lyrics) formatted text
 * Ref: https://en.wikipedia.org/wiki/LRC_(file_format)
 * @param lrcString
 */
function parseLrc(lrcString) {
    const lines = lrcString.split('\n');
    const syncText = [];
    for (const line of lines) {
        const match = line.match(TIMESTAMP_REGEX);
        if (match) {
            const minutes = Number.parseInt(match[1], 10);
            const seconds = Number.parseInt(match[2], 10);
            const ms = match[3].length === 3
                ? Number.parseInt(match[3], 10)
                : Number.parseInt(match[3], 10) * 10;
            const timestamp = (minutes * 60 + seconds) * 1000 + ms;
            const text = line.replace(TIMESTAMP_REGEX, '').trim();
            syncText.push({ timestamp, text });
        }
    }
    return {
        contentType: LyricsContentType.lyrics,
        timeStampFormat: TimestampFormat.milliseconds,
        text: syncText.map(line => line.text).join('\n'),
        syncText,
    };
}

const debug$3 = initDebug('music-metadata:collector');
const TagPriority = ['matroska', 'APEv2', 'vorbis', 'ID3v2.4', 'ID3v2.3', 'ID3v2.2', 'exif', 'asf', 'iTunes', 'AIFF', 'ID3v1'];
/**
 * Provided to the parser to uodate the metadata result.
 * Responsible for triggering async updates
 */
class MetadataCollector {
    constructor(opts) {
        this.format = {
            tagTypes: [],
            trackInfo: []
        };
        this.native = {};
        this.common = {
            track: { no: null, of: null },
            disk: { no: null, of: null },
            movementIndex: { no: null, of: null }
        };
        this.quality = {
            warnings: []
        };
        /**
         * Keeps track of origin priority for each mapped id
         */
        this.commonOrigin = {};
        /**
         * Maps a tag type to a priority
         */
        this.originPriority = {};
        this.tagMapper = new CombinedTagMapper();
        this.opts = opts;
        let priority = 1;
        for (const tagType of TagPriority) {
            this.originPriority[tagType] = priority++;
        }
        this.originPriority.artificial = 500; // Filled using alternative tags
        this.originPriority.id3v1 = 600; // Consider as the worst because of the field length limit
    }
    /**
     * @returns {boolean} true if one or more tags have been found
     */
    hasAny() {
        return Object.keys(this.native).length > 0;
    }
    addStreamInfo(streamInfo) {
        debug$3(`streamInfo: type=${streamInfo.type ? TrackTypeValueToKeyMap[streamInfo.type] : '?'}, codec=${streamInfo.codecName}`);
        this.format.trackInfo.push(streamInfo);
    }
    setFormat(key, value) {
        debug$3(`format: ${key} = ${value}`);
        this.format[key] = value; // as any to override readonly
        if (this.opts?.observer) {
            this.opts.observer({ metadata: this, tag: { type: 'format', id: key, value } });
        }
    }
    setAudioOnly() {
        this.setFormat('hasAudio', true);
        this.setFormat('hasVideo', false);
    }
    async addTag(tagType, tagId, value) {
        debug$3(`tag ${tagType}.${tagId} = ${value}`);
        if (!this.native[tagType]) {
            this.format.tagTypes.push(tagType);
            this.native[tagType] = [];
        }
        this.native[tagType].push({ id: tagId, value });
        await this.toCommon(tagType, tagId, value);
    }
    addWarning(warning) {
        this.quality.warnings.push({ message: warning });
    }
    async postMap(tagType, tag) {
        // Common tag (alias) found
        // check if we need to do something special with common tag
        // if the event has been aliased then we need to clean it before
        // it is emitted to the user. e.g. genre (20) -> Electronic
        switch (tag.id) {
            case 'artist':
                return this.handleSingularArtistTag(tagType, tag, 'artist', 'artists');
            case 'albumartist':
                return this.handleSingularArtistTag(tagType, tag, 'albumartist', 'albumartists');
            case 'artists':
                return this.handlePluralArtistTag(tagType, tag, 'artist', 'artists');
            case 'albumartists':
                return this.handlePluralArtistTag(tagType, tag, 'albumartist', 'albumartists');
            case 'picture':
                return this.postFixPicture(tag.value).then(picture => {
                    if (picture !== null) {
                        tag.value = picture;
                        this.setGenericTag(tagType, tag);
                    }
                });
            case 'totaltracks':
                this.common.track.of = CommonTagMapper.toIntOrNull(tag.value);
                return;
            case 'totaldiscs':
                this.common.disk.of = CommonTagMapper.toIntOrNull(tag.value);
                return;
            case 'movementTotal':
                this.common.movementIndex.of = CommonTagMapper.toIntOrNull(tag.value);
                return;
            case 'track':
            case 'disk':
            case 'movementIndex': {
                const of = this.common[tag.id].of; // store of value, maybe maybe overwritten
                this.common[tag.id] = CommonTagMapper.normalizeTrack(tag.value);
                this.common[tag.id].of = of != null ? of : this.common[tag.id].of;
                return;
            }
            case 'bpm':
            case 'year':
            case 'originalyear':
                tag.value = Number.parseInt(tag.value, 10);
                break;
            case 'date': {
                // ToDo: be more strict on 'YYYY...'
                const year = Number.parseInt(tag.value.substr(0, 4), 10);
                if (!Number.isNaN(year)) {
                    this.common.year = year;
                }
                break;
            }
            case 'discogs_label_id':
            case 'discogs_release_id':
            case 'discogs_master_release_id':
            case 'discogs_artist_id':
            case 'discogs_votes':
                tag.value = typeof tag.value === 'string' ? Number.parseInt(tag.value, 10) : tag.value;
                break;
            case 'replaygain_track_gain':
            case 'replaygain_track_peak':
            case 'replaygain_album_gain':
            case 'replaygain_album_peak':
                tag.value = toRatio(tag.value);
                break;
            case 'replaygain_track_minmax':
                tag.value = tag.value.split(',').map(v => Number.parseInt(v, 10));
                break;
            case 'replaygain_undo': {
                const minMix = tag.value.split(',').map(v => Number.parseInt(v, 10));
                tag.value = {
                    leftChannel: minMix[0],
                    rightChannel: minMix[1]
                };
                break;
            }
            case 'gapless': // iTunes gap-less flag
            case 'compilation':
            case 'podcast':
            case 'showMovement':
                tag.value = tag.value === '1' || tag.value === 1; // boolean
                break;
            case 'isrc': { // Only keep unique values
                const commonTag = this.common[tag.id];
                if (commonTag && commonTag.indexOf(tag.value) !== -1)
                    return;
                break;
            }
            case 'comment':
                if (typeof tag.value === 'string') {
                    tag.value = { text: tag.value };
                }
                if (tag.value.descriptor === 'iTunPGAP') {
                    this.setGenericTag(tagType, { id: 'gapless', value: tag.value.text === '1' });
                }
                break;
            case 'lyrics':
                if (typeof tag.value === 'string') {
                    tag.value = parseLyrics(tag.value);
                }
                break;
            // nothing to do
        }
        if (tag.value !== null) {
            this.setGenericTag(tagType, tag);
        }
    }
    /**
     * Convert native tags to common tags
     * @returns {IAudioMetadata} Native + common tags
     */
    toCommonMetadata() {
        return {
            format: this.format,
            native: this.native,
            quality: this.quality,
            common: this.common
        };
    }
    /**
     * Handle singular artist tags (artist, albumartist) and cross-populate to plural form
     */
    handleSingularArtistTag(tagType, tag, singularId, pluralId) {
        if (this.commonOrigin[singularId] === this.originPriority[tagType]) {
            // Assume the singular field is used as plural (multiple values from same source)
            return this.postMap('artificial', { id: pluralId, value: tag.value });
        }
        if (!this.common[pluralId]) {
            // Fill plural using singular source
            this.setGenericTag('artificial', { id: pluralId, value: tag.value });
        }
        this.setGenericTag(tagType, tag);
    }
    /**
     * Handle plural artist tags (artists, albumartists) and cross-populate to singular form
     */
    handlePluralArtistTag(tagType, tag, singularId, pluralId) {
        if (!this.common[singularId] || this.commonOrigin[singularId] === this.originPriority.artificial) {
            if (!this.common[pluralId] || this.common[pluralId].indexOf(tag.value) === -1) {
                // Fill singular using plural source
                const values = (this.common[pluralId] || []).concat([tag.value]);
                const value = joinArtists(values);
                this.setGenericTag('artificial', { id: singularId, value });
            }
        }
        this.setGenericTag(tagType, tag);
    }
    /**
     * Fix some common issues with picture object
     * @param picture Picture
     */
    async postFixPicture(picture) {
        if (picture.data && picture.data.length > 0) {
            if (!picture.format) {
                const fileType = await fileTypeFromBuffer(Uint8Array.from(picture.data)); // ToDO: remove Buffer
                if (fileType) {
                    picture.format = fileType.mime;
                }
                else {
                    return null;
                }
            }
            picture.format = picture.format.toLocaleLowerCase();
            switch (picture.format) {
                case 'image/jpg':
                    picture.format = 'image/jpeg'; // ToDo: register warning
            }
            return picture;
        }
        this.addWarning("Empty picture tag found");
        return null;
    }
    /**
     * Convert native tag to common tags
     */
    async toCommon(tagType, tagId, value) {
        const tag = { id: tagId, value };
        const genericTag = this.tagMapper.mapTag(tagType, tag, this);
        if (genericTag) {
            await this.postMap(tagType, genericTag);
        }
    }
    /**
     * Set generic tag
     */
    setGenericTag(tagType, tag) {
        debug$3(`common.${tag.id} = ${tag.value}`);
        const prio0 = this.commonOrigin[tag.id] || 1000;
        const prio1 = this.originPriority[tagType];
        if (isSingleton(tag.id)) {
            if (prio1 <= prio0) {
                this.common[tag.id] = tag.value;
                this.commonOrigin[tag.id] = prio1;
            }
            else {
                return debug$3(`Ignore native tag (singleton): ${tagType}.${tag.id} = ${tag.value}`);
            }
        }
        else {
            if (prio1 === prio0) {
                if (!isUnique(tag.id) || this.common[tag.id].indexOf(tag.value) === -1) {
                    this.common[tag.id].push(tag.value);
                }
                else {
                    debug$3(`Ignore duplicate value: ${tagType}.${tag.id} = ${tag.value}`);
                }
                // no effect? this.commonOrigin[tag.id] = prio1;
            }
            else if (prio1 < prio0) {
                this.common[tag.id] = [tag.value];
                this.commonOrigin[tag.id] = prio1;
            }
            else {
                return debug$3(`Ignore native tag (list): ${tagType}.${tag.id} = ${tag.value}`);
            }
        }
        if (this.opts?.observer) {
            this.opts.observer({ metadata: this, tag: { type: 'common', id: tag.id, value: tag.value } });
        }
        // ToDo: trigger metadata event
    }
}
function joinArtists(artists) {
    if (artists.length > 2) {
        return `${artists.slice(0, artists.length - 1).join(', ')} & ${artists[artists.length - 1]}`;
    }
    return artists.join(' & ');
}

const mpegParserLoader = {
    parserType: 'mpeg',
    extensions: ['.mp2', '.mp3', '.m2a', '.aac', 'aacp'],
    mimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/aacs', 'audio/aacp'],
    async load() {
        return (await import('./MpegParser-X5TIH3HV.js')).MpegParser;
    }
};

const apeParserLoader = {
    parserType: 'apev2',
    extensions: ['.ape'],
    mimeTypes: ['audio/ape', 'audio/monkeys-audio'],
    async load() {
        return (await Promise.resolve().then(function () { return APEv2Parser$1; })).APEv2Parser;
    }
};

const asfParserLoader = {
    parserType: 'asf',
    extensions: ['.asf', '.wma', '.wmv'],
    mimeTypes: ['audio/ms-wma', 'video/ms-wmv', 'audio/ms-asf', 'video/ms-asf', 'application/vnd.ms-asf'],
    async load() {
        return (await import('./AsfParser-AdBEcJtp.js')).AsfParser;
    }
};

const dsdiffParserLoader = {
    parserType: 'dsdiff',
    extensions: ['.dff'],
    mimeTypes: ['audio/dsf', 'audio/dsd'],
    async load() {
        return (await import('./DsdiffParser-TpWIImU6.js')).DsdiffParser;
    }
};

const aiffParserLoader = {
    parserType: 'aiff',
    extensions: ['.aif', 'aiff', 'aifc'],
    mimeTypes: ['audio/aiff', 'audio/aif', 'audio/aifc', 'application/aiff'],
    async load() {
        return (await import('./AiffParser-CNr8qC68.js')).AIFFParser;
    }
};

const dsfParserLoader = {
    parserType: 'dsf',
    extensions: ['.dsf'],
    mimeTypes: ['audio/dsf'],
    async load() {
        return (await import('./DsfParser-C1s4cmfn.js')).DsfParser;
    }
};

const flacParserLoader = {
    parserType: 'flac',
    extensions: ['.flac'],
    mimeTypes: ['audio/flac'],
    async load() {
        return (await import('./FlacParser-CjlvCpCy.js').then(function (n) { return n.d; })).FlacParser;
    }
};

const matroskaParserLoader = {
    parserType: 'matroska',
    extensions: ['.mka', '.mkv', '.mk3d', '.mks', 'webm'],
    mimeTypes: ['audio/matroska', 'video/matroska', 'audio/webm', 'video/webm'],
    async load() {
        return (await import('./MatroskaParser-D46FUPO9.js')).MatroskaParser;
    }
};

const mp4ParserLoader = {
    parserType: 'mp4',
    extensions: ['.mp4', '.m4a', '.m4b', '.m4pa', 'm4v', 'm4r', '3gp', '.mov', '.movie', '.qt'],
    mimeTypes: ['audio/mp4', 'audio/m4a', 'video/m4v', 'video/mp4', 'video/quicktime'],
    async load() {
        return (await import('./MP4Parser-BWx8kkXA.js')).MP4Parser;
    }
};

const musepackParserLoader = {
    parserType: 'musepack',
    extensions: ['.mpc'],
    mimeTypes: ['audio/musepack'],
    async load() {
        return (await import('./MusepackParser-PQATIU5h.js')).MusepackParser;
    }
};

const oggParserLoader = {
    parserType: 'ogg',
    extensions: ['.ogg', '.ogv', '.oga', '.ogm', '.ogx', '.opus', '.spx'],
    mimeTypes: ['audio/ogg', 'audio/opus', 'audio/speex', 'video/ogg'], // RFC 7845, RFC 6716, RFC 5574
    async load() {
        return (await import('./OggParser-CHUkHKgk.js')).OggParser;
    }
};

const wavpackParserLoader = {
    parserType: 'wavpack',
    extensions: ['.wv', '.wvp'],
    mimeTypes: ['audio/wavpack'],
    async load() {
        return (await import('./WavPackParser-Z0WvVWMD.js')).WavPackParser;
    }
};

const riffParserLoader = {
    parserType: 'riff',
    extensions: ['.wav', 'wave', '.bwf'],
    mimeTypes: ['audio/vnd.wave', 'audio/wav', 'audio/wave'],
    async load() {
        return (await import('./WaveParser-DSwMwSZc.js')).WaveParser;
    }
};

const debug$2 = initDebug('music-metadata:parser:factory');
function parseHttpContentType(contentType) {
    const type = distExports.parse(contentType);
    const mime = parse(type.type);
    return {
        type: mime.type,
        subtype: mime.subtype,
        suffix: mime.suffix,
        parameters: type.parameters
    };
}
class ParserFactory {
    constructor() {
        this.parsers = [];
        [
            flacParserLoader,
            mpegParserLoader,
            apeParserLoader,
            mp4ParserLoader,
            matroskaParserLoader,
            riffParserLoader,
            oggParserLoader,
            asfParserLoader,
            aiffParserLoader,
            wavpackParserLoader,
            musepackParserLoader,
            dsfParserLoader,
            dsdiffParserLoader
        ].forEach(parser => { this.registerParser(parser); });
    }
    registerParser(parser) {
        this.parsers.push(parser);
    }
    async parse(tokenizer, parserLoader, opts) {
        if (tokenizer.supportsRandomAccess()) {
            debug$2('tokenizer supports random-access, scanning for appending headers');
            await scanAppendingHeaders(tokenizer, opts);
        }
        else {
            debug$2('tokenizer does not support random-access, cannot scan for appending headers');
        }
        if (!parserLoader) {
            const buf = new Uint8Array(4100);
            if (tokenizer.fileInfo.mimeType) {
                parserLoader = this.findLoaderForContentType(tokenizer.fileInfo.mimeType);
            }
            if (!parserLoader && tokenizer.fileInfo.path) {
                parserLoader = this.findLoaderForExtension(tokenizer.fileInfo.path);
            }
            if (!parserLoader) {
                // Parser could not be determined on MIME-type or extension
                debug$2('Guess parser on content...');
                await tokenizer.peekBuffer(buf, { mayBeLess: true });
                const guessedType = await fileTypeFromBuffer(buf, { mpegOffsetTolerance: 10 });
                if (!guessedType || !guessedType.mime) {
                    throw new CouldNotDetermineFileTypeError('Failed to determine audio format');
                }
                debug$2(`Guessed file type is mime=${guessedType.mime}, extension=${guessedType.ext}`);
                parserLoader = this.findLoaderForContentType(guessedType.mime);
                if (!parserLoader) {
                    throw new UnsupportedFileTypeError(`Guessed MIME-type not supported: ${guessedType.mime}`);
                }
            }
        }
        // Parser found, execute parser
        debug$2(`Loading ${parserLoader.parserType} parser...`);
        const metadata = new MetadataCollector(opts);
        const ParserImpl = await parserLoader.load();
        const parser = new ParserImpl(metadata, tokenizer, opts ?? {});
        debug$2(`Parser ${parserLoader.parserType} loaded`);
        await parser.parse();
        if (metadata.format.trackInfo) {
            if (metadata.format.hasAudio === undefined) {
                metadata.setFormat('hasAudio', !!metadata.format.trackInfo.find(track => track.type === TrackType.audio));
            }
            if (metadata.format.hasVideo === undefined) {
                metadata.setFormat('hasVideo', !!metadata.format.trackInfo.find(track => track.type === TrackType.video));
            }
        }
        return metadata.toCommonMetadata();
    }
    /**
     * @param filePath - Path, filename or extension to audio file
     * @return Parser submodule name
     */
    findLoaderForExtension(filePath) {
        if (!filePath)
            return;
        const extension = getExtension(filePath).toLocaleLowerCase() || filePath;
        return this.parsers.find(parser => parser.extensions.indexOf(extension) !== -1);
    }
    findLoaderForContentType(httpContentType) {
        let mime;
        if (!httpContentType)
            return;
        try {
            mime = parseHttpContentType(httpContentType);
        }
        catch (_err) {
            debug$2(`Invalid HTTP Content-Type header value: ${httpContentType}`);
            return;
        }
        const subType = mime.subtype.indexOf('x-') === 0 ? mime.subtype.substring(2) : mime.subtype;
        return this.parsers.find(parser => parser.mimeTypes.find(loader => loader.indexOf(`${mime.type}/${subType}`) !== -1));
    }
    getSupportedMimeTypes() {
        const mimeTypeSet = new Set();
        this.parsers.forEach(loader => {
            loader.mimeTypes.forEach(mimeType => {
                mimeTypeSet.add(mimeType);
                mimeTypeSet.add(mimeType.replace('/', '/x-'));
            });
        });
        return Array.from(mimeTypeSet);
    }
}
function getExtension(fname) {
    const i = fname.lastIndexOf('.');
    return i === -1 ? '' : fname.substring(i);
}

class BasicParser {
    /**
     * Initialize parser with output (metadata), input (tokenizer) & parsing options (options).
     * @param {INativeMetadataCollector} metadata Output
     * @param {ITokenizer} tokenizer Input
     * @param {IOptions} options Parsing options
     */
    constructor(metadata, tokenizer, options) {
        this.metadata = metadata;
        this.tokenizer = tokenizer;
        this.options = options;
    }
}

const validFourCC = /^[\x21-\x7e©][\x20-\x7e\x00()]{3}/;
/**
 * Token for read FourCC
 * Ref: https://en.wikipedia.org/wiki/FourCC
 */
const FourCcToken = {
    len: 4,
    get: (buf, off) => {
        const id = textDecode(buf.subarray(off, off + FourCcToken.len), 'latin1');
        if (!id.match(validFourCC)) {
            throw new FieldDecodingError(`FourCC contains invalid characters: ${a2hex(id)} "${id}"`);
        }
        return id;
    },
    put: (buffer, offset, id) => {
        const str = textEncode(id, 'latin1');
        if (str.length !== 4)
            throw new InternalParserError('Invalid length');
        buffer.set(str, offset);
        return offset + 4;
    }
};

const DataType = {
    text_utf8: 0,
    binary: 1,
    external_info: 2,
    reserved: 3
};
/**
 * APE_DESCRIPTOR: defines the sizes (and offsets) of all the pieces, as well as the MD5 checksum
 */
const DescriptorParser = {
    len: 52,
    get: (buf, off) => {
        return {
            // should equal 'MAC '
            ID: FourCcToken.get(buf, off),
            // versionIndex number * 1000 (3.81 = 3810) (remember that 4-byte alignment causes this to take 4-bytes)
            version: UINT32_LE.get(buf, off + 4) / 1000,
            // the number of descriptor bytes (allows later expansion of this header)
            descriptorBytes: UINT32_LE.get(buf, off + 8),
            // the number of header APE_HEADER bytes
            headerBytes: UINT32_LE.get(buf, off + 12),
            // the number of header APE_HEADER bytes
            seekTableBytes: UINT32_LE.get(buf, off + 16),
            // the number of header data bytes (from original file)
            headerDataBytes: UINT32_LE.get(buf, off + 20),
            // the number of bytes of APE frame data
            apeFrameDataBytes: UINT32_LE.get(buf, off + 24),
            // the high order number of APE frame data bytes
            apeFrameDataBytesHigh: UINT32_LE.get(buf, off + 28),
            // the terminating data of the file (not including tag data)
            terminatingDataBytes: UINT32_LE.get(buf, off + 32),
            // the MD5 hash of the file (see notes for usage... it's a little tricky)
            fileMD5: new Uint8ArrayType(16).get(buf, off + 36)
        };
    }
};
/**
 * APE_HEADER: describes all of the necessary information about the APE file
 */
const Header = {
    len: 24,
    get: (buf, off) => {
        return {
            // the compression level (see defines I.E. COMPRESSION_LEVEL_FAST)
            compressionLevel: UINT16_LE.get(buf, off),
            // any format flags (for future use)
            formatFlags: UINT16_LE.get(buf, off + 2),
            // the number of audio blocks in one frame
            blocksPerFrame: UINT32_LE.get(buf, off + 4),
            // the number of audio blocks in the final frame
            finalFrameBlocks: UINT32_LE.get(buf, off + 8),
            // the total number of frames
            totalFrames: UINT32_LE.get(buf, off + 12),
            // the bits per sample (typically 16)
            bitsPerSample: UINT16_LE.get(buf, off + 16),
            // the number of channels (1 or 2)
            channel: UINT16_LE.get(buf, off + 18),
            // the sample rate (typically 44100)
            sampleRate: UINT32_LE.get(buf, off + 20)
        };
    }
};
/**
 * APE Tag Header/Footer Version 2.0
 * TAG: describes all the properties of the file [optional]
 */
const TagFooter = {
    len: 32,
    get: (buf, off) => {
        return {
            // should equal 'APETAGEX'
            ID: new StringType(8, 'ascii').get(buf, off),
            // equals CURRENT_APE_TAG_VERSION
            version: UINT32_LE.get(buf, off + 8),
            // the complete size of the tag, including this footer (excludes header)
            size: UINT32_LE.get(buf, off + 12),
            // the number of fields in the tag
            fields: UINT32_LE.get(buf, off + 16),
            // reserved for later use (must be zero),
            flags: parseTagFlags(UINT32_LE.get(buf, off + 20))
        };
    }
};
/**
 * APE Tag v2.0 Item Header
 */
const TagItemHeader = {
    len: 8,
    get: (buf, off) => {
        return {
            // Length of assigned value in bytes
            size: UINT32_LE.get(buf, off),
            // reserved for later use (must be zero),
            flags: parseTagFlags(UINT32_LE.get(buf, off + 4))
        };
    }
};
function parseTagFlags(flags) {
    return {
        containsHeader: isBitSet(flags, 31),
        containsFooter: isBitSet(flags, 30),
        isHeader: isBitSet(flags, 29),
        readOnly: isBitSet(flags, 0),
        dataType: (flags & 6) >> 1
    };
}
/**
 * @param num {number}
 * @param bit 0 is least significant bit (LSB)
 * @return {boolean} true if bit is 1; otherwise false
 */
function isBitSet(num, bit) {
    return (num & 1 << bit) !== 0;
}

const debug$1 = initDebug('music-metadata:parser:APEv2');
const tagFormat = 'APEv2';
const preamble = 'APETAGEX';
class ApeContentError extends makeUnexpectedFileContentError('APEv2') {
}
function tryParseApeHeader(metadata, tokenizer, options) {
    const apeParser = new APEv2Parser(metadata, tokenizer, options);
    return apeParser.tryParseApeHeader();
}
class APEv2Parser extends BasicParser {
    constructor() {
        super(...arguments);
        this.ape = {};
    }
    /**
     * Calculate the media file duration
     * @param ah ApeHeader
     * @return {number} duration in seconds
     */
    static calculateDuration(ah) {
        let duration = ah.totalFrames > 1 ? ah.blocksPerFrame * (ah.totalFrames - 1) : 0;
        duration += ah.finalFrameBlocks;
        return duration / ah.sampleRate;
    }
    /**
     * Calculates the APEv1 / APEv2 first field offset
     * @param tokenizer
     * @param offset
     */
    static async findApeFooterOffset(tokenizer, offset) {
        // Search for APE footer header at the end of the file
        const apeBuf = new Uint8Array(TagFooter.len);
        const position = tokenizer.position;
        if (offset <= TagFooter.len) {
            debug$1(`Offset is too small to read APE footer: offset=${offset}`);
            return undefined;
        }
        if (offset > TagFooter.len) {
            await tokenizer.readBuffer(apeBuf, { position: offset - TagFooter.len });
            tokenizer.setPosition(position);
            const tagFooter = TagFooter.get(apeBuf, 0);
            if (tagFooter.ID === 'APETAGEX') {
                if (tagFooter.flags.isHeader) {
                    debug$1(`APE Header found at offset=${offset - TagFooter.len}`);
                }
                else {
                    debug$1(`APE Footer found at offset=${offset - TagFooter.len}`);
                    offset -= tagFooter.size;
                }
                return { footer: tagFooter, offset };
            }
        }
    }
    static parseTagFooter(metadata, buffer, options) {
        const footer = TagFooter.get(buffer, buffer.length - TagFooter.len);
        if (footer.ID !== preamble)
            throw new ApeContentError('Unexpected APEv2 Footer ID preamble value');
        fromBuffer(buffer);
        const apeParser = new APEv2Parser(metadata, fromBuffer(buffer), options);
        return apeParser.parseTags(footer);
    }
    /**
     * Parse APEv1 / APEv2 header if header signature found
     */
    async tryParseApeHeader() {
        if (this.tokenizer.fileInfo.size && this.tokenizer.fileInfo.size - this.tokenizer.position < TagFooter.len) {
            debug$1("No APEv2 header found, end-of-file reached");
            return;
        }
        const footer = await this.tokenizer.peekToken(TagFooter);
        if (footer.ID === preamble) {
            await this.tokenizer.ignore(TagFooter.len);
            return this.parseTags(footer);
        }
        debug$1(`APEv2 header not found at offset=${this.tokenizer.position}`);
        if (this.tokenizer.fileInfo.size) {
            // Try to read the APEv2 header using just the footer-header
            const remaining = this.tokenizer.fileInfo.size - this.tokenizer.position; // ToDo: take ID3v1 into account
            const buffer = new Uint8Array(remaining);
            await this.tokenizer.readBuffer(buffer);
            return APEv2Parser.parseTagFooter(this.metadata, buffer, this.options);
        }
    }
    async parse() {
        const descriptor = await this.tokenizer.readToken(DescriptorParser);
        if (descriptor.ID !== 'MAC ')
            throw new ApeContentError('Unexpected descriptor ID');
        this.ape.descriptor = descriptor;
        const lenExp = descriptor.descriptorBytes - DescriptorParser.len;
        const header = await (lenExp > 0 ? this.parseDescriptorExpansion(lenExp) : this.parseHeader());
        this.metadata.setAudioOnly();
        await this.tokenizer.ignore(header.forwardBytes);
        return this.tryParseApeHeader();
    }
    async parseTags(footer) {
        const keyBuffer = new Uint8Array(256); // maximum tag key length
        let bytesRemaining = footer.size - TagFooter.len;
        debug$1(`Parse APE tags at offset=${this.tokenizer.position}, size=${bytesRemaining}`);
        for (let i = 0; i < footer.fields; i++) {
            if (bytesRemaining < TagItemHeader.len) {
                this.metadata.addWarning(`APEv2 Tag-header: ${footer.fields - i} items remaining, but no more tag data to read.`);
                break;
            }
            // Only APEv2 tag has tag item headers
            const tagItemHeader = await this.tokenizer.readToken(TagItemHeader);
            bytesRemaining -= TagItemHeader.len + tagItemHeader.size;
            await this.tokenizer.peekBuffer(keyBuffer, { length: Math.min(keyBuffer.length, bytesRemaining) });
            let zero = findZero(keyBuffer);
            const key = await this.tokenizer.readToken(new StringType(zero, 'ascii'));
            await this.tokenizer.ignore(1);
            bytesRemaining -= key.length + 1;
            switch (tagItemHeader.flags.dataType) {
                case DataType.text_utf8: { // utf-8 text-string
                    const value = await this.tokenizer.readToken(new StringType(tagItemHeader.size, 'utf8'));
                    const values = value.split(/\x00/g);
                    await Promise.all(values.map(val => this.metadata.addTag(tagFormat, key, val)));
                    break;
                }
                case DataType.binary: // binary (probably artwork)
                    if (this.options.skipCovers) {
                        await this.tokenizer.ignore(tagItemHeader.size);
                    }
                    else {
                        const picData = new Uint8Array(tagItemHeader.size);
                        await this.tokenizer.readBuffer(picData);
                        zero = findZero(picData);
                        const description = textDecode(picData.subarray(0, zero), 'utf-8');
                        const data = picData.subarray(zero + 1);
                        await this.metadata.addTag(tagFormat, key, {
                            description,
                            data
                        });
                    }
                    break;
                case DataType.external_info:
                    debug$1(`Ignore external info ${key}`);
                    await this.tokenizer.ignore(tagItemHeader.size);
                    break;
                case DataType.reserved:
                    debug$1(`Ignore external info ${key}`);
                    this.metadata.addWarning(`APEv2 header declares a reserved datatype for "${key}"`);
                    await this.tokenizer.ignore(tagItemHeader.size);
                    break;
            }
        }
    }
    async parseDescriptorExpansion(lenExp) {
        await this.tokenizer.ignore(lenExp);
        return this.parseHeader();
    }
    async parseHeader() {
        const header = await this.tokenizer.readToken(Header);
        // ToDo before
        this.metadata.setFormat('lossless', true);
        this.metadata.setFormat('container', 'Monkey\'s Audio');
        this.metadata.setFormat('bitsPerSample', header.bitsPerSample);
        this.metadata.setFormat('sampleRate', header.sampleRate);
        this.metadata.setFormat('numberOfChannels', header.channel);
        this.metadata.setFormat('duration', APEv2Parser.calculateDuration(header));
        if (!this.ape.descriptor) {
            throw new ApeContentError('Missing APE descriptor');
        }
        return {
            forwardBytes: this.ape.descriptor.seekTableBytes + this.ape.descriptor.headerDataBytes +
                this.ape.descriptor.apeFrameDataBytes + this.ape.descriptor.terminatingDataBytes
        };
    }
}

var APEv2Parser$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    APEv2Parser: APEv2Parser,
    ApeContentError: ApeContentError,
    tryParseApeHeader: tryParseApeHeader
});

const debug = initDebug('music-metadata:parser:ID3v1');
/**
 * ID3v1 Genre mappings
 * Ref: https://de.wikipedia.org/wiki/Liste_der_ID3v1-Genres
 */
const Genres = [
    'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
    'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock',
    'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack',
    'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance',
    'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
    'Alt. Rock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop',
    'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial',
    'Electronic', 'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock', 'Comedy', 'Cult',
    'Gangsta Rap', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native American',
    'Cabaret', 'New Wave', 'Psychedelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal',
    'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock',
    'Folk', 'Folk/Rock', 'National Folk', 'Swing', 'Fast-Fusion', 'Bebob', 'Latin', 'Revival',
    'Celtic', 'Bluegrass', 'Avantgarde', 'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock',
    'Symphonic Rock', 'Slow Rock', 'Big Band', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour',
    'Speech', 'Chanson', 'Opera', 'Chamber Music', 'Sonata', 'Symphony', 'Booty Bass', 'Primus',
    'Porn Groove', 'Satire', 'Slow Jam', 'Club', 'Tango', 'Samba', 'Folklore',
    'Ballad', 'Power Ballad', 'Rhythmic Soul', 'Freestyle', 'Duet', 'Punk Rock', 'Drum Solo',
    'A Cappella', 'Euro-House', 'Dance Hall', 'Goa', 'Drum & Bass', 'Club-House',
    'Hardcore', 'Terror', 'Indie', 'BritPop', 'Negerpunk', 'Polsk Punk', 'Beat',
    'Christian Gangsta Rap', 'Heavy Metal', 'Black Metal', 'Crossover', 'Contemporary Christian',
    'Christian Rock', 'Merengue', 'Salsa', 'Thrash Metal', 'Anime', 'JPop', 'Synthpop',
    'Abstract', 'Art Rock', 'Baroque', 'Bhangra', 'Big Beat', 'Breakbeat', 'Chillout',
    'Downtempo', 'Dub', 'EBM', 'Eclectic', 'Electro', 'Electroclash', 'Emo', 'Experimental',
    'Garage', 'Global', 'IDM', 'Illbient', 'Industro-Goth', 'Jam Band', 'Krautrock',
    'Leftfield', 'Lounge', 'Math Rock', 'New Romantic', 'Nu-Breakz', 'Post-Punk', 'Post-Rock',
    'Psytrance', 'Shoegaze', 'Space Rock', 'Trop Rock', 'World Music', 'Neoclassical', 'Audiobook',
    'Audio Theatre', 'Neue Deutsche Welle', 'Podcast', 'Indie Rock', 'G-Funk', 'Dubstep',
    'Garage Rock', 'Psybient'
];
/**
 * Spec: http://id3.org/ID3v1
 * Wiki: https://en.wikipedia.org/wiki/ID3
 */
const Iid3v1Token = {
    len: 128,
    /**
     * @param buf Buffer possibly holding the 128 bytes ID3v1.1 metadata header
     * @param off Offset in buffer in bytes
     * @returns ID3v1.1 header if first 3 bytes equals 'TAG', otherwise null is returned
     */
    get: (buf, off) => {
        const header = new Id3v1StringType(3).get(buf, off);
        return header === 'TAG' ? {
            header,
            title: new Id3v1StringType(30).get(buf, off + 3),
            artist: new Id3v1StringType(30).get(buf, off + 33),
            album: new Id3v1StringType(30).get(buf, off + 63),
            year: new Id3v1StringType(4).get(buf, off + 93),
            comment: new Id3v1StringType(28).get(buf, off + 97),
            // ID3v1.1 separator for track
            zeroByte: UINT8.get(buf, off + 127),
            // track: ID3v1.1 field added by Michael Mutschler
            track: UINT8.get(buf, off + 126),
            genre: UINT8.get(buf, off + 127)
        } : null;
    }
};
class Id3v1StringType {
    constructor(len) {
        this.len = len;
        this.stringType = new StringType(len, 'latin1');
    }
    get(buf, off) {
        let value = this.stringType.get(buf, off);
        value = trimRightNull(value);
        value = value.trim();
        return value.length > 0 ? value : undefined;
    }
}
class ID3v1Parser extends BasicParser {
    constructor(metadata, tokenizer, options) {
        super(metadata, tokenizer, options);
        this.apeHeader = options.apeHeader;
    }
    static getGenre(genreIndex) {
        if (genreIndex < Genres.length) {
            return Genres[genreIndex];
        }
        return undefined; // ToDO: generate warning
    }
    async parse() {
        if (!this.tokenizer.fileInfo.size) {
            debug('Skip checking for ID3v1 because the file-size is unknown');
            return;
        }
        if (this.apeHeader && this.tokenizer.supportsRandomAccess()) {
            this.tokenizer.setPosition(this.apeHeader.offset);
            const apeParser = new APEv2Parser(this.metadata, this.tokenizer, this.options);
            await apeParser.parseTags(this.apeHeader.footer);
        }
        const offset = this.tokenizer.fileInfo.size - Iid3v1Token.len;
        if (this.tokenizer.position > offset) {
            debug('Already consumed the last 128 bytes');
            return;
        }
        const header = await this.tokenizer.readToken(Iid3v1Token, offset);
        if (header) {
            debug('ID3v1 header found at: pos=%s', this.tokenizer.fileInfo.size - Iid3v1Token.len);
            const props = ['title', 'artist', 'album', 'comment', 'track', 'year'];
            for (const id of props) {
                if (header[id] && header[id] !== '')
                    await this.addTag(id, header[id]);
            }
            const genre = ID3v1Parser.getGenre(header.genre);
            if (genre)
                await this.addTag('genre', genre);
        }
        else {
            debug('ID3v1 header not found at: pos=%s', this.tokenizer.fileInfo.size - Iid3v1Token.len);
        }
    }
    async addTag(id, value) {
        await this.metadata.addTag('ID3v1', id, value);
    }
}
async function hasID3v1Header(tokenizer) {
    if (tokenizer.fileInfo.size >= 128) {
        const tag = new Uint8Array(3);
        const position = tokenizer.position;
        await tokenizer.readBuffer(tag, { position: tokenizer.fileInfo.size - 128 });
        tokenizer.setPosition(position); // Restore tokenizer position
        return textDecode(tag, 'latin1') === 'TAG';
    }
    return false;
}

const endTag2 = 'LYRICS200';
async function getLyricsHeaderLength(tokenizer) {
    const fileSize = tokenizer.fileInfo.size;
    if (fileSize >= 143) {
        const buf = new Uint8Array(15);
        const position = tokenizer.position;
        await tokenizer.readBuffer(buf, { position: fileSize - 143 });
        tokenizer.setPosition(position); // Restore position
        const txt = textDecode(buf, 'latin1');
        const tag = txt.substring(6);
        if (tag === endTag2) {
            return Number.parseInt(txt.substring(0, 6), 10) + 15;
        }
    }
    return 0;
}

/**
 * Primary entry point, Node.js specific entry point is MusepackParser.ts
 */
/**
 * Parse Web API File
 * Requires Blob to be able to stream using a ReadableStreamBYOBReader, only available since Node.js ≥ 20
 * @param blob - Blob to parse
 * @param options - Parsing options
 * @returns Metadata
 */
async function parseBlob(blob, options = {}) {
    const tokenizer = fromBlob(blob);
    try {
        return await parseFromTokenizer(tokenizer, options);
    }
    finally {
        await tokenizer.close();
    }
}
/**
 * Parse audio from ITokenizer source
 * @param tokenizer - Audio source implementing the tokenizer interface
 * @param options - Parsing options
 * @returns Metadata
 */
function parseFromTokenizer(tokenizer, options) {
    const parserFactory = new ParserFactory();
    return parserFactory.parse(tokenizer, undefined, options);
}
async function scanAppendingHeaders(tokenizer, options = {}) {
    let apeOffset = tokenizer.fileInfo.size;
    if (await hasID3v1Header(tokenizer)) {
        apeOffset -= 128;
        const lyricsLen = await getLyricsHeaderLength(tokenizer);
        apeOffset -= lyricsLen;
    }
    options.apeHeader = await APEv2Parser.findApeFooterOffset(tokenizer, apeOffset);
}

export { AttachedPictureType as A, BasicParser as B, Token as C, uint8ArrayToHex as D, EndOfStreamError as E, FourCcToken as F, textDecode as G, Genres as H, INT16_BE as I, tryParseApeHeader as J, trimRightNull as K, ID3v2Header as L, ID3v1Parser as M, UINT24_LE as N, UINT32SYNCSAFE as O, TextEncodingToken as P, findZero as Q, decodeUintBE as R, StringType as S, TrackType as T, UINT32_BE as U, TextHeader as V, SyncTextHeader as W, ExtendedHeader as X, parseBlob as Y, UINT16_BE as a, UINT8 as b, Uint8ArrayType as c, initDebug as d, decodeString as e, UINT32_LE as f, getBitAllignedNumber as g, UINT64_LE as h, isBitSet$1 as i, UINT16_LE as j, getBit as k, INT64_BE as l, makeUnexpectedFileContentError as m, fromBuffer as n, INT64_LE as o, INT32_LE as p, Float64_BE as q, Float32_BE as r, stripNulls as s, UINT64_BE as t, TargetType as u, INT32_BE as v, INT24_BE as w, INT8 as x, UINT24_BE as y, FieldDecodingError as z };
