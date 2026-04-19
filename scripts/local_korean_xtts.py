from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


DEFAULT_MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Korean narration with XTTS-v2.")
    parser.add_argument("--text-file", required=True, help="UTF-8 text file path.")
    parser.add_argument("--output", required=True, help="Output wav path.")
    parser.add_argument("--reference", required=True, help="Reference speaker wav path.")
    parser.add_argument("--language", default="ko", help="Language code. Default: ko")
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    parser.add_argument("--model-name", default=DEFAULT_MODEL_NAME)
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


def main() -> int:
    args = parse_args()
    os.environ.setdefault("COQUI_TOS_AGREED", "1")
    os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")

    text = read_text(args.text_file)
    reference_path = Path(args.reference).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not reference_path.exists():
        raise SystemExit(f"Reference wav was not found: {reference_path}")

    try:
        from TTS.api import TTS  # type: ignore
    except ImportError as exc:
        raise SystemExit("Coqui TTS is not installed.") from exc

    device = resolve_device(args.device)
    patch_xtts_audio_loader()
    tts = TTS(model_name=args.model_name, gpu=device == "cuda")
    tts.tts_to_file(
        text=text,
        file_path=str(output_path),
        speaker_wav=[str(reference_path)],
        language=args.language,
        split_sentences=args.split_sentences,
    )
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
