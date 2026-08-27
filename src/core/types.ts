export interface BookMeta {
  slug: string;
  title: string;
  seriesTitle: string;
  bookNumber: number;
  adult: boolean;
  contentNote: string;
}

export interface VoiceSpec {
  speaker: string;
  pitch: number;
  rate: number;
  prefer: string[];
}

export interface SceneStateArt {
  image?: string;
  motion?: string;
}

export interface SceneSlot {
  id: string;
  fromParagraph: number;
  image?: string;
  motion?: string;
  alt: string;
  states?: Record<string, SceneStateArt>;
}

export interface InteractionBeat {
  id: string;
  paragraphIndex: number;
  promptLabel: string;
  setState: string;
  gate: boolean;
}

export interface PageArt {
  id: string;
  fromParagraph?: number;
  afterParagraph: number;
  image: string;
  alt: string;
  caption?: string;
}

export interface QuoteSpan {
  start: number;
  end: number;
}

export interface Paragraph {
  index: number;
  text: string;
  emph: boolean;
  speaker: string | null;
  quotes: QuoteSpan[];
  interactionId: string | null;
}

export interface Chapter {
  id: string;
  title: string;
  paragraphs: Paragraph[];
  scenes: SceneSlot[];
  interactions: InteractionBeat[];
  pageArt: PageArt[];
}

export interface Book {
  meta: BookMeta;
  voices: Record<string, VoiceSpec>;
  chapters: Chapter[];
}

export interface Cue {
  chapterIndex: number;
  paragraphIndex: number;
  sentenceIndex: number;
  text: string;
  speaker: string | null;
}
