import { describe, expect, it } from 'vitest';
import { fileKindFromExtension } from '@/layout/FileControlContainer/domain/fileKind';

describe('fileKindFromExtension', () => {
    it('normalizes uppercase and leading dot extensions', () => {
        expect(fileKindFromExtension('PDF')).toBe('pdf');
        expect(fileKindFromExtension('.JpG')).toBe('jpg');
        expect(fileKindFromExtension('Docx')).toBe('docx');
    });

    it('returns unknown for missing or unsupported extensions', () => {
        expect(fileKindFromExtension(undefined)).toBe('unknown');
        expect(fileKindFromExtension(null)).toBe('unknown');
        expect(fileKindFromExtension('')).toBe('unknown');
        expect(fileKindFromExtension('zip')).toBe('unknown');
    });
});
