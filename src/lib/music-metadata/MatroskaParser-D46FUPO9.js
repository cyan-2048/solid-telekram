import { E as EndOfStreamError, b as UINT8, q as Float64_BE, r as Float32_BE, S as StringType, d as initDebug, m as makeUnexpectedFileContentError, t as UINT64_BE, B as BasicParser, u as TargetType, T as TrackType } from './index-DKps7p52.js';

const DataType = {
    string: 0,
    uint: 1,
    uid: 2,
    bool: 3,
    binary: 4,
    float: 5,
};

/**
 * Elements of document type description
 * Derived from https://github.com/tungol/EBML/blob/master/doctypes/matroska.dtd
 * Extended with:
 * - https://www.matroska.org/technical/specs/index.html
 */
const matroskaDtd = {
    name: 'dtd',
    container: {
        0x1a45dfa3: {
            name: 'ebml',
            container: {
                0x4286: { name: 'ebmlVersion', value: DataType.uint }, // 5.1.1
                0x42f7: { name: 'ebmlReadVersion', value: DataType.uint }, // 5.1.2
                0x42f2: { name: 'ebmlMaxIDWidth', value: DataType.uint }, // 5.1.3
                0x42f3: { name: 'ebmlMaxSizeWidth', value: DataType.uint }, // 5.1.4
                0x4282: { name: 'docType', value: DataType.string }, // 5.1.5
                0x4287: { name: 'docTypeVersion', value: DataType.uint }, // 5.1.6
                0x4285: { name: 'docTypeReadVersion', value: DataType.uint } // 5.1.7
            }
        },
        // Matroska segments
        0x18538067: {
            name: 'segment',
            container: {
                // Meta Seek Information (also known as MetaSeek)
                0x114d9b74: {
                    name: 'seekHead',
                    container: {
                        0x4dbb: {
                            name: 'seek',
                            multiple: true,
                            container: {
                                0x53ab: { name: 'id', value: DataType.binary },
                                0x53ac: { name: 'position', value: DataType.uint }
                            }
                        }
                    }
                },
                // Segment Information
                0x1549a966: {
                    name: 'info',
                    container: {
                        0x73a4: { name: 'uid', value: DataType.uid },
                        0x7384: { name: 'filename', value: DataType.string },
                        0x3cb923: { name: 'prevUID', value: DataType.uid },
                        0x3c83ab: { name: 'prevFilename', value: DataType.string },
                        0x3eb923: { name: 'nextUID', value: DataType.uid },
                        0x3e83bb: { name: 'nextFilename', value: DataType.string },
                        0x2ad7b1: { name: 'timecodeScale', value: DataType.uint },
                        0x4489: { name: 'duration', value: DataType.float },
                        0x4461: { name: 'dateUTC', value: DataType.uint },
                        0x7ba9: { name: 'title', value: DataType.string },
                        0x4d80: { name: 'muxingApp', value: DataType.string },
                        0x5741: { name: 'writingApp', value: DataType.string }
                    }
                },
                // Cluster
                0x1f43b675: {
                    name: 'cluster',
                    multiple: true,
                    container: {
                        0xe7: { name: 'timecode', value: DataType.uid },
                        0x58d7: { name: 'silentTracks ', multiple: true },
                        0xa7: { name: 'position', value: DataType.uid },
                        0xab: { name: 'prevSize', value: DataType.uid },
                        0xa0: { name: 'blockGroup' },
                        0xa3: { name: 'simpleBlock' }
                    }
                },
                // Track
                0x1654ae6b: {
                    name: 'tracks',
                    container: {
                        0xae: {
                            name: 'entries',
                            multiple: true,
                            container: {
                                0xd7: { name: 'trackNumber', value: DataType.uint },
                                0x73c5: { name: 'uid', value: DataType.uid },
                                0x83: { name: 'trackType', value: DataType.uint },
                                0xb9: { name: 'flagEnabled', value: DataType.bool },
                                0x88: { name: 'flagDefault', value: DataType.bool },
                                0x55aa: { name: 'flagForced', value: DataType.bool }, // extended
                                0x9c: { name: 'flagLacing', value: DataType.bool },
                                0x6de7: { name: 'minCache', value: DataType.uint },
                                0x6de8: { name: 'maxCache', value: DataType.uint },
                                0x23e383: { name: 'defaultDuration', value: DataType.uint },
                                0x23314f: { name: 'timecodeScale', value: DataType.float },
                                0x536e: { name: 'name', value: DataType.string },
                                0x22b59c: { name: 'language', value: DataType.string },
                                0x86: { name: 'codecID', value: DataType.string },
                                0x63a2: { name: 'codecPrivate', value: DataType.binary },
                                0x258688: { name: 'codecName', value: DataType.string },
                                0x3a9697: { name: 'codecSettings', value: DataType.string },
                                0x3b4040: { name: 'codecInfoUrl', value: DataType.string },
                                0x26b240: { name: 'codecDownloadUrl', value: DataType.string },
                                0xaa: { name: 'codecDecodeAll', value: DataType.bool },
                                0x6fab: { name: 'trackOverlay', value: DataType.uint },
                                // Video
                                0xe0: {
                                    name: 'video',
                                    container: {
                                        0x9a: { name: 'flagInterlaced', value: DataType.bool },
                                        0x53b8: { name: 'stereoMode', value: DataType.uint },
                                        0xb0: { name: 'pixelWidth', value: DataType.uint },
                                        0xba: { name: 'pixelHeight', value: DataType.uint },
                                        0x54b0: { name: 'displayWidth', value: DataType.uint },
                                        0x54ba: { name: 'displayHeight', value: DataType.uint },
                                        0x54b3: { name: 'aspectRatioType', value: DataType.uint },
                                        0x2eb524: { name: 'colourSpace', value: DataType.uint },
                                        0x2fb523: { name: 'gammaValue', value: DataType.float }
                                    }
                                },
                                // Audio
                                0xe1: {
                                    name: 'audio',
                                    container: {
                                        0xb5: { name: 'samplingFrequency', value: DataType.float },
                                        0x78b5: { name: 'outputSamplingFrequency', value: DataType.float },
                                        0x9f: { name: 'channels', value: DataType.uint }, // https://www.matroska.org/technical/specs/index.html
                                        0x94: { name: 'channels', value: DataType.uint },
                                        0x7d7b: { name: 'channelPositions', value: DataType.binary },
                                        0x6264: { name: 'bitDepth', value: DataType.uint }
                                    }
                                },
                                // Content Encoding
                                0x6d80: {
                                    name: 'contentEncodings',
                                    container: {
                                        0x6240: {
                                            name: 'contentEncoding',
                                            container: {
                                                0x5031: { name: 'order', value: DataType.uint },
                                                0x5032: { name: 'scope', value: DataType.bool },
                                                0x5033: { name: 'type', value: DataType.uint },
                                                0x5034: {
                                                    name: 'contentEncoding',
                                                    container: {
                                                        0x4254: { name: 'contentCompAlgo', value: DataType.uint },
                                                        0x4255: { name: 'contentCompSettings', value: DataType.binary }
                                                    }
                                                },
                                                0x5035: {
                                                    name: 'contentEncoding',
                                                    container: {
                                                        0x47e1: { name: 'contentEncAlgo', value: DataType.uint },
                                                        0x47e2: { name: 'contentEncKeyID', value: DataType.binary },
                                                        0x47e3: { name: 'contentSignature ', value: DataType.binary },
                                                        0x47e4: { name: 'ContentSigKeyID  ', value: DataType.binary },
                                                        0x47e5: { name: 'contentSigAlgo ', value: DataType.uint },
                                                        0x47e6: { name: 'contentSigHashAlgo ', value: DataType.uint }
                                                    }
                                                },
                                                0x6264: { name: 'bitDepth', value: DataType.uint }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                // Cueing Data
                0x1c53bb6b: {
                    name: 'cues',
                    container: {
                        0xbb: {
                            name: 'cuePoint',
                            container: {
                                0xb3: { name: 'cueTime', value: DataType.uid },
                                0xb7: {
                                    name: 'positions',
                                    container: {
                                        0xf7: { name: 'track', value: DataType.uint },
                                        0xf1: { name: 'clusterPosition', value: DataType.uint },
                                        0x5378: { name: 'blockNumber', value: DataType.uint },
                                        0xea: { name: 'codecState', value: DataType.uint },
                                        0xdb: {
                                            name: 'reference', container: {
                                                0x96: { name: 'time', value: DataType.uint },
                                                0x97: { name: 'cluster', value: DataType.uint },
                                                0x535f: { name: 'number', value: DataType.uint },
                                                0xeb: { name: 'codecState', value: DataType.uint }
                                            }
                                        },
                                        0xf0: { name: 'relativePosition', value: DataType.uint } // extended
                                    }
                                }
                            }
                        }
                    }
                },
                // Attachment
                0x1941a469: {
                    name: 'attachments',
                    container: {
                        0x61a7: {
                            name: 'attachedFiles',
                            multiple: true,
                            container: {
                                0x467e: { name: 'description', value: DataType.string },
                                0x466e: { name: 'name', value: DataType.string },
                                0x4660: { name: 'mimeType', value: DataType.string },
                                0x465c: { name: 'data', value: DataType.binary },
                                0x46ae: { name: 'uid', value: DataType.uid }
                            }
                        }
                    }
                },
                // Chapters
                0x1043a770: {
                    name: 'chapters',
                    container: {
                        0x45b9: {
                            name: 'editionEntry',
                            container: {
                                0xb6: {
                                    name: 'chapterAtom',
                                    container: {
                                        0x73c4: { name: 'uid', value: DataType.uid },
                                        0x91: { name: 'timeStart', value: DataType.uint },
                                        0x92: { name: 'timeEnd', value: DataType.uid },
                                        0x98: { name: 'hidden', value: DataType.bool },
                                        0x4598: { name: 'enabled', value: DataType.uid },
                                        0x8f: {
                                            name: 'track', container: {
                                                0x89: { name: 'trackNumber', value: DataType.uid },
                                                0x80: {
                                                    name: 'display', container: {
                                                        0x85: { name: 'string', value: DataType.string },
                                                        0x437c: { name: 'language ', value: DataType.string },
                                                        0x437e: { name: 'country ', value: DataType.string }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                // Tagging
                0x1254c367: {
                    name: 'tags',
                    container: {
                        0x7373: {
                            name: 'tag',
                            multiple: true,
                            container: {
                                0x63c0: {
                                    name: 'target',
                                    container: {
                                        0x63c5: { name: 'tagTrackUID', value: DataType.uid },
                                        0x63c4: { name: 'tagChapterUID', value: DataType.uint },
                                        0x63c6: { name: 'tagAttachmentUID', value: DataType.uid },
                                        0x63ca: { name: 'targetType', value: DataType.string }, // extended
                                        0x68ca: { name: 'targetTypeValue', value: DataType.uint }, // extended
                                        0x63c9: { name: 'tagEditionUID', value: DataType.uid } // extended
                                    }
                                },
                                0x67c8: {
                                    name: 'simpleTags',
                                    multiple: true,
                                    container: {
                                        0x45a3: { name: 'name', value: DataType.string },
                                        0x4487: { name: 'string', value: DataType.string },
                                        0x4485: { name: 'binary', value: DataType.binary },
                                        0x447a: { name: 'language', value: DataType.string }, // extended
                                        0x447b: { name: 'languageIETF', value: DataType.string }, // extended
                                        0x4484: { name: 'default', value: DataType.bool } // extended
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

const debug$1 = initDebug('music-metadata:parser:ebml');
class EbmlContentError extends makeUnexpectedFileContentError('EBML') {
}
const ParseAction = {
    ReadNext: 0, // Continue reading the next elements
    IgnoreElement: 2, // Ignore (do not read) this element
    SkipSiblings: 3, // Skip all remaining elements at the same level
    TerminateParsing: 4, // Terminate the parsing process
    SkipElement: 5 // Consider the element has read, assume position is at the next element
};
/**
 * Extensible Binary Meta Language (EBML) iterator
 * https://en.wikipedia.org/wiki/Extensible_Binary_Meta_Language
 * http://matroska.sourceforge.net/technical/specs/rfc/index.html
 *
 * WEBM VP8 AUDIO FILE
 */
class EbmlIterator {
    /**
     * @param {ITokenizer} tokenizer Input
     * @param tokenizer
     */
    constructor(tokenizer) {
        this.parserMap = new Map();
        this.ebmlMaxIDLength = 4;
        this.ebmlMaxSizeLength = 8;
        this.tokenizer = tokenizer;
        this.parserMap.set(DataType.uint, e => this.readUint(e));
        this.parserMap.set(DataType.string, e => this.readString(e));
        this.parserMap.set(DataType.binary, e => this.readBuffer(e));
        this.parserMap.set(DataType.uid, async (e) => this.readBuffer(e));
        this.parserMap.set(DataType.bool, e => this.readFlag(e));
        this.parserMap.set(DataType.float, e => this.readFloat(e));
    }
    async iterate(dtdElement, posDone, listener) {
        return this.parseContainer(linkParents(dtdElement), posDone, listener);
    }
    async parseContainer(dtdElement, posDone, listener) {
        const tree = {};
        while (this.tokenizer.position < posDone) {
            let element;
            const elementPosition = this.tokenizer.position;
            try {
                element = await this.readElement();
            }
            catch (error) {
                if (error instanceof EndOfStreamError) {
                    break;
                }
                throw error;
            }
            const child = dtdElement.container[element.id];
            if (child) {
                const action = listener.startNext(child);
                switch (action) {
                    case ParseAction.ReadNext:
                        {
                            if (element.id === 0x1F43B675) ;
                            debug$1(`Read element: name=${getElementPath(child)}{id=0x${element.id.toString(16)}, container=${!!child.container}} at position=${elementPosition}`);
                            if (child.container) {
                                const res = await this.parseContainer(child, element.len >= 0 ? this.tokenizer.position + element.len : -1, listener);
                                if (child.multiple) {
                                    if (!tree[child.name]) {
                                        tree[child.name] = [];
                                    }
                                    tree[child.name].push(res);
                                }
                                else {
                                    tree[child.name] = res;
                                }
                                await listener.elementValue(child, res, elementPosition);
                            }
                            else {
                                const parser = this.parserMap.get(child.value);
                                if (typeof parser === 'function') {
                                    const value = await parser(element);
                                    tree[child.name] = value;
                                    await listener.elementValue(child, value, elementPosition);
                                }
                            }
                        }
                        break;
                    case ParseAction.SkipElement:
                        debug$1(`Go to next element: name=${getElementPath(child)}, element.id=0x${element.id}, container=${!!child.container} at position=${elementPosition}`);
                        break;
                    case ParseAction.IgnoreElement:
                        debug$1(`Ignore element: name=${getElementPath(child)}, element.id=0x${element.id}, container=${!!child.container} at position=${elementPosition}`);
                        await this.tokenizer.ignore(element.len);
                        break;
                    case ParseAction.SkipSiblings:
                        debug$1(`Ignore remaining container, at: name=${getElementPath(child)}, element.id=0x${element.id}, container=${!!child.container} at position=${elementPosition}`);
                        await this.tokenizer.ignore(posDone - this.tokenizer.position);
                        break;
                    case ParseAction.TerminateParsing:
                        debug$1(`Terminate parsing at element: name=${getElementPath(child)}, element.id=0x${element.id}, container=${!!child.container} at position=${elementPosition}`);
                        return tree;
                }
            }
            else {
                switch (element.id) {
                    case 0xec: // void
                        await this.tokenizer.ignore(element.len);
                        break;
                    default:
                        debug$1(`parseEbml: parent=${getElementPath(dtdElement)}, unknown child: id=${element.id.toString(16)} at position=${elementPosition}`);
                        await this.tokenizer.ignore(element.len);
                }
            }
        }
        return tree;
    }
    async readVintData(maxLength) {
        const msb = await this.tokenizer.peekNumber(UINT8);
        let mask = 0x80;
        let oc = 1;
        // Calculate VINT_WIDTH
        while ((msb & mask) === 0) {
            if (oc > maxLength) {
                throw new EbmlContentError('VINT value exceeding maximum size');
            }
            ++oc;
            mask >>= 1;
        }
        const id = new Uint8Array(oc);
        await this.tokenizer.readBuffer(id);
        return id;
    }
    async readElement() {
        const id = await this.readVintData(this.ebmlMaxIDLength);
        const lenField = await this.readVintData(this.ebmlMaxSizeLength);
        lenField[0] ^= 0x80 >> (lenField.length - 1);
        return {
            id: readUIntBE(id, id.length),
            len: readUIntBE(lenField, lenField.length)
        };
    }
    async readFloat(e) {
        switch (e.len) {
            case 0:
                return 0.0;
            case 4:
                return this.tokenizer.readNumber(Float32_BE);
            case 8:
                return this.tokenizer.readNumber(Float64_BE);
            case 10:
                return this.tokenizer.readNumber(Float64_BE);
            default:
                throw new EbmlContentError(`Invalid IEEE-754 float length: ${e.len}`);
        }
    }
    async readFlag(e) {
        return (await this.readUint(e)) === 1;
    }
    async readUint(e) {
        const buf = await this.readBuffer(e);
        return readUIntBE(buf, e.len);
    }
    async readString(e) {
        const rawString = await this.tokenizer.readToken(new StringType(e.len, 'utf-8'));
        return rawString.replace(/\x00.*$/g, '');
    }
    async readBuffer(e) {
        const buf = new Uint8Array(e.len);
        await this.tokenizer.readBuffer(buf);
        return buf;
    }
}
function readUIntBE(buf, len) {
    return Number(readUIntBeAsBigInt(buf, len));
}
/**
 * Reeds an unsigned integer from a big endian buffer of length `len`
 * @param buf Buffer to decode from
 * @param len Number of bytes
 * @private
 */
function readUIntBeAsBigInt(buf, len) {
    const normalizedNumber = new Uint8Array(8);
    const cleanNumber = buf.subarray(0, len);
    try {
        normalizedNumber.set(cleanNumber, 8 - len);
        return UINT64_BE.get(normalizedNumber, 0);
    }
    catch (_error) {
        return BigInt(-1);
    }
}
function linkParents(element) {
    if (element.container) {
        Object.keys(element.container)
            .map(id => {
            const child = element.container[id];
            child.id = Number.parseInt(id, 10);
            return child;
        }).forEach(child => {
            child.parent = element;
            linkParents(child);
        });
    }
    return element;
}
function getElementPath(element) {
    let path = '';
    if (element.parent && element.parent.name !== 'dtd') {
        path += `${getElementPath(element.parent)}/`;
    }
    return path + element.name;
}

const debug = initDebug('music-metadata:parser:matroska');
/**
 * Extensible Binary Meta Language (EBML) parser
 * https://en.wikipedia.org/wiki/Extensible_Binary_Meta_Language
 * http://matroska.sourceforge.net/technical/specs/rfc/index.html
 *
 * WEBM VP8 AUDIO FILE
 */
class MatroskaParser extends BasicParser {
    constructor() {
        super(...arguments);
        this.seekHeadOffset = 0;
        /**
         * Use index to skip multiple segment/cluster elements at once.
         * Significant performance impact
         */
        this.flagUseIndexToSkipClusters = this.options.mkvUseIndex ?? false;
    }
    async parse() {
        const containerSize = this.tokenizer.fileInfo.size ?? Number.MAX_SAFE_INTEGER;
        const matroskaIterator = new EbmlIterator(this.tokenizer);
        debug('Initializing DTD end MatroskaIterator');
        await matroskaIterator.iterate(matroskaDtd, containerSize, {
            startNext: (element) => {
                switch (element.id) {
                    // case 0x1f43b675: // cluster
                    case 0x1c53bb6b: // Cueing Data
                        debug(`Skip element: name=${element.name}, id=0x${element.id.toString(16)}`);
                        return ParseAction.IgnoreElement;
                    case 0x1f43b675: // cluster
                        if (this.flagUseIndexToSkipClusters && this.seekHead) {
                            const index = this.seekHead.seek.find(index => index.position + this.seekHeadOffset > this.tokenizer.position);
                            if (index) {
                                // Go to next index position
                                const ignoreSize = index.position + this.seekHeadOffset - this.tokenizer.position;
                                debug(`Use index to go to next position, ignoring ${ignoreSize} bytes`);
                                this.tokenizer.ignore(ignoreSize);
                                return ParseAction.SkipElement;
                            }
                        }
                        return ParseAction.IgnoreElement;
                    default:
                        return ParseAction.ReadNext;
                }
            },
            elementValue: async (element, value, offset) => {
                debug(`Received: name=${element.name}, value=${value}`);
                switch (element.id) {
                    case 0x4282: // docType
                        this.metadata.setFormat('container', `EBML/${value}`);
                        break;
                    case 0x114d9b74:
                        this.seekHead = value;
                        this.seekHeadOffset = offset;
                        break;
                    case 0x1549a966:
                        { // Info (Segment Information)
                            const info = value;
                            const timecodeScale = info.timecodeScale ? info.timecodeScale : 1000000;
                            if (typeof info.duration === 'number') {
                                const duration = info.duration * timecodeScale / 1000000000;
                                await this.addTag('segment:title', info.title);
                                this.metadata.setFormat('duration', Number(duration));
                            }
                        }
                        break;
                    case 0x1654ae6b:
                        { // tracks
                            const audioTracks = value;
                            if (audioTracks?.entries) {
                                audioTracks.entries.forEach(entry => {
                                    const stream = {
                                        codecName: entry.codecID.replace('A_', '').replace('V_', ''),
                                        codecSettings: entry.codecSettings,
                                        flagDefault: entry.flagDefault,
                                        flagLacing: entry.flagLacing,
                                        flagEnabled: entry.flagEnabled,
                                        language: entry.language,
                                        name: entry.name,
                                        type: entry.trackType,
                                        audio: entry.audio,
                                        video: entry.video
                                    };
                                    this.metadata.addStreamInfo(stream);
                                });
                                const audioTrack = audioTracks.entries
                                    .filter(entry => entry.trackType === TrackType.audio)
                                    .reduce((acc, cur) => {
                                    if (!acc)
                                        return cur;
                                    if (cur.flagDefault && !acc.flagDefault)
                                        return cur;
                                    if (cur.trackNumber < acc.trackNumber)
                                        return cur;
                                    return acc;
                                }, null);
                                if (audioTrack) {
                                    this.metadata.setFormat('codec', audioTrack.codecID.replace('A_', ''));
                                    this.metadata.setFormat('sampleRate', audioTrack.audio.samplingFrequency);
                                    this.metadata.setFormat('numberOfChannels', audioTrack.audio.channels);
                                }
                            }
                        }
                        break;
                    case 0x1254c367:
                        { // tags
                            const tags = value;
                            await Promise.all(tags.tag.map(async (tag) => {
                                const target = tag.target;
                                const targetType = target?.targetTypeValue ? TargetType[target.targetTypeValue] : (target?.targetType ? target.targetType : 'track');
                                await Promise.all(tag.simpleTags.map(async (simpleTag) => {
                                    const value = simpleTag.string ? simpleTag.string : simpleTag.binary;
                                    await this.addTag(`${targetType}:${simpleTag.name}`, value);
                                }));
                            }));
                        }
                        break;
                    case 0x1941a469:
                        { // attachments
                            const attachments = value;
                            await Promise.all(attachments.attachedFiles
                                .filter(file => file.mimeType.startsWith('image/'))
                                .map(file => this.addTag('picture', {
                                data: file.data,
                                format: file.mimeType,
                                description: file.description,
                                name: file.name
                            })));
                        }
                        break;
                }
            }
        });
    }
    async addTag(tagId, value) {
        await this.metadata.addTag('matroska', tagId, value);
    }
}

export { MatroskaParser };
