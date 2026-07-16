import { B as BasicParser, L as ID3v2Header, E as EndOfStreamError, M as ID3v1Parser, d as initDebug } from './index-DKps7p52.js';
import { I as ID3v2Parser } from './ID3v2Parser-TMQxf0MS.js';

const debug = initDebug('music-metadata:parser:ID3');
/**
 * Abstract parser which tries take ID3v2 and ID3v1 headers.
 */
class AbstractID3Parser extends BasicParser {
    constructor() {
        super(...arguments);
        this.id3parser = new ID3v2Parser();
    }
    static async startsWithID3v2Header(tokenizer) {
        return (await tokenizer.peekToken(ID3v2Header)).fileIdentifier === 'ID3';
    }
    async parse() {
        try {
            await this.parseID3v2();
        }
        catch (err) {
            if (err instanceof EndOfStreamError) {
                debug("End-of-stream");
            }
            else {
                throw err;
            }
        }
    }
    finalize() {
        return;
    }
    async parseID3v2() {
        await this.tryReadId3v2Headers();
        debug('End of ID3v2 header, go to MPEG-parser: pos=%s', this.tokenizer.position);
        await this.postId3v2Parse();
        if (this.options.skipPostHeaders && this.metadata.hasAny()) {
            this.finalize();
        }
        else {
            const id3v1parser = new ID3v1Parser(this.metadata, this.tokenizer, this.options);
            await id3v1parser.parse();
            this.finalize();
        }
    }
    async tryReadId3v2Headers() {
        const id3Header = await this.tokenizer.peekToken(ID3v2Header);
        if (id3Header.fileIdentifier === 'ID3') {
            debug('Found ID3v2 header, pos=%s', this.tokenizer.position);
            await this.id3parser.parse(this.metadata, this.tokenizer, this.options);
            return this.tryReadId3v2Headers();
        }
    }
}

export { AbstractID3Parser as A };
