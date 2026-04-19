import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_SCRIPT = "scripts/local_korean_xtts.py";
const DEFAULT_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2";

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
  await fs.writeFile(textPath, normalizeKoreanOneTakeText(options.text), "utf8");

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

