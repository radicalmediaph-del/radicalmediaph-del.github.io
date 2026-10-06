# RadicalMediaPh - local web server using only built-in Windows PowerShell.
# No Python, Node or any other install required.
#
#   powershell -ExecutionPolicy Bypass -File start-server.ps1
#   powershell -ExecutionPolicy Bypass -File start-server.ps1 -Port 8080

param([int]$Port = 8000)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".txt"  = "text/plain; charset=utf-8"
    ".md"   = "text/plain; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png"  = "image/png"
    ".gif"  = "image/gif"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
}
catch {
    Write-Host ""
    Write-Host "  Could not start the server on port $Port." -ForegroundColor Red
    Write-Host "  Something else may already be using it. Try a different port:"
    Write-Host "    start-server.bat 8080"
    Write-Host ""
    exit 1
}

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  RadicalMediaPh is running at $url" -ForegroundColor Green
Write-Host "  Serving files from: $root"
Write-Host "  Close this window (or press Ctrl+C) to stop."
Write-Host ""

Start-Process $url | Out-Null

while ($listener.IsListening) {
    try {
        $context  = $listener.GetContext()
        $request  = $context.Request
        $response = $context.Response

        $rel = [System.Uri]::UnescapeDataString($request.Url.LocalPath)
        if ($rel -eq "/" -or $rel -eq "") { $rel = "/index.html" }
        $rel = $rel.TrimStart("/").Replace("/", "\")

        $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))

        # never serve anything outside this folder
        if (-not $path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
            $path = Join-Path $root "404.html"
            $response.StatusCode = 403
        }

        if (Test-Path -LiteralPath $path -PathType Container) {
            $path = Join-Path $path "index.html"
        }

        if (Test-Path -LiteralPath $path -PathType Leaf) {
            if ($response.StatusCode -ne 403) { $response.StatusCode = 200 }
        }
        else {
            $response.StatusCode = 404
            $path = Join-Path $root "404.html"
        }

        $ext  = [System.IO.Path]::GetExtension($path).ToLower()
        $type = $mime[$ext]
        if (-not $type) { $type = "application/octet-stream" }

        $bytes = [System.IO.File]::ReadAllBytes($path)
        $response.ContentType = $type
        $response.ContentLength64 = $bytes.Length
        $response.AddHeader("Cache-Control", "no-store")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.OutputStream.Close()

        Write-Host ("  {0} {1} {2}" -f $response.StatusCode, $request.HttpMethod, $request.Url.LocalPath)
    }
    catch {
        # a browser hanging up mid-request should never kill the server
        try { $context.Response.Close() } catch { }
    }
}

$listener.Stop()
