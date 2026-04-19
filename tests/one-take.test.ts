import { describe, expect, it } from "vitest";
import {
  buildSpeedAdjustFilter,
  buildTailCleanupFilter,
  buildSpeechReadyKoreanText,
  buildXttsArgs,
  normalizeKoreanOneTakeText,
  trimKoreanClauseBoundary,
} from "../src/index.js";

describe("local korean xtts engine", () => {
  it("normalizes Korean one-take narration text", () => {
    expect(
      normalizeKoreanOneTakeText(
        "K-조선은\n세계가 다시 보는 산업입니다.   이제 경쟁력은 규모에서 끝나지 않고   친환경 연료와 탄소저감 기술로 옮겨가고 있습니다",
      ),
    ).toBe(
      "K-조선은 세계가 다시 보는 산업입니다. 이제 경쟁력은 규모에서 끝나지 않고 친환경 연료와 탄소저감 기술로 옮겨가고 있습니다.",
    );
  });

  it("builds the XTTS wrapper argument list", () => {
    expect(
      buildXttsArgs({
        textFile: "input.txt",
        outputPath: "output.wav",
        referencePaths: ["reference-a.wav", "reference-b.wav"],
        scriptPath: "scripts/local_korean_xtts.py",
        language: "ko",
        device: "cuda",
        splitSentences: false,
        modelName: "tts_models/multilingual/multi-dataset/xtts_v2",
      }),
    ).toEqual([
      "scripts/local_korean_xtts.py",
      "--text-file",
      "input.txt",
      "--output",
      "output.wav",
      "--language",
      "ko",
      "--device",
      "cuda",
      "--reference",
      "reference-a.wav",
      "--reference",
      "reference-b.wav",
      "--model-name",
      "tts_models/multilingual/multi-dataset/xtts_v2",
      "--no-split-sentences",
    ]);
  });

  it("keeps clause boundaries short enough for Korean narration", () => {
    expect(
      buildSpeechReadyKoreanText(
        "이제 경쟁력은 규모에서 끝나지 않고 친환경 연료와 탄소저감 기술로 옮겨가고 있습니다.",
        { maxLineLength: 26 },
      ),
    ).toBe(
      [
        "이제 경쟁력은 규모에서 끝나지 않고",
        "친환경 연료와 탄소저감 기술로",
        "옮겨가고 있습니다.",
      ].join("\n"),
    );
  });

  it("trims punctuation artifacts around clause breaks", () => {
    expect(trimKoreanClauseBoundary("세계가 다시 보는 이유는,")).toBe("세계가 다시 보는 이유는,");
    expect(trimKoreanClauseBoundary("친환경 연료와")).toBe("친환경 연료와");
  });

  it("builds a deterministic tail cleanup filter", () => {
    expect(buildTailCleanupFilter(12.4)).toBe(
      "areverse,silenceremove=start_periods=1:start_duration=0.08:start_threshold=-38dB,areverse,afade=t=out:st=12.28:d=0.12",
    );
  });

  it("builds a speed-adjust filter for shorts narration pacing", () => {
    expect(buildSpeedAdjustFilter(1.13)).toBe("atempo=1.13");
    expect(buildSpeedAdjustFilter(1)).toBe("");
  });
});
