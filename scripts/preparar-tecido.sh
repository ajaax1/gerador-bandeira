#!/usr/bin/env bash
set -euo pipefail

FFMPEG="${FFMPEG:-ffmpeg}"
TECIDO="${1:-$(dirname "$0")/tecido-cinza-loop.mp4}"
DURACAO="${DURACAO:-8}"
SAIDA="${2:-$(dirname "$0")/../public/tecido-luz-${DURACAO}.mp4}"
LUZ="${LUZ:-2.4}"
SUAVE="${SUAVE:-18}"
ALTURA_FAIXA="${ALTURA_FAIXA:-366}"
FPS=24
QUADROS=$("$FFMPEG" -hide_banner -i "$TECIDO" -map 0:v -f null - 2>&1 | grep -o 'frame= *[0-9]*' | tail -1 | grep -o '[0-9]*')
REPETIR=$(( (DURACAO * FPS + QUADROS - 1) / QUADROS - 1 ))

"$FFMPEG" -v error -y -i "$TECIDO" -filter_complex "
[0:v]fps=${FPS},scale=1280:720,format=gray,split=2[g][g2];
[g2]gblur=sigma=60[base];
[g][base]blend=all_expr='clip(128+${LUZ}*(A-B),0,255)',crop=1280:${ALTURA_FAIXA}:0:(720-${ALTURA_FAIXA})/2,split=2[luz][luz2];
[luz2]gblur=sigma=${SUAVE}[suave];
[luz][suave]vstack,loop=loop=${REPETIR}:size=${QUADROS},format=yuv420p[v]
" -map "[v]" -an -t "$DURACAO" -r ${FPS} -c:v libx264 -crf 18 -preset slow -profile:v high -movflags +faststart "$SAIDA"
