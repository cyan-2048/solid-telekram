import { f as UINT32_LE, c as Uint8ArrayType, j as UINT16_LE, F as FourCcToken, B as BasicParser, J as tryParseApeHeader, N as UINT24_LE, b as UINT8, D as uint8ArrayToHex, m as makeUnexpectedFileContentError, d as initDebug } from './index-DKps7p52.js';

const SampleRates = [6000, 8000, 9600, 11025, 12000, 16000, 22050, 24000, 32000, 44100,
    48000, 64000, 88200, 96000, 192000, -1];
/**
 * WavPack Block Header
 *
 * 32-byte little-endian header at the front of every WavPack block
 *
 * Ref: http://www.wavpack.com/WavPack5FileFormat.pdf (page 2/6: 2.0 "Block Header")
 */
const BlockHeaderToken = {
    len: 32,
    get: (buf, off) => {
        const flags = UINT32_LE.get(buf, off + 24);
        const res = {
            // should equal 'wvpk'
            BlockID: FourCcToken.get(buf, off),
            //  0x402 to 0x410 are valid for decode
            blockSize: UINT32_LE.get(buf, off + 4),
            //  0x402 (1026) to 0x410 are valid for decode
            version: UINT16_LE.get(buf, off + 8),
            //  40-bit total samples for entire file (if block_index == 0 and a value of -1 indicates an unknown length)
            totalSamples: /* replace with bigint? (Token.UINT8.get(buf, off + 11) << 32) + */ UINT32_LE.get(buf, off + 12),
            // 40-bit block_index
            blockIndex: /* replace with bigint? (Token.UINT8.get(buf, off + 10) << 32) + */ UINT32_LE.get(buf, off + 16),
            // 40-bit total samples for entire file (if block_index == 0 and a value of -1 indicates an unknown length)
            blockSamples: UINT32_LE.get(buf, off + 20),
            // various flags for id and decoding
            flags: {
                bitsPerSample: (1 + getBitAllignedNumber(flags, 0, 2)) * 8,
                isMono: isBitSet(flags, 2),
                isHybrid: isBitSet(flags, 3),
                isJointStereo: isBitSet(flags, 4),
                crossChannel: isBitSet(flags, 5),
                hybridNoiseShaping: isBitSet(flags, 6),
                floatingPoint: isBitSet(flags, 7),
                samplingRate: SampleRates[getBitAllignedNumber(flags, 23, 4)],
                isDSD: isBitSet(flags, 31)
            },
            // crc for actual decoded data
            crc: new Uint8ArrayType(4).get(buf, off + 28)
        };
        if (res.flags.isDSD) {
            res.totalSamples *= 8;
        }
        return res;
    }
};
/**
 * 3.0 Metadata Sub-Blocks
 * Ref: http://www.wavpack.com/WavPack5FileFormat.pdf (page 4/6: 3.0 "Metadata Sub-Block")
 */
const MetadataIdToken = {
    len: 1,
    get: (buf, off) => {
        return {
            functionId: getBitAllignedNumber(buf[off], 0, 6), // functionId overlaps with isOptional flag
            isOptional: isBitSet(buf[off], 5),
            isOddSize: isBitSet(buf[off], 6),
            largeBlock: isBitSet(buf[off], 7)
        };
    }
};
function isBitSet(flags, bitOffset) {
    return getBitAllignedNumber(flags, bitOffset, 1) === 1;
}
function getBitAllignedNumber(flags, bitOffset, len) {
    return (flags >>> bitOffset) & (0xffffffff >>> (32 - len));
}

const debug = initDebug('music-metadata:parser:WavPack');
class WavPackContentError extends makeUnexpectedFileContentError('WavPack') {
}
/**
 * WavPack Parser
 */
