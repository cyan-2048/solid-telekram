import { h as UINT64_LE, F as FourCcToken, o as INT64_LE, p as INT32_LE, m as makeUnexpectedFileContentError, d as initDebug } from './index-DKps7p52.js';
import { A as AbstractID3Parser } from './AbstractID3Parser-kEkce6EC.js';
import { I as ID3v2Parser } from './ID3v2Parser-TMQxf0MS.js';

/**
 * Common chunk DSD header: the 'chunk name (Four-CC)' & chunk size
 */
const ChunkHeader = {
    len: 12,
    get: (buf, off) => {
        return { id: FourCcToken.get(buf, off), size: UINT64_LE.get(buf, off + 4) };
    }
};
/**
 * Common chunk DSD header: the 'chunk name (Four-CC)' & chunk size
 */
const DsdChunk = {
    len: 16,
    get: (buf, off) => {
        return {
            fileSize: INT64_LE.get(buf, off),
            metadataPointer: INT64_LE.get(buf, off + 8)
        };
    }
};
/**
 * Common chunk DSD header: the 'chunk name (Four-CC)' & chunk size
 */
const FormatChunk = {
    len: 40,
    get: (buf, off) => {
        return {
            formatVersion: INT32_LE.get(buf, off),
            formatID: INT32_LE.get(buf, off + 4),
            channelType: INT32_LE.get(buf, off + 8),
            channelNum: INT32_LE.get(buf, off + 12),
            samplingFrequency: INT32_LE.get(buf, off + 16),
            bitsPerSample: INT32_LE.get(buf, off + 20),
            sampleCount: INT64_LE.get(buf, off + 24),
            blockSizePerChannel: INT32_LE.get(buf, off + 32)
        };
    }
};

const debug = initDebug('music-metadata:parser:DSF');
class DsdContentParseError extends makeUnexpectedFileContentError('DSD') {
}
/**
 * DSF (dsd stream file) File Parser
 * Ref: https://dsd-guide.com/sites/default/files/white-papers/DSFFileFormatSpec_E.pdf
 */
class DsfParser extends AbstractID3Parser {
    async postId3v2Parse() {
        const p0 = this.tokenizer.position; // mark start position, normally 0
        const chunkHeader = await this.tokenizer.readToken(ChunkHeader);
        if (chunkHeader.id !== 'DSD ')
            throw new DsdContentParseError('Invalid chunk signature');
        this.metadata.setFormat('container', 'DSF');
        this.metadata.setFormat('lossless', true);
        this.metadata.setAudioOnly();
        const dsdChunk = await this.tokenizer.readToken(DsdChunk);
        if (dsdChunk.metadataPointer === BigInt(0)) {
            debug("No ID3v2 tag present");
        }
        else {
            debug(`expect ID3v2 at offset=${dsdChunk.metadataPointer}`);
            await this.parseChunks(dsdChunk.fileSize - chunkHeader.size);
            // Jump to ID3 header
            await this.tokenizer.ignore(Number(dsdChunk.metadataPointer) - this.tokenizer.position - p0);
            return new ID3v2Parser().parse(this.metadata, this.tokenizer, this.options);
        }
    }
    async parseChunks(bytesRemaining) {
        while (bytesRemaining >= ChunkHeader.len) {
            const chunkHeader = await this.tokenizer.readToken(ChunkHeader);
            debug(`Parsing chunk name=${chunkHeader.id} size=${chunkHeader.size}`);
            switch (chunkHeader.id) {
                case 'fmt ': {
                    const formatChunk = await this.tokenizer.readToken(FormatChunk);
                    this.metadata.setFormat('numberOfChannels', formatChunk.channelNum);
                    this.metadata.setFormat('sampleRate', formatChunk.samplingFrequency);
                    this.metadata.setFormat('bitsPerSample', formatChunk.bitsPerSample);
                    this.metadata.setFormat('numberOfSamples', formatChunk.sampleCount);
                    this.metadata.setFormat('duration', Number(formatChunk.sampleCount) / formatChunk.samplingFrequency);
                    const bitrate = formatChunk.bitsPerSample * formatChunk.samplingFrequency * formatChunk.channelNum;
                    this.metadata.setFormat('bitrate', bitrate);
                    return; // We got what we want, stop further processing of chunks
                }
                default:
                    this.tokenizer.ignore(Number(chunkHeader.size) - ChunkHeader.len);
                    break;
            }
            bytesRemaining -= chunkHeader.size;
        }
    }
}

export { DsdContentParseError, DsfParser };
