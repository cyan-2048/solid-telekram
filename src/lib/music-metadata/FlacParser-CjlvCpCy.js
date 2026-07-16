import { A as AttachedPictureType, U as UINT32_BE, S as StringType, b as UINT8, f as UINT32_LE, G as textDecode, m as makeUnexpectedFileContentError, d as initDebug, y as UINT24_BE, g as getBitAllignedNumber, k as getBit, c as Uint8ArrayType, a as UINT16_BE, F as FourCcToken } from './index-DKps7p52.js';
import { A as AbstractID3Parser } from './AbstractID3Parser-kEkce6EC.js';

/**
 * Parse the METADATA_BLOCK_PICTURE
 * Ref: https://wiki.xiph.org/VorbisComment#METADATA_BLOCK_PICTURE
 * Ref: https://xiph.org/flac/format.html#metadata_block_picture
 * // ToDo: move to ID3 / APIC?
 */
class VorbisPictureToken {
    static fromBase64(base64str) {
        return VorbisPictureToken.fromBuffer(Uint8Array.from(atob(base64str), c => c.charCodeAt(0)));
    }
    static fromBuffer(buffer) {
        const pic = new VorbisPictureToken(buffer.length);
        return pic.get(buffer, 0);
    }
    constructor(len) {
        this.len = len;
    }
    get(buffer, offset) {
        const type = AttachedPictureType[UINT32_BE.get(buffer, offset)];
        offset += 4;
        const mimeLen = UINT32_BE.get(buffer, offset);
        offset += 4;
        const format = new StringType(mimeLen, 'utf-8').get(buffer, offset);
        offset += mimeLen;
        const descLen = UINT32_BE.get(buffer, offset);
        offset += 4;
        const description = new StringType(descLen, 'utf-8').get(buffer, offset);
        offset += descLen;
        const width = UINT32_BE.get(buffer, offset);
        offset += 4;
        const height = UINT32_BE.get(buffer, offset);
        offset += 4;
        const colour_depth = UINT32_BE.get(buffer, offset);
        offset += 4;
        const indexed_color = UINT32_BE.get(buffer, offset);
        offset += 4;
        const picDataLen = UINT32_BE.get(buffer, offset);
        offset += 4;
        const data = buffer.slice(offset, offset + picDataLen);
        return {
            type,
            format,
            description,
            width,
            height,
            colour_depth,
            indexed_color,
            data
        };
    }
}
/**
 * Comment header decoder
 * Ref: https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-620004.2.1
 */
const CommonHeader = {
    len: 7,
    get: (buf, off) => {
        return {
            packetType: UINT8.get(buf, off),
            vorbis: new StringType(6, 'ascii').get(buf, off + 1)
        };
    }
};
/**
 * Identification header decoder
 * Ref: https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-630004.2.2
 */
const IdentificationHeader = {
    len: 23,
    get: (uint8Array, off) => {
        return {
            version: UINT32_LE.get(uint8Array, off + 0),
            channelMode: UINT8.get(uint8Array, off + 4),
            sampleRate: UINT32_LE.get(uint8Array, off + 5),
            bitrateMax: UINT32_LE.get(uint8Array, off + 9),
            bitrateNominal: UINT32_LE.get(uint8Array, off + 13),
            bitrateMin: UINT32_LE.get(uint8Array, off + 17)
        };
    }
};

class VorbisDecoder {
    constructor(data, offset) {
        this.data = data;
        this.offset = offset;
    }
    readInt32() {
        const value = UINT32_LE.get(this.data, this.offset);
        this.offset += 4;
        return value;
    }
    readStringUtf8() {
        const len = this.readInt32();
        const value = textDecode(this.data.subarray(this.offset, this.offset + len), 'utf-8');
        this.offset += len;
        return value;
    }
    parseUserComment() {
        const offset0 = this.offset;
        const v = this.readStringUtf8();
        const idx = v.indexOf('=');
        return {
            key: v.substring(0, idx).toUpperCase(),
            value: v.substring(idx + 1),
            len: this.offset - offset0
        };
    }
}

const debug$1 = initDebug('music-metadata:parser:ogg:vorbis1');
class VorbisContentError extends makeUnexpectedFileContentError('Vorbis') {
}
/**
 * Vorbis 1 Parser.
 * Used by OggStream
 */
