import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export const CAMERA_FRAME_WIDTH = 64;
export const CAMERA_FRAME_HEIGHT = 48;
export const CAMERA_FRAME_COUNT = 24;
export const CAMERA_FRAME_INTERVAL_MS = 100;

const CAMERA_CAPTURE_DOMAIN = "entropy-workbench:camera-capture:v1";

/**
 * Incrementally hashes camera pixels so raw frames never need to be retained.
 * Timing is mixed into the transcript, but is not treated as a measurable
 * entropy guarantee.
 */
export function createCameraEntropyCollector(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Camera frame dimensions must be positive integers.");
  }

  const expectedBytes = width * height * 4;
  const hasher = sha256.create();
  hasher.update(utf8ToBytes(`${CAMERA_CAPTURE_DOMAIN}|${width}x${height}|rgba|`));
  let frameCount = 0;
  let finalized = false;

  return {
    addFrame(pixels: Uint8ClampedArray, monotonicTime: number) {
      if (finalized) throw new Error("Camera entropy collector is already finalized.");
      if (pixels.byteLength !== expectedBytes) {
        throw new Error(`Expected ${expectedBytes} RGBA bytes, received ${pixels.byteLength}.`);
      }
      if (!Number.isFinite(monotonicTime)) {
        throw new Error("Camera frame timing must be finite.");
      }

      const metadata = new ArrayBuffer(12);
      const view = new DataView(metadata);
      view.setUint32(0, frameCount, false);
      view.setFloat64(4, monotonicTime, false);
      hasher.update(new Uint8Array(metadata));
      hasher.update(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength));
      frameCount += 1;
    },

    digest() {
      if (finalized) throw new Error("Camera entropy collector is already finalized.");
      if (frameCount === 0) throw new Error("Capture at least one camera frame.");
      finalized = true;
      const footer = new Uint8Array(4);
      new DataView(footer.buffer).setUint32(0, frameCount, false);
      hasher.update(footer);
      return bytesToHex(hasher.digest());
    },

    get frameCount() {
      return frameCount;
    },
  };
}
