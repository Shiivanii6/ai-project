$envPath = Join-Path $PSScriptRoot "backend\.env"
$examplePath = Join-Path $PSScriptRoot "backend\.env.example"

if (Test-Path $envPath) {
    Write-Host "backend\.env already exists."
    exit 0
}

Write-Host ""
Write-Host "  Full AI roadmaps need a Gemini API key."
Write-Host "  Get one free at: https://aistudio.google.com/apikey"
Write-Host ""
$key = Read-Host "Paste your GOOGLE_GENAI_API_KEY (or press Enter to skip)"

if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Host "Skipped. The app will use the basic local roadmap until you add backend\.env"
    exit 0
}

@(
    "# Gemini API key for full AI-generated roadmaps and topic notes",
    "GOOGLE_GENAI_API_KEY=$($key.Trim())"
) | Set-Content -Path $envPath -Encoding UTF8

Write-Host "Saved backend\.env — restart START.bat to use full AI."
