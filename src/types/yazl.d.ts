declare module "yazl" {
	import type { Readable } from "node:stream";

	interface Options {
		mtime?: Date;
		mode?: number;
		compress?: boolean;
		forceZip64Format?: boolean;
	}

	class ZipFile {
		outputStream: Readable;
		addFile(realPath: string, metadataPath: string, options?: Options): void;
		addReadStream(
			input: Readable,
			metadataPath: string,
			options?: Options,
		): void;
		addBuffer(buffer: Buffer, metadataPath: string, options?: Options): void;
		addEmptyDirectory(metadataPath: string, options?: Options): void;
		end(options?: Options, finalSizeCallback?: () => void): void;
	}

	export { ZipFile, Options };
}
