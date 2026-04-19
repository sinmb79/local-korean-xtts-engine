import { describe, expect, it } from "vitest";
import { buildXttsArgs, normalizeKoreanOneTakeText } from "../src/index.js";

describe("local korean xtts engine", () => {
  it("normalizes Korean one-take narration text", () => {
    expect(
      normalizeKoreanOneTakeText("K-조선은\n세계가 다시 보는 산업입니다.  이제 경쟁력은 규모에서 끝나지 않고   친환경 연료와 탄소저감 기술로 옮겨가고 있습니다"),
    ).toBe(
      "K-조선은 세계가 다시 보는 산업입니다. 이제 경쟁력은 규모에서 끝나지 않고 친환경 연료와 탄소저감 기술로 옮겨가고 있습니다.",
    );
  });

  it("builds the XTTS wrapper argument list", () => {
    expect(
      buildXttsArgs({
        textFile: "input.txt",
        outputPath: "output.wav",
        referencePath: "reference.wav",
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
      "--reference",
      "reference.wav",
      "--language",
      "ko",
      "--device",
      "cuda",
      "--model-name",
      "tts_models/multilingual/multi-dataset/xtts_v2",
      "--no-split-sentences",
    ]);
  });
});

