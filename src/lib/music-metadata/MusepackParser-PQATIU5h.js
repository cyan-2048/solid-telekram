import { S as StringType, b as UINT8, d as initDebug, f as UINT32_LE, g as getBitAllignedNumber, i as isBitSet, m as makeUnexpectedFileContentError, B as BasicParser, F as FourCcToken, J as tryParseApeHeader, j as UINT16_LE, G as textDecode } from './index-DKps7p52.js';
import { A as AbstractID3Parser } from './AbstractID3Parser-kEkce6EC.js';
import './ID3v2Parser-TMQxf0MS.js';

const debug$3 = initDebug('music-metadata:parser:musepack:sv8');
const PacketKey = new StringType(2, 'latin1');
/**
 * Stream Header Packet part 1
 * Ref: http://trac.musepack.net/musepack/wiki/SV8Specification#StreamHeaderPacket
 */
const SH_part1 = {
    len: 5,
    get: (buf, off) => {
        return {
            crc: UINT32_LE.get(buf, off),
            streamVersion: UINT8.get(buf, off + 4)
        };
    }
};
/**
 * Stream Header Packet part 3
 * Ref: http://trac.musepack.net/musepack/wiki/SV8Specification#StreamHeaderPacket
 */
const SH_part3 = {
    len: 2,
    get: (buf, off) => {
        return {
            sampleFrequency: [44100, 48000, 37800, 32000][getBitAllignedNumber(buf, off, 0, 3)],
            maxUsedBands: getBitAllignedNumber(buf, off, 3, 5),
            channelCount: getBitAllignedNumber(buf, off + 1, 0, 4) + 1,
            msUsed: isBitSet(buf, off + 1, 4),
            audioBlockFrames: getBitAllignedNumber(buf, off + 1, 5, 3)
        };
    }
};
class StreamReader {
    get tokenizer() {
        return this._tokenizer;
    }
    set tokenizer(value) {
        this._tokenizer = value;
    }
    constructor(_tokenizer) {
        this._tokenizer = _tokenizer;
    }
    async readPacketHeader() {
        const key = await this.tokenizer.readToken(PacketKey);
        const size = await this.readVariableSizeField();
        return {
            key,
            payloadLength: size.value - 2 - size.len
        };
    }
    async readStreamHeader(size) {
        const streamHeader = {};
        debug$3(`Reading SH at offset=${this.tokenizer.position}`);
        const part1 = await this.tokenizer.readToken(SH_part1);
        size -= SH_part1.len;
        Object.assign(streamHeader, part1);
        debug$3(`SH.streamVersion = ${part1.streamVersion}`);
        const sampleCount = await this.readVariableSizeField();
        size -= sampleCount.len;
        streamHeader.sampleCount = sampleCount.value;
        const bs = await this.readVariableSizeField();
        size -= bs.len;
        streamHeader.beginningOfSilence = bs.value;
        const part3 = await this.tokenizer.readToken(SH_part3);
        size -= SH_part3.len;
        Object.assign(streamHeader, part3);
        // assert.equal(size, 0);
        await this.tokenizer.ignore(size);
        return streamHeader;
    }
    async readVariableSizeField(len = 1, hb = 0) {
        let n = await this.tokenizer.readNumber(UINT8);
        if ((n & 0x80) === 0) {
            return { len, value: hb + n };
        }
        n &= 0x7F;
        n += hb;
        return this.readVariableSizeField(len + 1, n << 7);
    }
}

class MusepackContentError extends makeUnexpectedFileContentError('Musepack') {
}

const debug$2 = initDebug('music-metadata:parser:musepack');
class MpcSv8Parser extends BasicParser {
    constructor() {
        super(...arguments);
        this.audioLength = 0;
    }
    async parse() {
        const signature = await this.tokenizer.readToken(FourCcToken);
        if (signature !== 'MPCK')
            throw new MusepackContentError('Invalid Magic number');
        this.metadata.setFormat('container', 'Musepack, SV8');
        return this.parsePacket();
    }
    async parsePacket() {
        const sv8reader = new StreamReader(this.tokenizer);
        do {
            const header = await sv8reader.readPacketHeader();
            debug$2(`packet-header key=${header.key}, payloadLength=${header.payloadLength}`);
            switch (header.key) {
                case 'SH': { // Stream Header
                    const sh = await sv8reader.readStreamHeader(header.payloadLength);
                    this.metadata.setFormat('numberOfSamples', sh.sampleCount);
                    this.metadata.setFormat('sampleRate', sh.sampleFrequency);
                    this.metadata.setFormat('duration', sh.sampleCount / sh.sampleFrequency);
                    this.metadata.setFormat('numberOfChannels', sh.channelCount);
                    break;
                }
                case 'AP': // Audio Packet
                    this.audioLength += header.payloadLength;
                    await this.tokenizer.ignore(header.payloadLength);
                    break;
                case 'RG': // Replaygain
                case 'EI': // Encoder Info
                case 'SO': // Seek Table Offset
                case 'ST': // Seek Table
                case 'CT': // Chapter-Tag
                    await this.tokenizer.ignore(header.payloadLength);
                    break;
                case 'SE': // Stream End
                    if (this.metadata.format.duration) {
                        this.metadata.setFormat('bitrate', this.audioLength * 8 / this.metadata.format.duration);
                    }
                    return tryParseApeHeader(this.metadata, this.tokenizer, this.options);
                default:
                    throw new MusepackContentError(`Unexpected header: ${header.key}`);
            }
            // biome-ignore lint/correctness/noConstantCondition: break is handled in the switch statement
        } while (true);
    }
}

