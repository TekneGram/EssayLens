import type { FileKind } from '@/layout/FileControlContainer/domain/workspace.types';

const FILE_KIND_BY_EXTENSION: Record<string, FileKind> = {
    docx: 'docx',
    pdf: 'pdf',
    jpeg: 'jpeg',
    jpg: 'jpg',
    png: 'png',
    gif: 'gif',
    webp: 'webp',
    bmp: 'bmp',
    svg: 'svg',
    heic: 'heic',
    heif: 'heif',
    avif: 'avif',
    tiff: 'tiff',
    tif: 'tif'
};

const IMAGE_FILE_KIND_SET = new Set<FileKind>([
    'jpeg',
    'jpg',
    'png',
    'gif',
    'webp',
    'bmp',
    'svg',
    'heic',
    'heif',
    'avif',
    'tiff',
    'tif'
]);

export function fileKindFromExtension(extension: string | null | undefined): FileKind {
    if (!extension) {
        return 'unknown';
    }

    const normalized = extension.startsWith('.') ? extension.slice(1) : extension;
    const normalizedLower = normalized.toLowerCase();

    return FILE_KIND_BY_EXTENSION[normalizedLower] ?? 'unknown';
}

export function isImageFileKind(kind: FileKind): boolean {
    return IMAGE_FILE_KIND_SET.has(kind);
}
