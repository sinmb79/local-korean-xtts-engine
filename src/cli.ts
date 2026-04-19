import { promises as fs } from "node:fs";
import { synthesizeLocalKoreanXtts } from "./index.js";

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return "";
  }

  return process.argv[index + 1] || "";
}

function getArgs(name: string) {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
    }
  }

  return values;
}

export function parseCliArgs(argv: string[]) {
  const previousArgv = process.argv;
  try {
    process.argv = argv;
    const textFile = getArg("--text-file");
    const output = getArg("--output");
    const referencePaths = getArgs("--reference");
    const device = (getArg("--device") || "cuda") as "cuda" | "cpu";
    const speedRaw = getArg("--speed");
    const speed = speedRaw ? Number.parseFloat(speedRaw) : 1;
    const maxLineLengthRaw = getArg("--max-line-length");
    const maxLineLength = maxLineLengthRaw ? Number.parseInt(maxLineLengthRaw, 10) : undefined;
    const cleanupTail = !argv.includes("--no-tail-cleanup");

    return {
      textFile,
      output,
      referencePaths,
      device,
      speed: Number.isFinite(speed) ? speed : 1,
      maxLineLength: Number.isFinite(maxLineLength) ? maxLineLength : undefined,
      cleanupTail,
    };
  } finally {
    process.argv = previousArgv;
  }
}

async function main() {
  const { textFile, output, referencePaths, device, speed, maxLineLength, cleanupTail } = parseCliArgs(process.argv);

  if (!textFile || !output || referencePaths.length === 0) {
    throw new Error(
      "Usage: npm run synth -- --text-file <path> --output <wav> --reference <wav> [--reference <wav> ...] [--device cuda|cpu] [--speed 1.13] [--max-line-length 26] [--no-tail-cleanup]",
    );
  }

  const text = await fs.readFile(textFile, "utf8");
  const outputPath = await synthesizeLocalKoreanXtts({
    text,
    outputPath: output,
    referencePaths,
    device,
    speed,
    maxLineLength,
    cleanupTail,
  });

  console.log(outputPath);
}

const isDirectRun = process.argv[1]?.endsWith("cli.ts") || process.argv[1]?.endsWith("cli.js");

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
