# ==========================================================================
# csp.ps1 — met à jour la Content-Security-Policy (balise <meta>) des pages
# GitHub Pages ne permet pas d'envoyer d'en-têtes HTTP : la politique est donc écrite
# dans chaque page. Les scripts inline (classes du <head>, importmap) sont autorisés par
# leur empreinte SHA-256 : À RELANCER APRÈS TOUTE MODIFICATION D'UN SCRIPT INLINE,
# sinon le navigateur le bloque (la page reste lisible, mais sans animations).
# Utilisation : pwsh outils/csp.ps1
# ==========================================================================
$racine = Split-Path $PSScriptRoot

# Règles communes : tout vient du site lui-même, sauf les librairies servies par jsDelivr
$commun = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'; worker-src 'self' blob:"

# Règles propres à chaque page
$pages = [ordered]@{
  # Three.js (espace 3D) ; EmailJS (formulaire) envoie le message à api.emailjs.com
  'index.html' = @{ script = "https://cdn.jsdelivr.net"; connect = "'self' https://api.emailjs.com" }
  # Three.js + décodeur Meshopt du modèle GLB (WebAssembly) ; textures du modèle en blob:
  'e39.html'   = @{ script = "https://cdn.jsdelivr.net 'wasm-unsafe-eval'"; connect = "'self' blob: data:" }
  'cv.html'    = @{ script = "https://cdn.jsdelivr.net"; connect = "'self'" }
}

$sha = [Security.Cryptography.SHA256]::Create()
foreach ($nom in $pages.Keys) {
  $chemin = Join-Path $racine $nom
  $html = [IO.File]::ReadAllText($chemin)
  $empreintes = @()
  foreach ($m in [regex]::Matches($html, '<script(?<attrs>[^>]*)>(?<code>[\s\S]*?)</script>')) {
    $attrs = $m.Groups['attrs'].Value
    if ($attrs -match '\bsrc=' -or $attrs -match 'application/ld\+json') { continue }
    # Le navigateur calcule l'empreinte sur le texte après lecture du HTML (fins de ligne en LF)
    $code = $m.Groups['code'].Value -replace "`r`n", "`n" -replace "`r", "`n"
    $empreintes += "'sha256-" + [Convert]::ToBase64String($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($code))) + "'"
  }
  $p = $pages[$nom]
  $politique = "$commun; script-src 'self' $($p.script) $($empreintes -join ' '); connect-src $($p.connect)"
  $balise = '<meta http-equiv="Content-Security-Policy" content="' + $politique + '" />'
  if ($html -match '<meta http-equiv="Content-Security-Policy"[^>]*/>') {
    $html = [regex]::Replace($html, '<meta http-equiv="Content-Security-Policy"[^>]*/>', [Text.RegularExpressions.MatchEvaluator] { param($x) $balise })
  } else {
    # Juste après la balise viewport : avant tout script de la page (même fin de ligne que le fichier)
    $fin = if ($html.Contains("`r`n")) { "`r`n" } else { "`n" }
    $html = ([regex]'<meta name="viewport"[^>]*/>').Replace($html, [Text.RegularExpressions.MatchEvaluator] { param($x) $x.Value + $fin + '  ' + $balise }, 1)
  }
  [IO.File]::WriteAllText($chemin, $html, [Text.UTF8Encoding]::new($false))
  "{0} : {1} script(s) inline autorisé(s)" -f $nom, $empreintes.Count
}