class VorbisStream {
    constructor(metadata, options) {
        this.pageSegments = [];
        this.durationOnLastPage = true;
        this.metadata = metadata;
        this.options = options;
    }
    /**
     * Vorbis 1 parser
     * @param header Ogg Page Header
     * @param pageData Page data
     */
    async parsePage(header, pageData) {
        this.lastPageHeader = header;
        if (header.headerType.firstPage) {
            this.parseFirstPage(header, pageData);
        }
        else {
            if (header.headerType.continued) {
                if (this.pageSegments.length === 0) {
                    throw new VorbisContentError('Cannot continue on previous page');
                }
                this.pageSegments.push(pageData);
            }
            if (header.headerType.lastPage || !header.headerType.continued) {
                // Flush page segments
                if (this.pageSegments.length > 0) {
                    const fullPage = VorbisStream.mergeUint8Arrays(this.pageSegments);
                    await this.parseFullPage(fullPage);
                }
                // Reset page segments
                this.pageSegments = header.headerType.lastPage ? [] : [pageData];
            }
        }
    }
    static mergeUint8Arrays(arrays) {
        const totalSize = arrays.reduce((acc, e) => acc + e.length, 0);
        const merged = new Uint8Array(totalSize);
        arrays.forEach((array, i, _arrays) => {
            const offset = _arrays.slice(0, i).reduce((acc, e) => acc + e.length, 0);
            merged.set(array, offset);
        });
        return merged;
    }
    async flush() {
        await this.parseFullPage(VorbisStream.mergeUint8Arrays(this.pageSegments));
    }
    async parseUserComment(pageData, offset) {
        const decoder = new VorbisDecoder(pageData, offset);
        const tag = decoder.parseUserComment();
        await this.addTag(tag.key, tag.value);
        return tag.len;
    }
    async addTag(id, value) {
        if (id === 'METADATA_BLOCK_PICTURE' && (typeof value === 'string')) {
            if (this.options.skipCovers) {
                debug$1("Ignore picture");
                return;
            }
            value = VorbisPictureToken.fromBase64(value);
            debug$1(`Push picture: id=${id}, format=${value.format}`);
        }
        else {
            debug$1(`Push tag: id=${id}, value=${value}`);
        }
        await this.metadata.addTag('vorbis', id, value);
    }
    calculateDuration(enfOfStream) {
        if (this.lastPageHeader && (enfOfStream || this.lastPageHeader.headerType.lastPage) && this.metadata.format.sampleRate && this.lastPageHeader.absoluteGranulePosition >= 0) {
            // Calculate duration
            this.metadata.setFormat('numberOfSamples', this.lastPageHeader.absoluteGranulePosition);
            this.metadata.setFormat('duration', this.lastPageHeader.absoluteGranulePosition / this.metadata.format.sampleRate);
        }
    }
    /**
     * Parse first Ogg/Vorbis page
     * @param _header
     * @param pageData
     */
    parseFirstPage(_header, pageData) {
        this.metadata.setFormat('codec', 'Vorbis I');
        this.metadata.setFormat('hasAudio', true);
        debug$1('Parse first page');
        // Parse  Vorbis common header
        const commonHeader = CommonHeader.get(pageData, 0);
        if (commonHeader.vorbis !== 'vorbis')
            throw new VorbisContentError('Metadata does not look like Vorbis');
        if (commonHeader.packetType === 1) {
            const idHeader = IdentificationHeader.get(pageData, CommonHeader.len);
            this.metadata.setFormat('sampleRate', idHeader.sampleRate);
            this.metadata.setFormat('bitrate', idHeader.bitrateNominal);
            this.metadata.setFormat('numberOfChannels', idHeader.channelMode);
            debug$1('sample-rate=%s[hz], bitrate=%s[b/s], channel-mode=%s', idHeader.sampleRate, idHeader.bitrateNominal, idHeader.channelMode);
        }
        else
            throw new VorbisContentError('First Ogg page should be type 1: the identification header');
    }
    async parseFullPage(pageData) {
        // New page
        const commonHeader = CommonHeader.get(pageData, 0);
        debug$1('Parse full page: type=%s, byteLength=%s', commonHeader.packetType, pageData.byteLength);
        switch (commonHeader.packetType) {
            case 3: //  type 3: comment header
                return this.parseUserCommentList(pageData, CommonHeader.len);
        }
    }
    /**
     * Ref: https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-840005.2
     */
    async parseUserCommentList(pageData, offset) {
        const strLen = UINT32_LE.get(pageData, offset);
        offset += 4;
        // const vendorString = new Token.StringType(strLen, 'utf-8').get(pageData, offset);
        offset += strLen;
        let userCommentListLength = UINT32_LE.get(pageData, offset);
        offset += 4;
        while (userCommentListLength-- > 0) {
            offset += (await this.parseUserComment(pageData, offset));
        }
    }
}

