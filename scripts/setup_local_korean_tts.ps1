param(
  [string]$PythonPath = "",
  [string]$VenvDir = ".venv-local-korean-tts",
  [switch]$CpuOnly
)

$ErrorActionPreference = "Stop"

function Resolve-PythonPath {
  param([string]$Requested)

  if ($Requested -and (Test-Path $Requested)) {
    return (Resolve-Path $Requested).Path
  }

  $candidates = @(
    $env:LOCAL_KOREAN_TTS_PYTHON,
    "C:\Users\sinmb\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\python.exe",
    "C:\Users\sinmb\.local\bin\python3.11.exe"
  ) | Where-Object { $_ }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  throw "Python 3.11 path was not found. Pass -PythonPath or set LOCAL_KOREAN_TTS_PYTHON."
}

$resolvedPython = Resolve-PythonPath -Requested $PythonPath

Write-Host "Using Python: $resolvedPython"
uv venv $VenvDir --python $resolvedPython

$venvPython = Join-Path $VenvDir "Scripts\python.exe"
uv pip install --python $venvPython pip setuptools wheel

if ($CpuOnly) {
  uv pip install --python $venvPython torch torchvision torchaudio
}
else {
  uv pip install --python $venvPython torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
}

uv pip install --python $venvPython TTS==0.22.0 soundfile transformers==4.41.2

Write-Host ""
Write-Host "Runtime setup complete."
Write-Host "Python: $venvPython"
Write-Host "Next:"
Write-Host "  npm install"
Write-Host "  npm run synth -- --text-file .\\examples\\sample-script.ko.txt --output .\\out.wav --reference C:\\path\\to\\reference.wav"
