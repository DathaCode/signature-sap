declare module 'multer-s3' {
    type Request = import('express').Request;
    type S3Client = import('@aws-sdk/client-s3').S3Client;
    type StorageEngine = import('multer').StorageEngine;

    namespace multerS3 {
        interface Options {
            s3: S3Client;
            bucket: string;
            contentType?: (
                req: Request,
                file: Express.Multer.File,
                cb: (error: Error | null, mime: string, stream: NodeJS.ReadableStream) => void
            ) => void;
            key?: (
                req: Request,
                file: Express.Multer.File,
                cb: (error: Error | null, key: string) => void
            ) => void;
        }

        const AUTO_CONTENT_TYPE: Options['contentType'];
    }

    function multerS3(options: multerS3.Options): StorageEngine;

    export = multerS3;
}

declare namespace Express {
    namespace MulterS3 {
        interface File extends Express.Multer.File {
            bucket: string;
            key: string;
            location: string;
            etag: string;
            contentType: string;
        }
    }
}
