import { promises as fs } from "node:fs";
import { synthesizeLocalKoreanXtts } from "./index.js";

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return "";
  }

  return process.argv[index + 1] || "";
}

async function main() {
  const textFile = getArg("--text-file");
  const output = getArg("--output");
  const reference = getArg("--reference");
  const device = (getArg("--device") || "cuda") as "cuda" | "cpu";

  if (!textFile || !output || !reference) {
    throw new Error("Usage: npm run synth -- --text-file <path> --output <wav> --reference <wav> [--device cuda|cpu]");
  }

  const text = await fs.readFile(textFile, "utf8");
  const outputPath = await synthesizeLocalKoreanXtts({
    text,
    outputPath: output,
    referencePath: reference,
    device,
  });

  console.log(outputPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

