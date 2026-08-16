export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface OcrLine {
  text: string;
  confidence: number;
  words: OcrWord[];
  boundingBox?: BoundingBox;
}

export interface OcrCell {
  text: string;
  confidence: number;
  box: BoundingBox;
}

export interface OcrResult {
  text: string;
  confidence: number;
  page?: number;
  lines?: OcrLine[];
  words?: OcrWord[];
  cells?: OcrCell[][];
}
