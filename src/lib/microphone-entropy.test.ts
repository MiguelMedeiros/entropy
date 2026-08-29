import { describe, expect, it } from "vitest";
import { audioLevel, createMicrophoneEntropyCollector } from "./microphone-entropy";

function collect(secondSample = 0.25) {
  const collector = createMicrophoneEntropyCollector(48_000, 4);
  collector.addChunk(new Float32Array([0, secondSample, -0.5, 0.75]), 10.25);
  collector.addChunk(new Float32Array([0.1, -0.2, 0.3, -0.4]), 20.5);
  return { collector, digest: collector.digest() };
}

describe("microphone entropy collector", () => {
  it("hashes quantized PCM chunks and timing deterministically", () => {
    const first = collect();
    const second = collect();

    expect(first.collector.chunkCount).toBe(2);
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.digest).toBe(second.digest);
  });

  it("changes the digest when a sampled amplitude changes", () => {
    expect(collect(0.25).digest).not.toBe(collect(0.5).digest);
  });

  it("rejects digital silence instead of deriving from timing alone", () => {
    const collector = createMicrophoneEntropyCollector(48_000, 4);
    collector.addChunk(new Float32Array(4), 10);
    expect(() => collector.digest()).toThrow(/No audio variation/);
  });

  it("calculates an RMS signal level", () => {
    expect(audioLevel(new Float32Array([1, -1, 1, -1]))).toBe(1);
    expect(audioLevel(new Float32Array(0))).toBe(0);
  });
});
