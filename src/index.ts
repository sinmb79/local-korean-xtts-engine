import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_SCRIPT = "scripts/local_korean_xtts.py";
const DEFAULT_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2";
const DEFAULT_MAX_LINE_LENGTH = 26;
const CLAUSE_BREAK_SUFFIXES = [
  ",",
  "\uADF8\uB9AC\uACE0",
  "\uD558\uC9C0\uB9CC",
  "\uADF8\uB7F0\uB370",
  "\uADF8\uB798\uC11C",
  "\uB610\uD55C",
  "\uB2E4\uB9CC",
  "\uC774\uBA70",
  "\uC774\uACE0",
  "\uD558\uACE0",
  "\uC54A\uACE0",
  "\uD558\uBA74\uC11C",
  "\uB418\uBA70",
  "\uB54C\uBB38\uC5D0",
  "\uC704\uD574",
  "\uD1B5\uD574",
  "\uD1B5\uD55C",
  "\uC73C\uB85C",
  "\uB85C",
  "\uC5D0\uC11C",
  "\uAE4C\uC9C0",
  "\uBD80\uD130",
  "\uC785\uB2C8\uB2E4.",
  "\uB429\uB2C8\uB2E4.",
  "\uC788\uC2B5\uB2C8\uB2E4.",
  "\uC785\uB2C8\uB2E4",
  "\uB429\uB2C8\uB2E4",
  "\uC788\uC2B5\uB2C8\uB2E4",
] as const;

export interface SynthesizeOptions {
  text: string;
  outputPath: string;
  referencePath: string;
  pythonPath?: string;
  scriptPath?: string;
  language?: "ko" | "en";
  device?: "cuda" | "cpu";
  splitSentences?: boolean;
  modelName?: string;
  cleanupTail?: boolean;
  maxLineLength?: number;
}

export function normalizeKoreanOneTakeText(text: string) {
  const normalized = text
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([,.;!?])(?=\S)/g, "$1 ")
    .trim();

  if (!normalized) {
    return "";
  }

  const withTerminalPunctuation = /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
  return withTerminalPunctuation.replace(/\s+/g, " ").trim();
}

export function trimKoreanClauseBoundary(line: string) {
  return line.replace(/\s+/g, " ").replace(/\s+([,.;!?])/g, "$1").trim();
}

export function buildSpeechReadyKoreanText(
  text: string,
  options: {
    maxLineLength?: number;
  } = {},
) {
  const normalized = normalizeKoreanOneTakeText(text);
  if (!normalized) {
    return "";
  }

  const maxLineLength = Math.max(12, options.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH);
  const sentenceUnits = normalized.match(/[^.!?]+[.!?]?/g)?.map((value) => value.trim()).filter(Boolean) ?? [];
  const lines: string[] = [];

  for (const unit of sentenceUnits) {
    const tokens = unit.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      continue;
    }

    let buffer: string[] = [];
    for (const token of tokens) {
      buffer.push(token);
      if (buffer.join(" ").length <= maxLineLength || buffer.length === 1) {
        continue;
      }

      let splitIndex = findPreferredSplitIndex(buffer, buffer.length - 2);
      if (splitIndex < 0) {
        splitIndex = buffer.length - 2;
      }

      const line = trimKoreanClauseBoundary(buffer.slice(0, splitIndex + 1).join(" "));
      if (line) {
        lines.push(line);
      }
      buffer = buffer.slice(splitIndex + 1);
    }

    const tailLine = trimKoreanClauseBoundary(buffer.join(" "));
    if (tailLine) {
      lines.push(tailLine);
    }
  }

  return lines.join("\n");
}

export function buildTailCleanupFilter(durationSeconds: number, fadeDurationSeconds = 0.12) {
  const fadeStart = Math.max(0, Number((durationSeconds - fadeDurationSeconds).toFixed(2)));
  return `areverse,silenceremove=start_periods=1:start_duration=0.08:start_threshold=-38dB,areverse,afade=t=out:st=${fadeStart.toFixed(2)}:d=${fadeDurationSeconds.toFixed(2)}`;
}

export function buildXttsArgs(input: {
  textFile: string;
  outputPath: string;
  referencePath: string;
  scriptPath: string;
  language: "ko" | "en";
  device: "cuda" | "cpu";
  splitSentences: boolean;
  modelName: string;
}) {
  const args = [
    input.scriptPath,
    "--text-file",
    input.textFile,
    "--output",
    input.outputPath,
    "--reference",
    input.referencePath,
    "--language",
    input.language,
    "--device",
    input.device,
  ];

  if (input.modelName.trim()) {
    args.push("--model-name", input.modelName.trim());
  }

  args.push(input.splitSentences ? "--split-sentences" : "--no-split-sentences");
  return args;
}