/**
 * FLAC supports up to 128 kinds of metadata blocks; currently the following are defined:
 * ref: https://xiph.org/flac/format.html#metadata_block
 */
const BlockType = {
    STREAMINFO: 0, // STREAMINFO
    PADDING: 1, // PADDING
    APPLICATION: 2, // APPLICATION
    SEEKTABLE: 3, // SEEKTABLE
    VORBIS_COMMENT: 4, // VORBIS_COMMENT
    CUESHEET: 5, // CUESHEET
    PICTURE: 6 // PICTURE
};
const BlockHeader = {
    len: 4,
    get: (buf, off) => {
        return {
            lastBlock: getBit(buf, off, 7),
            type: getBitAllignedNumber(buf, off, 1, 7),
            length: UINT24_BE.get(buf, off + 1)
        };
    }
};
/**
 * METADATA_BLOCK_DATA
 * Ref: https://xiph.org/flac/format.html#metadata_block_streaminfo
 */
const BlockStreamInfo = {
    len: 34,
    get: (buf, off) => {
        return {
            // The minimum block size (in samples) used in the stream.
            minimumBlockSize: UINT16_BE.get(buf, off),
            // The maximum block size (in samples) used in the stream.
            // (Minimum blocksize == maximum blocksize) implies a fixed-blocksize stream.
            maximumBlockSize: UINT16_BE.get(buf, off + 2) / 1000,
            // The minimum frame size (in bytes) used in the stream.
            // May be 0 to imply the value is not known.
            minimumFrameSize: UINT24_BE.get(buf, off + 4),
            // The maximum frame size (in bytes) used in the stream.
            // May be 0 to imply the value is not known.
            maximumFrameSize: UINT24_BE.get(buf, off + 7),
            // Sample rate in Hz. Though 20 bits are available,
            // the maximum sample rate is limited by the structure of frame headers to 655350Hz.
            // Also, a value of 0 is invalid.
            sampleRate: UINT24_BE.get(buf, off + 10) >> 4,
            // probably slower: sampleRate: common.getBitAllignedNumber(buf, off + 10, 0, 20),
            // (number of channels)-1. FLAC supports from 1 to 8 channels
            channels: getBitAllignedNumber(buf, off + 12, 4, 3) + 1,
            // bits per sample)-1.
            // FLAC supports from 4 to 32 bits per sample. Currently the reference encoder and decoders only support up to 24 bits per sample.
            bitsPerSample: getBitAllignedNumber(buf, off + 12, 7, 5) + 1,
            // Total samples in stream.
            // 'Samples' means inter-channel sample, i.e. one second of 44.1Khz audio will have 44100 samples regardless of the number of channels.
            // A value of zero here means the number of total samples is unknown.
            totalSamples: getBitAllignedNumber(buf, off + 13, 4, 36),
            // the MD5 hash of the file (see notes for usage... it's a littly tricky)
            fileMD5: new Uint8ArrayType(16).get(buf, off + 18)
        };
    }
};

