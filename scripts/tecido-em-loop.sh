#!/usr/bin/env bash
set -euo pipefail

FFMPEG="${FFMPEG:-ffmpeg}"
TECIDO="${1:-$(dirname "$0")/tecido-cinza.mp4}"
SAIDA="${2:-$(dirname "$0")/tecido-cinza-loop.mp4}"
LOOP="${LOOP:-8}"
MISTURA="${MISTURA:-2}"
FPS=24
QL=$((LOOP * FPS))
QM=$((MISTURA * FPS))

"$FFMPEG" -v error -y -i "$TECIDO" -filter_complex "
[0:v]fps=${FPS},scale=1280:720,format=gray,split=3[s1][s2][s3];
[s1]trim=start_frame=${QL}:end_frame=$((QL + QM)),setpts=PTS-STARTPTS[fim];
[s2]trim=end_frame=${QM},setpts=PTS-STARTPTS[inicio];
[fim][inicio]blend=all_expr='A*(1-N/$((QM - 1)))+B*(N/$((QM - 1)))'[mistura];
[s3]trim=start_frame=${QM}:end_frame=${QL},setpts=PTS-STARTPTS[meio];
[mistura][meio]concat=n=2:v=1,format=yuv420p[v]
" -map "[v]" -an -c:v libx264 -crf 16 -preset slow -movflags +faststart "$SAIDA"