export async function synthesizeLocalKoreanXtts(options: SynthesizeOptions) {
  const outputPath = path.resolve(options.outputPath);
  const referencePath = path.resolve(options.referencePath);
  const pythonPath = await resolveFirstExistingPath(
    options.pythonPath ? [options.pythonPath] : getPythonCandidates(),
  );
  const scriptPath = await resolveFirstExistingPath(
    options.scriptPath ? [options.scriptPath] : getScriptCandidates(),
  );

  if (!pythonPath) {
    throw new Error("Python runtime not found. Set LOCAL_KOREAN_TTS_PYTHON or install .venv-local-korean-tts.");
  }

  if (!scriptPath) {
    throw new Error("Python XTTS wrapper not found.");
  }

  await fs.access(referencePath);

  const tempDir = path.join(process.cwd(), ".tmp-local-korean-xtts");
  await fs.mkdir(tempDir, { recursive: true });
  const textPath = path.join(tempDir, "input.txt");
  await fs.writeFile(
    textPath,
    buildSpeechReadyKoreanText(options.text, {
      maxLineLength: options.maxLineLength,
    }),
    "utf8",
  );

  try {
    await execFileAsync(
      pythonPath,
      buildXttsArgs({
        textFile: textPath,
        outputPath,
        referencePath,
        scriptPath,
        language: options.language ?? "ko",
        device: options.device ?? "cuda",
        splitSentences: options.splitSentences ?? false,
        modelName: options.modelName ?? DEFAULT_MODEL,
      }),
      {
        env: {
          ...process.env,
          COQUI_TOS_AGREED: process.env.COQUI_TOS_AGREED || "1",
          TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD: process.env.TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD || "1",
        },
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 12,
      },
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  if (options.cleanupTail !== false) {
    await cleanupTailArtifacts(outputPath);
  }

  return outputPath;
}

export function getPythonCandidates() {
  return [
    process.env.LOCAL_KOREAN_TTS_PYTHON?.trim(),
    path.resolve(process.cwd(), ".venv-local-korean-tts/Scripts/python.exe"),
    "C:/Users/sinmb/AppData/Roaming/uv/python/cpython-3.11.15-windows-x86_64-none/python.exe",
    "C:/Users/sinmb/.local/bin/python3.11.exe",
  ].filter((value): value is string => Boolean(value));
}

export function getScriptCandidates() {
  return [
    process.env.LOCAL_KOREAN_TTS_SCRIPT?.trim(),
    path.resolve(process.cwd(), DEFAULT_SCRIPT),
  ].filter((value): value is string => Boolean(value));
}

function findPreferredSplitIndex(tokens: string[], maxIndex: number) {
  for (let index = maxIndex; index >= 0; index -= 1) {
    if (CLAUSE_BREAK_SUFFIXES.some((suffix) => tokens[index].endsWith(suffix))) {
      return index;
    }
  }

  return -1;
}

async function cleanupTailArtifacts(audioPath: string) {
  const durationSeconds = await probeDurationSeconds(audioPath);
  if (!durationSeconds || durationSeconds <= 0.2) {
    return;
  }

  const cleanedPath = path.join(
    path.dirname(audioPath),
    `${path.basename(audioPath, path.extname(audioPath))}.tail-clean${path.extname(audioPath) || ".wav"}`,
  );

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-v",
        "error",
        "-i",
        audioPath,
        "-af",
        buildTailCleanupFilter(durationSeconds),
        "-c:a",
        "pcm_s16le",
        cleanedPath,
      ],
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 8,
      },
    );
    await fs.rename(cleanedPath, audioPath);
  } catch {
    await fs.rm(cleanedPath, { force: true });
  }
}

async function probeDurationSeconds(audioPath: string) {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=nw=1:nk=1",
        audioPath,
      ],
      {
        windowsHide: true,
        maxBuffer: 1024 * 64,
      },
    );
    const parsed = Number.parseFloat(stdout.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

async function resolveFirstExistingPath(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      const resolved = path.resolve(candidate);
      await fs.access(resolved);
      return resolved;
    } catch {
      continue;
    }
  }

  return null;
}

