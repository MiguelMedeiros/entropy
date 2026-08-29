import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export const MICROPHONE_CHUNK_SAMPLES = 2048;
export const MICROPHONE_CHUNK_COUNT = 32;
export const MICROPHONE_CHUNK_INTERVAL_MS = 100;

const MICROPHONE_CAPTURE_DOMAIN = "entropy-workbench:microphone-capture:v1";

export function audioLevel(samples: Float32Array) {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (const sample of samples) sumSquares += sample * sample;
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Quantizes Web Audio samples to signed 16-bit PCM and hashes each chunk
 * immediately. The PCM transcript never needs to be retained or encoded as a
 * recording. Timing is mixed in, but is not treated as measurable entropy.
 */
export function createMicrophoneEntropyCollector(sampleRate: number, samplesPerChunk: number) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Microphone sample rate must be positive.");
  }
  if (!Number.isInteger(samplesPerChunk) || samplesPerChunk <= 0) {
    throw new Error("Microphone chunk size must be a positive integer.");
  }

  const hasher = sha256.create();
  hasher.update(utf8ToBytes(`${MICROPHONE_CAPTURE_DOMAIN}|${sampleRate}|${samplesPerChunk}|pcm-s16be|`));
  let chunkCount = 0;
  let finalized = false;
  let firstQuantizedSample: number | null = null;
  let hasSignalVariation = false;

  return {
    addChunk(samples: Float32Array, monotonicTime: number) {
      if (finalized) throw new Error("Microphone entropy collector is already finalized.");
      if (samples.length !== samplesPerChunk) {
        throw new Error(`Expected ${samplesPerChunk} audio samples, received ${samples.length}.`);
      }
      if (!Number.isFinite(monotonicTime)) {
        throw new Error("Microphone chunk timing must be finite.");
      }

      const metadata = new ArrayBuffer(12);
      const metadataView = new DataView(metadata);
      metadataView.setUint32(0, chunkCount, false);
      metadataView.setFloat64(4, monotonicTime, false);
      hasher.update(new Uint8Array(metadata));

      const pcm = new Uint8Array(samples.length * 2);
      const pcmView = new DataView(pcm.buffer);
      for (let index = 0; index < samples.length; index += 1) {
        const clamped = Math.max(-1, Math.min(1, samples[index]));
        const quantized = Math.round(clamped * (clamped < 0 ? 32768 : 32767));
        pcmView.setInt16(index * 2, quantized, false);
        if (firstQuantizedSample === null) firstQuantizedSample = quantized;
        else if (quantized !== firstQuantizedSample) hasSignalVariation = true;
      }
      hasher.update(pcm);
      pcm.fill(0);
      chunkCount += 1;
    },

    digest() {
      if (finalized) throw new Error("Microphone entropy collector is already finalized.");
      if (chunkCount === 0) throw new Error("Capture at least one microphone chunk.");
      if (!hasSignalVariation) throw new Error("No audio variation was detected. Make a sound and capture again.");
      finalized = true;
      const footer = new Uint8Array(4);
      new DataView(footer.buffer).setUint32(0, chunkCount, false);
      hasher.update(footer);
      return bytesToHex(hasher.digest());
    },

    get chunkCount() {
      return chunkCount;
    },
  };
}
