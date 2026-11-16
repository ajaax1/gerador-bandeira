# Gerador de bandeiras

Gera a bandeira animada do partido (tecido tremulando) a partir do logo e da cor de fundo, no estilo do modal "Detalhes do parlamentar".

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço que o Vite mostrar (ex.: http://localhost:5173).

## Uso

1. Envie o logo (PNG ou SVG com fundo transparente). Se o logo tiver fundo branco, marque "Remover fundo branco do logo".
2. Escolha a cor de fundo (seletor ou hexadecimal).
3. Ajuste altura e posição do logo. A prévia mostra o modal com a bandeira ao vivo.
4. Baixe:
   - **Vídeo WebM**: para a web e o Android.
   - **Vídeo MP4**: para o iPhone (o player nativo do iOS não toca WebM).
   - **Arte PNG**: a arte plana (2560×1440), para gerar a versão de qualidade máxima pelo ffmpeg.
   - **Configuração JSON**: sigla, cor, se o texto do cabeçalho é claro, força do véu e posição do logo.

### Desenhar com formas

- Em **Formas**, adicione retângulo, elipse, triângulo, losango, estrela, faixa horizontal, faixa vertical ou texto. As faixas atravessam a bandeira inteira; giradas, viram diagonais.
- **Modelos prontos**: três faixas, diagonal e faixas verticais.
- No **Desenho da bandeira** (abaixo da prévia): clique para selecionar, arraste para mover, use a alça redonda para redimensionar. Setas movem (Shift move mais), Delete apaga. O logo também pode ser arrastado.
- **Camadas**: a de cima fica na frente; dá para subir, descer, duplicar e excluir. O logo fica sempre por cima das formas.
- "Bandeira sem logo" tira o logo para fazer a bandeira só com formas.
- **Salvar projeto** guarda tudo (formas, cor, logo embutido) num JSON; **Abrir projeto salvo** retoma depois.

### Tamanho do vídeo

O vídeo é gerado quadro a quadro com WebCodecs (Chrome, Edge e Safari recentes), sem depender de tocar em tempo real, e sai com a duração correta. No Firefox, cai na gravação em tempo real (arquivo maior).

- **Duração do loop**: 6, 10 (padrão) ou 20 s. É vai e volta, então o loop não tem emenda.
- **Resolução**: 1280 px ou 960 px (celular, cerca de 40% menor).
- **Qualidade**: Leve, Média (padrão) ou Alta.

Medido com 10 s em 1280 px: WebM 306 KB (Leve), 526 KB (Média), 976 KB (Alta); MP4 426 KB, 792 KB, 1,6 MB. Em 960 px e 6 s, menos ainda.

## Gerar pelo ffmpeg (opcional)

Para comparar ou para máxima qualidade, o ffmpeg continua disponível:

```bash
FFMPEG=ffmpeg scripts/gerar-bandeira.sh scripts/tecido-cinza.mp4 arte-pt.png bandeira-pt.webm
FFMPEG=ffmpeg scripts/gerar-bandeira.sh scripts/tecido-cinza.mp4 arte-pt.png bandeira-pt.mp4
```

Usa a "Arte PNG" baixada daqui. Sai com uns 600 KB a 1 MB e com a duração correta nos metadados.

## Como funciona

- `public/tecido-luz-{6,10,20}.mp4`: o tecido já processado (luz sem o gradiente e dobras suavizadas, em vai e volta, faixa 1280×366). Metade de cima = luz; metade de baixo = luz desfocada, que move o logo junto com as dobras.
- `src/renderizador.ts`: shader WebGL2 que aplica luz, sombra e deslocamento sobre a arte, quadro a quadro.
- `src/arte.ts`: desenha a arte plana (cor + logo) em 2x.
- `src/codificar.ts`: lê o tecido quadro a quadro (mp4box + VideoDecoder), desenha cada quadro e codifica (VideoEncoder + mp4-muxer/webm-muxer).
- `src/exportar.ts`: gravação em tempo real com MediaRecorder (reserva para navegadores sem WebCodecs).

Para trocar o tecido: `for d in 6 10 20; do DURACAO=$d FFMPEG=ffmpeg scripts/preparar-tecido.sh <novo-tecido.mp4>; done`.

## No modal (front)

- `<video autoplay muted loop playsinline>` com `object-fit: cover` e `object-position: right center`.
- Por cima, um véu em gradiente na cor do partido (da esquerda, até 60% da largura).
- Texto branco em cores escuras, `#1f2937` em cores claras (o JSON já diz qual).
