import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli.js";

describe("local korean xtts cli", () => {
  it("parses explicit synthesis options", () => {
    expect(
      parseCliArgs([
        "node",
        "cli",
        "--text-file",
        "input.txt",
        "--output",
        "out.wav",
        "--reference",
        "ref-a.wav",
        "--reference",
        "ref-b.wav",
        "--device",
        "cpu",
        "--speed",
        "1.13",
        "--max-line-length",
        "22",
        "--target-peak",
        "0.92",
        "--target-rms",
        "0.12",
        "--post-preset",
        "issue-shorts-dad",
        "--no-tail-cleanup",
      ]),
    ).toEqual({
      textFile: "input.txt",
      output: "out.wav",
      referencePaths: ["ref-a.wav", "ref-b.wav"],
      device: "cpu",
      speed: 1.13,
      maxLineLength: 22,
      targetPeak: 0.92,
      targetRms: 0.12,
      postPreset: "issue-shorts-dad",
      cleanupTail: false,
    });
  });

  it("falls back to the default CLI values", () => {
    expect(
      parseCliArgs([
        "node",
        "cli",
        "--text-file",
        "input.txt",
        "--output",
        "out.wav",
        "--reference",
        "ref.wav",
      ]),
    ).toEqual({
      textFile: "input.txt",
      output: "out.wav",
      referencePaths: ["ref.wav"],
      device: "cuda",
      speed: 1,
      maxLineLength: undefined,
      targetPeak: undefined,
      targetRms: undefined,
      postPreset: "none",
      cleanupTail: true,
    });
  });
});
