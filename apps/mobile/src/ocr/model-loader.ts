import { Asset } from "expo-asset";
import { File } from "expo-file-system";

export interface PaddleMobileModel {
  detection: Uint8Array;
  recognition: Uint8Array;
  dictionary: Uint8Array;
}

async function assetToBytes(moduleId: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const file = new File(uri);
  return file.bytes();
}

/**
 * Loads the bundled PaddleOCR v6-medium ONNX models and character dictionary
 * (the same model family used by the Node benchmark engine) from app assets.
 * Everything ships with the app, so OCR runs fully offline.
 */
export async function loadBundledPaddleModel(): Promise<PaddleMobileModel> {
  const [detection, recognition, dictionary] = await Promise.all([
    assetToBytes(require("../../assets/models/pp-ocrv6-medium-det.ort")),
    assetToBytes(require("../../assets/models/pp-ocrv6-medium-rec.ort")),
    assetToBytes(require("../../assets/models/pp-ocrv6-medium-dict.txt"))
  ]);

  return { detection, recognition, dictionary };
}
