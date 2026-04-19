from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path


DEFAULT_MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Korean narration with XTTS-v2.")
    parser.add_argument("--text-file", required=True, help="UTF-8 text file path.")
    parser.add_argument("--output", required=True, help="Output wav path.")
    parser.add_argument(
        "--reference",
        dest="references",
        action="append",
        required=True,
        help="Reference speaker wav path. Repeat this flag to pass multiple references.",
    )
    parser.add_argument("--language", default="ko", help="Language code. Default: ko")
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    parser.add_argument("--model-name", default=DEFAULT_MODEL_NAME)
    parser.add_argument("--target-peak", type=float)
    parser.add_argument("--target-rms", type=float)
    parser.add_argument("--split-sentences", dest="split_sentences", action="store_true")
    parser.add_argument("--no-split-sentences", dest="split_sentences", action="store_false")
    parser.set_defaults(split_sentences=False)
    return parser.parse_args()


def read_text(path_value: str) -> str:
    text = Path(path_value).read_text(encoding="utf-8-sig").strip()
    if not text:
        raise SystemExit("Input text is empty.")
    return text


def resolve_device(requested_device: str) -> str:
    if requested_device != "cuda":
        return "cpu"

    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass

    print("CUDA was requested but is unavailable. Falling back to CPU.", file=sys.stderr)
    return "cpu"


def normalize_waveform(wav, *, target_peak: float | None, target_rms: float | None):
    wav = wav - wav.mean(dim=-1, keepdim=True)
    peak = wav.abs().max().item()
    if target_peak is not None and peak > 0:
        wav = wav / peak * float(target_peak)

    if target_rms is not None:
        rms = wav.pow(2).mean().sqrt().item()
        if rms > 0:
            gain = min(1.6, float(target_rms) / max(rms, 1e-6))
            wav = wav * gain

    return wav.clamp_(-0.98, 0.98)


def patch_xtts_audio_loader() -> None:
    import numpy as np  # type: ignore
    import soundfile as sf  # type: ignore
    import torch  # type: ignore
    import torchaudio  # type: ignore
    import TTS.tts.models.xtts as xtts_module  # type: ignore

    def safe_load_audio(audiopath: str, sampling_rate: int):
        audio, loaded_rate = sf.read(audiopath, always_2d=False, dtype="float32")

        if isinstance(audio, np.ndarray) and audio.ndim == 2:
            audio = np.mean(audio, axis=1)

        audio_tensor = torch.from_numpy(np.asarray(audio, dtype=np.float32))
        if audio_tensor.ndim == 1:
            audio_tensor = audio_tensor.unsqueeze(0)

        if loaded_rate != sampling_rate:
            audio_tensor = torchaudio.functional.resample(audio_tensor, loaded_rate, sampling_rate)

        return audio_tensor.clamp_(-1, 1)

    xtts_module.load_audio = safe_load_audio


def prepare_reference_clips(args, reference_paths: list[Path], temp_dir: Path) -> list[str]:
    needs_processing = args.target_peak is not None or args.target_rms is not None
    if not needs_processing:
        return [str(reference_path) for reference_path in reference_paths]

    import numpy as np  # type: ignore
    import soundfile as sf  # type: ignore
    import torch  # type: ignore

    prepared_paths: list[str] = []

    for index, reference_path in enumerate(reference_paths, start=1):
        audio, sr = sf.read(str(reference_path), always_2d=False, dtype="float32")
        if isinstance(audio, np.ndarray) and audio.ndim == 2:
            audio = np.mean(audio, axis=1)

        wav = torch.from_numpy(np.asarray(audio, dtype=np.float32))
        if wav.ndim == 1:
            wav = wav.unsqueeze(0)

        wav = normalize_waveform(
            wav,
            target_peak=args.target_peak,
            target_rms=args.target_rms,
        )

        prepared_path = temp_dir / f"reference-{index}.wav"
        sf.write(str(prepared_path), wav.squeeze(0).cpu().numpy(), sr)
        prepared_paths.append(str(prepared_path))

    return prepared_paths


def main() -> int:
    args = parse_args()
    os.environ.setdefault("COQUI_TOS_AGREED", "1")
    os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")

    text = read_text(args.text_file)
    reference_paths = [Path(value).expanduser().resolve() for value in args.references]
    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    for reference_path in reference_paths:
        if not reference_path.exists():
            raise SystemExit(f"Reference wav was not found: {reference_path}")

    try:
        from TTS.api import TTS  # type: ignore
    except ImportError as exc:
        raise SystemExit("Coqui TTS is not installed.") from exc

    device = resolve_device(args.device)
    patch_xtts_audio_loader()
    with tempfile.TemporaryDirectory(prefix="xtts-ref-") as temp_dir:
        prepared_reference_paths = prepare_reference_clips(args, reference_paths, Path(temp_dir))
        tts = TTS(model_name=args.model_name, gpu=device == "cuda")
        tts.tts_to_file(
            text=text,
            file_path=str(output_path),
            speaker_wav=prepared_reference_paths,
            language=args.language,
            split_sentences=args.split_sentences,
        )
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
