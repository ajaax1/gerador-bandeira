#!/usr/bin/env bash
set -euo pipefail

FFMPEG="${FFMPEG:?defina FFMPEG}"
TECIDO="$1"
ARTE="$2"
SAIDA="$3"
LUZ="${LUZ:-2.4}"
DESLOC_X="${DESLOC_X:-0.06}"
DESLOC_Y="${DESLOC_Y:-0.1}"
SUAVE="${SUAVE:-18}"
BRILHO="${BRILHO:-0.35}"
SOMBRA="${SOMBRA:-0.6}"
ALTURA_FAIXA="${ALTURA_FAIXA:-366}"

MX="clip(128+(val-128)*${DESLOC_X},0,255)"
MY="clip(128+(val-128)*${DESLOC_Y},0,255)"

case "$SAIDA" in
  *.mp4) CODEC=(-c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart) ;;
  *) CODEC=(-c:v libvpx-vp9 -crf 28 -b:v 0 -row-mt 1 -pix_fmt yuv420p) ;;
esac

"$FFMPEG" -v error -y -i "$TECIDO" -loop 1 -framerate 24 -i "$ARTE" -filter_complex "
[0:v]format=gray,split=2[g][g2];
[g2]gblur=sigma=60[base];
[g][base]blend=all_expr='clip(128+${LUZ}*(A-B),0,255)'[luz0];
[luz0]scale=2560:1440:flags=bicubic,format=gbrp,split=3[l1][l2][l3];
[l1]gblur=sigma=$((SUAVE*2)),lutrgb=r='${MX}':g='${MX}':b='${MX}'[xm];
[l2]gblur=sigma=$((SUAVE*2)),lutrgb=r='${MY}':g='${MY}':b='${MY}'[ym];
[1:v]scale=2560:1440:flags=lanczos,format=gbrp[arte];
[arte][xm][ym]displace=edge=smear[dobrada];
[l3]null[sombra];
[dobrada][sombra]blend=all_expr='if(gt(B,128),A+(255-A)*(B-128)/128*${BRILHO},A*(1-(128-B)/128*${SOMBRA}))',
scale=1280:720:flags=lanczos,format=yuv444p,crop=1280:${ALTURA_FAIXA}:0:(720-${ALTURA_FAIXA})/2,split=2[ida][volta0];
[volta0]reverse[volta];
[ida][volta]concat=n=2:v=1[v]
" -map "[v]" -an -t 20 "${CODEC[@]}" "$SAIDA"