const debug = initDebug('music-metadata:parser:FLAC');
class FlacContentError extends makeUnexpectedFileContentError('FLAC') {
}
class FlacParser extends AbstractID3Parser {
    constructor() {
        super(...arguments);
        this.vorbisParser = new VorbisStream(this.metadata, this.options);
    }
    async postId3v2Parse() {
        const fourCC = await this.tokenizer.readToken(FourCcToken);
        if (fourCC.toString() !== 'fLaC') {
            throw new FlacContentError('Invalid FLAC preamble');
        }
        let blockHeader;
        do {
            // Read block header
            blockHeader = await this.tokenizer.readToken(BlockHeader);
            // Parse block data
            await this.parseDataBlock(blockHeader);
        } while (!blockHeader.lastBlock);
        if (this.tokenizer.fileInfo.size && this.metadata.format.duration) {
            const dataSize = this.tokenizer.fileInfo.size - this.tokenizer.position;
            this.metadata.setFormat('bitrate', 8 * dataSize / this.metadata.format.duration);
        }
    }
    async parseDataBlock(blockHeader) {
        debug(`blockHeader type=${blockHeader.type}, length=${blockHeader.length}`);
        switch (blockHeader.type) {
            case BlockType.STREAMINFO:
                return this.readBlockStreamInfo(blockHeader.length);
            case BlockType.PADDING:
                break;
            case BlockType.APPLICATION:
                break;
            case BlockType.SEEKTABLE:
                break;
            case BlockType.VORBIS_COMMENT:
                return this.readComment(blockHeader.length);
            case BlockType.CUESHEET:
                break;
            case BlockType.PICTURE:
                await this.parsePicture(blockHeader.length);
                return;
            default:
                this.metadata.addWarning(`Unknown block type: ${blockHeader.type}`);
        }
        // Ignore data block
        return this.tokenizer.ignore(blockHeader.length).then();
    }
    /**
     * Parse STREAMINFO
     */
    async readBlockStreamInfo(dataLen) {
        if (dataLen !== BlockStreamInfo.len)
            throw new FlacContentError('Unexpected block-stream-info length');
        const streamInfo = await this.tokenizer.readToken(BlockStreamInfo);
        this.metadata.setFormat('container', 'FLAC');
        this.processsStreamInfo(streamInfo);
    }
    /**
     * Parse STREAMINFO
     */
    processsStreamInfo(streamInfo) {
        this.metadata.setFormat('codec', 'FLAC');
        this.metadata.setFormat('hasAudio', true);
        this.metadata.setFormat('lossless', true);
        this.metadata.setFormat('numberOfChannels', streamInfo.channels);
        this.metadata.setFormat('bitsPerSample', streamInfo.bitsPerSample);
        this.metadata.setFormat('sampleRate', streamInfo.sampleRate);
        if (streamInfo.totalSamples > 0) {
            this.metadata.setFormat('duration', streamInfo.totalSamples / streamInfo.sampleRate);
        }
    }
    /**
     * Read VORBIS_COMMENT from tokenizer
     * Ref: https://www.xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-640004.2.3
     */
    async readComment(dataLen) {
        const data = await this.tokenizer.readToken(new Uint8ArrayType(dataLen));
        return this.parseComment(data);
    }
    /**
     * Parse VORBIS_COMMENT
     * Ref: https://www.xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-640004.2.3
     */
    async parseComment(data) {
        const decoder = new VorbisDecoder(data, 0);
        const vendor = decoder.readStringUtf8();
        if (vendor.length > 0) {
            this.metadata.setFormat('tool', vendor);
        }
        const commentListLength = decoder.readInt32();
        const tags = new Array(commentListLength);
        for (let i = 0; i < commentListLength; i++) {
            tags[i] = decoder.parseUserComment();
        }
        await Promise.all(tags.map(tag => {
            if (tag.key === 'ENCODER') {
                this.metadata.setFormat('tool', tag.value);
            }
            return this.addTag(tag.key, tag.value);
        }));
    }
    async parsePicture(dataLen) {
        if (this.options.skipCovers) {
            return this.tokenizer.ignore(dataLen);
        }
        return this.addPictureTag(await this.tokenizer.readToken(new VorbisPictureToken(dataLen)));
    }
    addPictureTag(picture) {
        return this.addTag('METADATA_BLOCK_PICTURE', picture);
    }
    addTag(id, value) {
        return this.vorbisParser.addTag(id, value);
    }
}

var FlacParser$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    FlacParser: FlacParser
});

export { BlockHeader as B, FlacParser as F, VorbisStream as V, BlockType as a, VorbisPictureToken as b, BlockStreamInfo as c, FlacParser$1 as d };