class WavPackParser extends BasicParser {
    constructor() {
        super(...arguments);
        this.audioDataSize = 0;
    }
    async parse() {
        this.metadata.setAudioOnly();
        this.audioDataSize = 0;
        // First parse all WavPack blocks
        await this.parseWavPackBlocks();
        // try to parse APEv2 header
        return tryParseApeHeader(this.metadata, this.tokenizer, this.options);
    }
    async parseWavPackBlocks() {
        do {
            const blockId = await this.tokenizer.peekToken(FourCcToken);
            if (blockId !== 'wvpk')
                break;
            const header = await this.tokenizer.readToken(BlockHeaderToken);
            if (header.BlockID !== 'wvpk')
                throw new WavPackContentError('Invalid WavPack Block-ID');
            debug(`WavPack header blockIndex=${header.blockIndex}, len=${BlockHeaderToken.len}`);
            if (header.blockIndex === 0 && !this.metadata.format.container) {
                this.metadata.setFormat('container', 'WavPack');
                this.metadata.setFormat('lossless', !header.flags.isHybrid);
                // tagTypes: this.type,
                this.metadata.setFormat('bitsPerSample', header.flags.bitsPerSample);
                if (!header.flags.isDSD) {
                    // In case isDSD, these values will ne set in ID_DSD_BLOCK
                    this.metadata.setFormat('sampleRate', header.flags.samplingRate);
                    this.metadata.setFormat('duration', header.totalSamples / header.flags.samplingRate);
                }
                this.metadata.setFormat('numberOfChannels', header.flags.isMono ? 1 : 2);
                this.metadata.setFormat('numberOfSamples', header.totalSamples);
                this.metadata.setFormat('codec', header.flags.isDSD ? 'DSD' : 'PCM');
            }
            const ignoreBytes = header.blockSize - (BlockHeaderToken.len - 8);
            await (header.blockIndex === 0 ? this.parseMetadataSubBlock(header, ignoreBytes) : this.tokenizer.ignore(ignoreBytes));
            if (header.blockSamples > 0) {
                this.audioDataSize += header.blockSize; // Count audio data for bit-rate calculation
            }
        } while (!this.tokenizer.fileInfo.size || this.tokenizer.fileInfo.size - this.tokenizer.position >= BlockHeaderToken.len);
        if (this.metadata.format.duration) {
            this.metadata.setFormat('bitrate', this.audioDataSize * 8 / this.metadata.format.duration);
        }
    }
    /**
     * Ref: http://www.wavpack.com/WavPack5FileFormat.pdf, 3.0 Metadata Sub-blocks
     * @param header Header
     * @param remainingLength Remaining length
     */
    async parseMetadataSubBlock(header, remainingLength) {
        let remaining = remainingLength;
        while (remaining > MetadataIdToken.len) {
            const id = await this.tokenizer.readToken(MetadataIdToken);
            const dataSizeInWords = await this.tokenizer.readNumber(id.largeBlock ? UINT24_LE : UINT8);
            const data = new Uint8Array(dataSizeInWords * 2 - (id.isOddSize ? 1 : 0));
            await this.tokenizer.readBuffer(data);
            debug(`Metadata Sub-Blocks functionId=0x${id.functionId.toString(16)}, id.largeBlock=${id.largeBlock},data-size=${data.length}`);
            switch (id.functionId) {
                case 0x0: // ID_DUMMY: could be used to pad WavPack blocks
                    break;
                case 0xe: { // ID_DSD_BLOCK
                    debug('ID_DSD_BLOCK');
                    // https://github.com/dbry/WavPack/issues/71#issuecomment-483094813
                    const mp = 1 << UINT8.get(data, 0);
                    const samplingRate = header.flags.samplingRate * mp * 8; // ToDo: second factor should be read from DSD-metadata block https://github.com/dbry/WavPack/issues/71#issuecomment-483094813
                    if (!header.flags.isDSD)
                        throw new WavPackContentError('Only expect DSD block if DSD-flag is set');
                    this.metadata.setFormat('sampleRate', samplingRate);
                    this.metadata.setFormat('duration', header.totalSamples / samplingRate);
                    break;
                }
                case 0x24: // ID_ALT_TRAILER: maybe used to embed original ID3 tag header
                    debug('ID_ALT_TRAILER: trailer for non-wav files');
                    break;
                case 0x26: // ID_MD5_CHECKSUM
                    this.metadata.setFormat('audioMD5', data);
                    break;
                case 0x2f: // ID_BLOCK_CHECKSUM
                    debug(`ID_BLOCK_CHECKSUM: checksum=${uint8ArrayToHex(data)}`);
                    break;
                default:
                    debug(`Ignore unsupported meta-sub-block-id functionId=0x${id.functionId.toString(16)}`);
                    break;
            }
            remaining -= MetadataIdToken.len + (id.largeBlock ? UINT24_LE.len : UINT8.len) + dataSizeInWords * 2;
            debug(`remainingLength=${remaining}`);
            if (id.isOddSize)
                this.tokenizer.ignore(1);
        }
        if (remaining !== 0)
            throw new WavPackContentError('metadata-sub-block should fit it remaining length');
    }
}

export { WavPackContentError, WavPackParser };
