import { describe, expect, it } from "vitest";
import { createCameraEntropyCollector } from "./camera-entropy";

function collect(secondPixel = 2) {
  const collector = createCameraEntropyCollector(2, 1);
  collector.addFrame(new Uint8ClampedArray([1, secondPixel, 3, 255, 4, 5, 6, 255]), 10.25);
  collector.addFrame(new Uint8ClampedArray([7, 8, 9, 255, 10, 11, 12, 255]), 20.5);
  return { collector, digest: collector.digest() };
}

describe("camera entropy collector", () => {
  it("hashes frames and timing deterministically without retaining a transcript", () => {
    const first = collect();
    const second = collect();

    expect(first.collector.frameCount).toBe(2);
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.digest).toBe(second.digest);
  });

  it("changes the digest when a sampled pixel changes", () => {
    expect(collect(2).digest).not.toBe(collect(3).digest);
  });

  it("rejects invalid frames and repeated finalization", () => {
    const collector = createCameraEntropyCollector(1, 1);
    expect(() => collector.addFrame(new Uint8ClampedArray(3), 1)).toThrow(/Expected 4 RGBA bytes/);
    collector.addFrame(new Uint8ClampedArray(4), 1);
    expect(collector.digest()).toMatch(/^[0-9a-f]{64}$/);
    expect(() => collector.digest()).toThrow(/already finalized/);
  });
});
