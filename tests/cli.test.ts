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
        "ref.wav",
        "--device",
        "cpu",
        "--speed",
        "1.13",
        "--max-line-length",
        "22",
        "--no-tail-cleanup",
      ]),
    ).toEqual({
      textFile: "input.txt",
      output: "out.wav",
      reference: "ref.wav",
      device: "cpu",
      speed: 1.13,
      maxLineLength: 22,
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
      reference: "ref.wav",
      device: "cuda",
      speed: 1,
      maxLineLength: undefined,
      cleanupTail: true,
    });
  });
});