class BitReader {
    constructor(tokenizer) {
        this.pos = 0;
        this.dword = null;
        this.tokenizer = tokenizer;
    }
    /**
     *
     * @param bits 1..30 bits
     */
    async read(bits) {
        while (this.dword === null) {
            this.dword = await this.tokenizer.readToken(UINT32_LE);
        }
        let out = this.dword;
        this.pos += bits;
        if (this.pos < 32) {
            out >>>= (32 - this.pos);
            return out & ((1 << bits) - 1);
        }
        this.pos -= 32;
        if (this.pos === 0) {
            this.dword = null;
            return out & ((1 << bits) - 1);
        }
        this.dword = await this.tokenizer.readToken(UINT32_LE);
        if (this.pos) {
            out <<= this.pos;
            out |= this.dword >>> (32 - this.pos);
        }
        return out & ((1 << bits) - 1);
    }
    async ignore(bits) {
        if (this.pos > 0) {
            const remaining = 32 - this.pos;
            this.dword = null;
            bits -= remaining;
            this.pos = 0;
        }
        const remainder = bits % 32;
        const numOfWords = (bits - remainder) / 32;
        await this.tokenizer.ignore(numOfWords * 4);
        return this.read(remainder);
    }
}

/**
 * BASIC STRUCTURE
 */
const Header = {
    len: 6 * 4,
    get: (buf, off) => {
        const header = {
            // word 0
            signature: textDecode(buf.subarray(off, off + 3), 'latin1'),
            // versionIndex number * 1000 (3.81 = 3810) (remember that 4-byte alignment causes this to take 4-bytes)
            streamMinorVersion: getBitAllignedNumber(buf, off + 3, 0, 4),
            streamMajorVersion: getBitAllignedNumber(buf, off + 3, 4, 4),
            // word 1
            frameCount: UINT32_LE.get(buf, off + 4),
            // word 2
            maxLevel: UINT16_LE.get(buf, off + 8),
            sampleFrequency: [44100, 48000, 37800, 32000][getBitAllignedNumber(buf, off + 10, 0, 2)],
            link: getBitAllignedNumber(buf, off + 10, 2, 2),
            profile: getBitAllignedNumber(buf, off + 10, 4, 4),
            maxBand: getBitAllignedNumber(buf, off + 11, 0, 6),
            intensityStereo: isBitSet(buf, off + 11, 6),
            midSideStereo: isBitSet(buf, off + 11, 7),
            // word 3
            titlePeak: UINT16_LE.get(buf, off + 12),
            titleGain: UINT16_LE.get(buf, off + 14),
            // word 4
            albumPeak: UINT16_LE.get(buf, off + 16),
            albumGain: UINT16_LE.get(buf, off + 18),
            // word
            lastFrameLength: (UINT32_LE.get(buf, off + 20) >>> 20) & 0x7FF,
            trueGapless: isBitSet(buf, off + 23, 0)
        };
        header.lastFrameLength = header.trueGapless ? (UINT32_LE.get(buf, 20) >>> 20) & 0x7FF : 0;
        return header;
    }
};

const debug$1 = initDebug('music-metadata:parser:musepack');
class MpcSv7Parser extends BasicParser {
    constructor() {
        super(...arguments);
        this.bitreader = null;
        this.audioLength = 0;
        this.duration = null;
    }
    async parse() {
        const header = await this.tokenizer.readToken(Header);
        if (header.signature !== 'MP+')
            throw new MusepackContentError('Unexpected magic number');
        debug$1(`stream-version=${header.streamMajorVersion}.${header.streamMinorVersion}`);
        this.metadata.setFormat('container', 'Musepack, SV7');
        this.metadata.setFormat('sampleRate', header.sampleFrequency);
        const numberOfSamples = 1152 * (header.frameCount - 1) + header.lastFrameLength;
        this.metadata.setFormat('numberOfSamples', numberOfSamples);
        this.duration = numberOfSamples / header.sampleFrequency;
        this.metadata.setFormat('duration', this.duration);
        this.bitreader = new BitReader(this.tokenizer);
        this.metadata.setFormat('numberOfChannels', header.midSideStereo || header.intensityStereo ? 2 : 1);
        const version = await this.bitreader.read(8);
        this.metadata.setFormat('codec', (version / 100).toFixed(2));
        await this.skipAudioData(header.frameCount);
        debug$1(`End of audio stream, switching to APEv2, offset=${this.tokenizer.position}`);
        return tryParseApeHeader(this.metadata, this.tokenizer, this.options);
    }
    async skipAudioData(frameCount) {
        while (frameCount-- > 0) {
            const frameLength = await this.bitreader.read(20);
            this.audioLength += 20 + frameLength;
            await this.bitreader.ignore(frameLength);
        }
        // last frame
        const lastFrameLength = await this.bitreader.read(11);
        this.audioLength += lastFrameLength;
        if (this.duration !== null) {
            this.metadata.setFormat('bitrate', this.audioLength / this.duration);
        }
    }
}

const debug = initDebug('music-metadata:parser:musepack');
class MusepackParser extends AbstractID3Parser {
    async postId3v2Parse() {
        const signature = await this.tokenizer.peekToken(new StringType(3, 'latin1'));
        let mpcParser;
        switch (signature) {
            case 'MP+': {
                debug('Stream-version 7');
                mpcParser = new MpcSv7Parser(this.metadata, this.tokenizer, this.options);
                break;
            }
            case 'MPC': {
                debug('Stream-version 8');
                mpcParser = new MpcSv8Parser(this.metadata, this.tokenizer, this.options);
                break;
            }
            default: {
                throw new MusepackContentError('Invalid signature prefix');
            }
        }
        this.metadata.setAudioOnly();
        return mpcParser.parse();
    }
}

export { MusepackParser };
