import type {
  OcrCell,
  OcrEngine,
  OcrInput,
  OcrResult
} from "@lablens/ocr/portable";
import { PaddleOcrService } from "ppu-paddle-ocr/mobile";
import type { PaddleOcrResult } from "ppu-paddle-ocr/mobile";
import { getPlatform } from "ppu-ocv/canvas-mobile";
import type { PaddleMobileModel } from "./model-loader";

export type OcrProgressPhase = "loading-model" | "recognizing" | "done";

export interface OcrProgress {
  phase: OcrProgressPhase;
  angleIndex?: number;
  angleCount?: number;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

function mapResult(result: PaddleOcrResult): OcrResult {
  const cells: OcrCell[][] = result.lines.map((line) =>
    line.map((word) => ({
      text: word.text,
      confidence: word.confidence,
      box: {
        x: word.box.x,
        y: word.box.y,
        width: word.box.width,
        height: word.box.height
      }
    }))
  );

  return {
    text: result.text,
    confidence: result.confidence,
    cells
  };
}

const ANGLES = [0, 90, 180, 270];

/**
 * On-device PaddleOCR engine (PP-OCRv6-medium — the same model family used by
 * the Node benchmark engine) for React Native. Uses `ppu-paddle-ocr/mobile`
 * (onnxruntime-react-native) and the Skia-backed `ppu-ocv/canvas-mobile` for
 * orientation detection: the image is recognized in all four 90° rotations and
 * the highest-confidence pass is kept, matching the Node `PaddleOcrEngine`.
 *
 * Models are supplied as ArrayBuffers (bundled assets) so no network access is
 * required.
 */
export class PaddleMobileEngine implements OcrEngine {
  readonly name = "paddle-ocr";
  readonly version = "6.x-medium-mobile";

  private readonly loadModel: () => Promise<PaddleMobileModel>;
  private modelPromise: Promise<PaddleMobileModel> | null = null;
  private service: PaddleOcrService | null = null;

  constructor(loadModel: () => Promise<PaddleMobileModel>) {
    this.loadModel = loadModel;
  }

  private getModel(): Promise<PaddleMobileModel> {
    if (!this.modelPromise) {
      this.modelPromise = this.loadModel();
    }
    return this.modelPromise;
  }

  private async getService(
    onProgress?: (progress: OcrProgress) => void
  ): Promise<PaddleOcrService> {
    if (this.service) return this.service;

    onProgress?.({ phase: "loading-model" });
    const model = await this.getModel();
    const service = new PaddleOcrService({
      model: {
        detection: toArrayBuffer(model.detection),
        recognition: toArrayBuffer(model.recognition),
        charactersDictionary: toArrayBuffer(model.dictionary)
      },
      detection: { paddingHorizontal: 0.3 }
    });
    await service.initialize();
    this.service = service;
    return service;
  }

  async recognize(
    input: OcrInput,
    onProgress?: (progress: OcrProgress) => void
  ): Promise<OcrResult> {
    if (input.kind === "text") {
      return { text: input.text, confidence: 1 };
    }
    if (input.kind !== "image") {
      throw new Error(
        `PaddleMobileEngine does not support input kind "${input.kind}"`
      );
    }

    const service = await this.getService(onProgress);
    const platform = getPlatform();
    const base = await platform.loadImage(toArrayBuffer(input.data));

    let best: { confidence: number; result: PaddleOcrResult } | null = null;

    for (let index = 0; index < ANGLES.length; index++) {
      const angle = ANGLES[index];
      onProgress?.({
        phase: "recognizing",
        angleIndex: index,
        angleCount: ANGLES.length
      });

      const swap = angle % 180 !== 0;
      const w = swap ? base.height : base.width;
      const h = swap ? base.width : base.height;
      const rotated = platform.createCanvas(w, h);
      const ctx = rotated.getContext("2d");
      if (angle !== 0) {
        ctx.translate(w / 2, h / 2);
        ctx.rotate((angle * Math.PI) / 180);
      }
      ctx.drawImage(
        base,
        angle === 0 ? 0 : -base.width / 2,
        angle === 0 ? 0 : -base.height / 2
      );

      const result = (await service.recognize(rotated, {
        noCache: true,
        strategy: "per-box"
      })) as PaddleOcrResult;

      if (!best || result.confidence > best.confidence) {
        best = { confidence: result.confidence, result };
      }
    }

    if (!best) {
      throw new Error("PaddleMobileEngine produced no result");
    }

    onProgress?.({ phase: "done" });
    return mapResult(best.result);
  }

  async destroy(): Promise<void> {
    if (this.service) {
      await this.service.destroy();
      this.service = null;
    }
  }
}
