$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8765
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
Write-Host "SKH AgriCheck V1.0 Mobile" -ForegroundColor Green
Write-Host "Local server: http://127.0.0.1:$port/"
Write-Host "Keep this window open while using the app. Close it to stop the server."

$mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json; charset=utf-8'; '.webmanifest'='application/manifest+json; charset=utf-8'; '.png'='image/png'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.txt'='text/plain; charset=utf-8'
}
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }
    while (($line = $reader.ReadLine()) -ne '') { if ($null -eq $line) { break } }
    $parts = $requestLine.Split(' ')
    $method = $parts[0]; $rawPath = $parts[1]
    $pathOnly = $rawPath.Split('?')[0]
    $decoded = [Uri]::UnescapeDataString($pathOnly).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($decoded)) { $decoded = 'index.html' }
    $candidate = [IO.Path]::GetFullPath((Join-Path $root $decoded))
    if (-not $candidate.StartsWith([IO.Path]::GetFullPath($root))) { throw 'Forbidden path' }
    if (Test-Path $candidate -PathType Container) { $candidate = Join-Path $candidate 'index.html' }
    if (Test-Path $candidate -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($candidate)
      $ext = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
      $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $headers = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
      $hb = [Text.Encoding]::ASCII.GetBytes($headers); $stream.Write($hb,0,$hb.Length)
      if ($method -ne 'HEAD') { $stream.Write($bytes,0,$bytes.Length) }
    } else {
      $body = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $headers = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $hb=[Text.Encoding]::ASCII.GetBytes($headers);$stream.Write($hb,0,$hb.Length);$stream.Write($body,0,$body.Length)
    }
    $stream.Flush()
  } catch {
    try { $msg=[Text.Encoding]::UTF8.GetBytes('500 Server Error');$stream.Write($msg,0,$msg.Length) } catch {}
  } finally { $client.Close() }
}
