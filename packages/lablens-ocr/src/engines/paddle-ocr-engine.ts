import type { OcrEngine, OcrInput } from "./ocr-engine";
import type { OcrCell, OcrResult } from "../extraction/ocr-result";

interface PaddleBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PaddleCell {
  text: string;
  confidence: number;
  box: PaddleBox;
}

interface PaddleResult {
  text: string;
  confidence: number;
  lines: PaddleCell[][];
}

interface PaddleService {
  initialize(): Promise<void>;
  recognize(
    image: ArrayBuffer,
    options?: { noCache?: boolean }
  ): Promise<PaddleResult>;
  destroy(): Promise<void>;
}

interface CanvasModule {
  createCanvas: (width: number, height: number) => {
    width: number;
    height: number;
    getContext: (kind: string) => {
      drawImage: (img: unknown, x: number, y: number) => void;
      translate: (x: number, y: number) => void;
      rotate: (angle: number) => void;
    };
  };
  loadImage: (buf: ArrayBuffer) => Promise<{ width: number; height: number }>;
  CanvasProcessor: {
    prepareBuffer: (canvas: unknown) => Promise<ArrayBuffer>;
  };
}

export interface PaddleOcrEngineOptions {
  model?: unknown;
  modelName?: string;
  detectionPaddingHorizontal?: number;
}

export class PaddleOcrEngine implements OcrEngine {
  readonly name = "paddle-ocr";
  readonly version = "6.x";

  private readonly model: unknown;
  private readonly modelName: string;
  private readonly detectionPaddingHorizontal: number;
  private service: PaddleService | null = null;

  constructor(options: PaddleOcrEngineOptions = {}) {
    this.model = options.model;
    this.modelName = options.modelName ?? "v6-medium";
    this.detectionPaddingHorizontal =
      options.detectionPaddingHorizontal ?? 0.3;
  }

  private async getService(): Promise<PaddleService> {
    if (this.service) return this.service;
    const paddle = (await import("ppu-paddle-ocr")) as {
      PaddleOcrService: new (options: unknown) => PaddleService;
      V6_MEDIUM_MODEL: unknown;
    };
    const model = this.model ?? paddle.V6_MEDIUM_MODEL;
    const service = new paddle.PaddleOcrService({
      model,
      detection: { paddingHorizontal: this.detectionPaddingHorizontal },
      recognition: { strategy: "per-box" }
    });
    await service.initialize();
    this.service = service;
    return service;
  }

  async recognize(input: OcrInput): Promise<OcrResult> {
    if (input.kind === "text") {
      return { text: input.text, confidence: 1 };
    }
    if (input.kind !== "image") {
      throw new Error(`PaddleOcrEngine does not support input kind "${input.kind}"`);
    }

    const canvas = await import("ppu-ocv/canvas");
    const canvasModule = canvas as unknown as CanvasModule;
    const service = await this.getService();

    const arrayBuffer = toArrayBuffer(input.data);
    const image = await canvasModule.loadImage(arrayBuffer);
    const base = canvasModule.createCanvas(image.width, image.height);
    base.getContext("2d").drawImage(image, 0, 0);

    let best:
      | { confidence: number; angle: number; result: PaddleResult; width: number }
      | null = null;

    for (const angle of [0, 90, 180, 270]) {
      const swap = angle % 180 !== 0;
      const w = swap ? base.height : base.width;
      const h = swap ? base.width : base.height;
      const rotated = canvasModule.createCanvas(w, h);
      if (angle !== 0) {
        const ctx = rotated.getContext("2d");
        ctx.translate(w / 2, h / 2);
        ctx.rotate((angle * Math.PI) / 180);
      }
      rotated
        .getContext("2d")
        .drawImage(base, angle === 0 ? 0 : -base.width / 2, angle === 0 ? 0 : -base.height / 2);

      const outBuf = await canvasModule.CanvasProcessor.prepareBuffer(rotated as never);
      const result = await service.recognize(outBuf, { noCache: true });
      if (!best || result.confidence > best.confidence) {
        best = { confidence: result.confidence, angle, result, width: w };
      }
    }

    if (!best) {
      throw new Error("PaddleOcrEngine produced no result");
    }

    const cells: OcrCell[][] = best.result.lines.map((line) =>
      line.map((cell) => ({
        text: cell.text,
        confidence: cell.confidence,
        box: { x: cell.box.x, y: cell.box.y, width: cell.box.width, height: cell.box.height }
      }))
    );

    return {
      text: best.result.text,
      confidence: best.confidence,
      cells
    };
  }

  async destroy(): Promise<void> {
    if (this.service) {
      await this.service.destroy();
      this.service = null;
    }
  }
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer as ArrayBuffer;
}

export const V6_MEDIUM_MODEL = "v6-medium";
