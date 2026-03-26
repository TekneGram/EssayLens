import type { FeedbackAnchor } from '@/features/feedback/domain';

export type WordAnchor = FeedbackAnchor;

export interface WordTextUnit {
  part: string;
  paragraphIndex: number;
  runIndex: number;
  text: string;
  globalStart: number;
  globalEnd: number;
}

export interface WordParagraphUnit {
  part: string;
  paragraphIndex: number;
  text: string;
  units: WordTextUnit[];
  totalLength: number;
}

export interface WordTextMap {
  paragraphs: WordParagraphUnit[];
  part: string;
}
