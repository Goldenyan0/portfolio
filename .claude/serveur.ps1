# Serveur statique local (développement) : sert le dossier du portfolio sur http://localhost:8000
# Utile quand Python n'est pas installé. Écoute uniquement en local.
param([int]$Port = 8000)
# Le lanceur de prévisualisation peut imposer un autre port via la variable PORT
if ($env:PORT) { $Port = [int]$env:PORT }

$racine = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'; '.avif' = 'image/avif'; '.gif' = 'image/gif'; '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2'
  '.woff' = 'font/woff'; '.glb' = 'model/gltf-binary'; '.pdf' = 'application/pdf'; '.txt' = 'text/plain; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'; '.xml' = 'application/xml'
}

$ecoute = [System.Net.HttpListener]::new()
$ecoute.Prefixes.Add("http://localhost:$Port/")
$ecoute.Start()
Write-Host "Portfolio servi sur http://localhost:$Port/"

while ($ecoute.IsListening) {
  $ctx = $ecoute.GetContext()
  $rep = $ctx.Response
  try {
    $chemin = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($chemin -eq '' -or $chemin.EndsWith('/')) { $chemin += 'index.html' }
    $complet = [IO.Path]::GetFullPath((Join-Path $racine $chemin))
    # Sécurité : jamais de fichier en dehors du dossier du site
    if (-not $complet.StartsWith($racine, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $complet -PathType Leaf)) {
      $rep.StatusCode = 404
      $octets = [Text.Encoding]::UTF8.GetBytes('404')
    } else {
      $ext = [IO.Path]::GetExtension($complet).ToLower()
      $rep.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $rep.Headers.Add('Cache-Control', 'no-cache')
      $octets = [IO.File]::ReadAllBytes($complet)
    }
    $rep.ContentLength64 = $octets.Length
    $rep.OutputStream.Write($octets, 0, $octets.Length)
    Write-Host "$($rep.StatusCode) /$chemin"
  } catch {
    Write-Host "Erreur : $_"
  } finally {
    $rep.Close()
  }
}
