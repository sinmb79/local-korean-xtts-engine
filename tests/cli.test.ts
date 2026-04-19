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
        "--max-line-length",
        "22",
        "--no-tail-cleanup",
      ]),
    ).toEqual({
      textFile: "input.txt",
      output: "out.wav",
      reference: "ref.wav",
      device: "cpu",
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
      maxLineLength: undefined,
      cleanupTail: true,
    });
  });
});
