export interface Downloader {
	/**return Blob early when it's already in cache */
	append(a: BlobPart): Promise<undefined | Blob>;
	finalize(): Promise<Blob>;
	cancel(): Promise<undefined>;

	readonly finalized: boolean;
}
