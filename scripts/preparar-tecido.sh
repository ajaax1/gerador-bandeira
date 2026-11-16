#!/usr/bin/env bash
set -euo pipefail

FFMPEG="${FFMPEG:-ffmpeg}"
TECIDO="${1:-$(dirname "$0")/tecido-cinza.mp4}"
SAIDA="${2:-$(dirname "$0")/../public/tecido-luz.mp4}"
LUZ="${LUZ:-2.4}"
SUAVE="${SUAVE:-18}"
ALTURA_FAIXA="${ALTURA_FAIXA:-366}"

"$FFMPEG" -v error -y -i "$TECIDO" -filter_complex "
[0:v]scale=1280:720,format=gray,split=2[g][g2];
[g2]gblur=sigma=60[base];
[g][base]blend=all_expr='clip(128+${LUZ}*(A-B),0,255)',crop=1280:${ALTURA_FAIXA}:0:(720-${ALTURA_FAIXA})/2,split=2[luz][luz2];
[luz2]gblur=sigma=${SUAVE}[suave];
[luz][suave]vstack,split=2[ida][volta0];
[volta0]reverse[volta];
[ida][volta]concat=n=2:v=1,format=yuv420p[v]
" -map "[v]" -an -t 20 -r 24 -c:v libx264 -crf 14 -preset slow -profile:v high -movflags +faststart "$SAIDA"
