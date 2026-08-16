import { Asset } from "expo-asset";
import { File } from "expo-file-system";

export interface PaddleMobileModel {
  detection: Uint8Array;
  recognition: Uint8Array;
  dictionary: Uint8Array;
}

async function assetToBytes(moduleId: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(moduleId);
  console.log("[OCRDEBUG] model-loader: asset", asset.name, "uri=", asset.uri, "localUri=", asset.localUri);
  await asset.downloadAsync();
  console.log("[OCRDEBUG] model-loader: after download localUri=", asset.localUri);
  const uri = asset.localUri ?? asset.uri;
  const file = new File(uri);
  console.log("[OCRDEBUG] model-loader: reading file.bytes uri=", uri);
  let bytes: Uint8Array;
  try {
    bytes = await file.bytes();
  } catch (e) {
    throw new Error(
      "[MODELREAD] " + (e instanceof Error ? e.message : String(e))
    );
  }
  console.log("[OCRDEBUG] model-loader: bytes OK len=", bytes.byteLength);
  return bytes;
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
