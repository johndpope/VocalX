param(
  [Parameter(Mandatory=$false)][string]$WorkerUrl = $env:WORKER_URL,
  [Parameter(Mandatory=$false)][string]$ApiKey = $env:WORKER_API_KEY,
  [Parameter(Mandatory=$false)][int]$MaxTimeSeconds = 600,
  [Parameter(Mandatory=$false)][switch]$Trace
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($WorkerUrl)) {
  throw 'WorkerUrl is required (pass -WorkerUrl or set WORKER_URL)'
}

$diagDir = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force -Path $diagDir | Out-Null

$wavPath = Join-Path $diagDir 'test_silence_250ms_16k.wav'
$hdrPath = Join-Path $diagDir 'resp_headers.txt'
$bodyPath = Join-Path $diagDir 'resp_body.bin'
$tracePath = Join-Path $diagDir 'curl_trace.txt'

function Write-WavSilence16kMono16bit([string]$Path, [int]$DurationMs) {
  $sampleRate = 16000
  $channels = 1
  $bitsPerSample = 16
  $bytesPerSample = $bitsPerSample / 8
  $numSamples = [int]([math]::Floor($sampleRate * ($DurationMs / 1000.0)))
  $dataSize = $numSamples * $channels * $bytesPerSample

  $byteRate = $sampleRate * $channels * $bytesPerSample
  $blockAlign = $channels * $bytesPerSample

  $riffSize = 36 + $dataSize

  $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $bw = New-Object System.IO.BinaryWriter($fs)

    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('RIFF'))
    $bw.Write([int]$riffSize)
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('WAVE'))

    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('fmt '))
    $bw.Write([int]16)                # PCM fmt chunk size
    $bw.Write([int16]1)               # AudioFormat = PCM
    $bw.Write([int16]$channels)
    $bw.Write([int]$sampleRate)
    $bw.Write([int]$byteRate)
    $bw.Write([int16]$blockAlign)
    $bw.Write([int16]$bitsPerSample)

    $bw.Write([System.Text.Encoding]::ASCII.GetBytes('data'))
    $bw.Write([int]$dataSize)

    # silence
    $zero = New-Object byte[] 8192
    $remaining = $dataSize
    while ($remaining -gt 0) {
      $n = [math]::Min($zero.Length, $remaining)
      $bw.Write($zero, 0, $n)
      $remaining -= $n
    }

    $bw.Flush()
  } finally {
    $fs.Dispose()
  }
}

Write-WavSilence16kMono16bit -Path $wavPath -DurationMs 250

Remove-Item -Force -ErrorAction SilentlyContinue $hdrPath, $bodyPath
if ($Trace) {
  Remove-Item -Force -ErrorAction SilentlyContinue $tracePath
}

$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
if (!(Test-Path $curl)) {
  throw "curl.exe not found at $curl"
}

$endpoint = ($WorkerUrl.TrimEnd('/') + '/sam_audio/separate')

Write-Host "WorkerUrl: $WorkerUrl"
Write-Host "Endpoint:  $endpoint"
Write-Host "WAV:       $wavPath"
Write-Host "Out dir:   $diagDir"

$args = @(
  '-sS',
  '--http1.1',
  '-D', $hdrPath,
  '-o', $bodyPath,
  '--connect-timeout', '20',
  '--max-time', "$MaxTimeSeconds",
  '-w', "`nCURL_HTTP=%{http_code} time_total=%{time_total} size_download=%{size_download}`n"
)

if ($Trace) {
  $args += @('--trace-time', '--trace-ascii', $tracePath)
}

if (![string]::IsNullOrWhiteSpace($ApiKey)) {
  $args += @('-H', "Authorization: Bearer $ApiKey")
  $args += @('-H', "x-api-key: $ApiKey")
  Write-Host "Auth:      sending Authorization + x-api-key"
} else {
  Write-Host "Auth:      none"
}

$args += @(
  '-X', 'POST',
  '-F', "audio=@$wavPath;type=audio/wav",
  '-F', 'description=speech',
  $endpoint
)

Write-Host "Running:   curl.exe (max ${MaxTimeSeconds}s)"
& $curl @args

Write-Host "--- Response headers (first 80 lines) ---"
if (Test-Path $hdrPath) {
  Get-Content $hdrPath | Select-Object -First 80 | ForEach-Object { Write-Host $_ }
} else {
  Write-Host "(no headers file written)"
}

$bodyLen = 0
if (Test-Path $bodyPath) { $bodyLen = (Get-Item $bodyPath).Length }
Write-Host "--- Body length ---"
Write-Host $bodyLen

# Try to interpret body as text for debugging (first 4KB)
if ($bodyLen -gt 0) {
  Write-Host "--- Body preview (best-effort) ---"
  $bytes = [System.IO.File]::ReadAllBytes($bodyPath)
  $previewLen = [math]::Min(4096, $bytes.Length)
  $preview = New-Object byte[] $previewLen
  [Array]::Copy($bytes, 0, $preview, 0, $previewLen)
  $text = [System.Text.Encoding]::UTF8.GetString($preview)
  Write-Host $text
}
