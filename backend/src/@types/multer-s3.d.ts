import { Request } from 'express';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageEngine } from 'multer';

declare module 'multer-s3' {
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

    function multerS3(options: Options): StorageEngine;

    export = multerS3;
}

declare global {
    namespace Express {
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
}
