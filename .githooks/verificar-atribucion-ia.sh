#!/bin/sh
# Rechaza trailers o marcas de atribucion de herramientas de IA en mensajes de commit.
# No toca la coautoria legitima de personas: solo detecta identidades de IA.
#   verificar-atribucion-ia.sh --mensaje <archivo>   (commit-msg)
#   verificar-atribucion-ia.sh --rango <a..b>        (pre-push y CI)
PATRON='^[[:space:]]*(co-authored-by|generated-by|assisted-by|made-with|created-with)[[:space:]]*:.*(claude|anthropic|chatgpt|openai|copilot|gemini|codex|codeium)|generated with .*(claude|anthropic)|noreply@anthropic\.com'
fallo=0

revisar() { # $1 = texto del mensaje, $2 = etiqueta
  hallazgos=$(printf '%s\n' "$1" | grep -v '^#' | grep -iE "$PATRON")
  if [ -n "$hallazgos" ]; then
    echo "ERROR: atribucion de IA no permitida en $2:" >&2
    printf '%s\n' "$hallazgos" | sed 's/^/    /' >&2
    fallo=1
  fi
}

case "$1" in
  --mensaje) revisar "$(cat "$2")" "el mensaje del commit" ;;
  --rango)
    for c in $(git rev-list $2); do # sin comillas: el rango puede ser "sha --not --remotes"
      revisar "$(git log -1 --format=%B "$c")" "el commit $(git log -1 --format='%h %s' "$c")"
    done ;;
  *) echo "Uso: $0 --mensaje <archivo> | --rango <a..b>" >&2; exit 2 ;;
esac

[ "$fallo" -eq 0 ] || { echo "Elimine esas lineas del mensaje (git commit --amend / rebase) antes de continuar." >&2; exit 1; }
