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

- Em **Formas**, adicione retângulo, elipse, triângulo, losango, estrela, faixa horizontal, faixa vertical, arco ou texto. As faixas atravessam a bandeira inteira; giradas, viram diagonais. O arco tem espessura e abertura (em graus) e serve para bordas curvas.
- **Modelos prontos**: três faixas, diagonal, faixas verticais e borda curva (verde e amarela, como no PL).
- No **Desenho da bandeira** (abaixo da prévia): clique para selecionar e arraste para mover. A alça branca redimensiona e a azul gira (com Shift, de 15 em 15°). Setas movem (Shift move mais), Delete apaga. O logo também pode ser arrastado.
- **Várias formas**: Shift ou Ctrl + clique (no editor ou nas camadas) põe ou tira da seleção; arrastar num espaço vazio seleciona o que ficar dentro da caixa; Ctrl+A seleciona tudo. Juntas, elas se movem, mudam de cor e de opacidade e são excluídas de uma vez.
- **Desfazer e refazer**: Ctrl+Z e Ctrl+Shift+Z (ou Ctrl+Y), ou os botões acima do editor. Valem para formas, cor de fundo e logo; os ajustes do tecido e do véu não entram.
- **Camadas**: a de cima fica na frente; dá para subir, descer, duplicar e excluir. O logo fica sempre por cima das formas.
- "Bandeira sem logo" tira o logo para fazer a bandeira só com formas.
- **Salvar projeto** guarda tudo (formas, cor, logo embutido) num JSON; **Abrir projeto salvo** retoma depois.

### Tamanho do vídeo

O vídeo é gerado quadro a quadro com WebCodecs (Chrome, Edge e Safari recentes), sem depender de tocar em tempo real, e sai com a duração correta. No Firefox, cai na gravação em tempo real (arquivo maior).

- **Duração do loop**: 8 (padrão) ou 16 s. A onda corre sempre no mesmo sentido e a emenda do loop não aparece. O de 16 s repete o mesmo trecho duas vezes: só vale a pena se algum player der um tranco ao recomeçar o vídeo.
- **Resolução**: 1280 px ou 960 px (celular, cerca de 40% menor).
- **Qualidade**: Leve, Média (padrão) ou Alta.

Medido com 10 s em 1280 px, no tecido anterior: WebM 306 KB (Leve), 526 KB (Média), 976 KB (Alta); MP4 426 KB, 792 KB, 1,6 MB. Com 8 s, uns 20% menos.

## Gerar pelo ffmpeg (opcional)

Para comparar ou para máxima qualidade, o ffmpeg continua disponível:

```bash
FFMPEG=ffmpeg scripts/gerar-bandeira.sh scripts/tecido-cinza-loop.mp4 arte-pt.png bandeira-pt.webm
FFMPEG=ffmpeg scripts/gerar-bandeira.sh scripts/tecido-cinza-loop.mp4 arte-pt.png bandeira-pt.mp4
```

Usa a "Arte PNG" baixada daqui. Sai com 8 s (ou `DURACAO=16`), uns 450 KB em WebM.

## Como funciona

- `scripts/tecido-cinza-loop.mp4`: o tecido do Veo virado loop contínuo de 8 s. O `tecido-em-loop.sh` pega os primeiros 8 s e, nos 2 s iniciais, mistura aos poucos os 2 s seguintes; assim o último quadro emenda no primeiro e a onda não precisa ir e voltar.
- `public/tecido-luz-{8,16}.mp4`: o tecido já processado (luz sem o gradiente e dobras suavizadas, faixa 1280×366). Metade de cima = luz; metade de baixo = luz desfocada, que move o logo junto com as dobras.
- `src/renderizador.ts`: shader WebGL2 que aplica luz, sombra e deslocamento sobre a arte, quadro a quadro.
- `src/arte.ts`: desenha a arte plana (cor + logo) em 2x.
- `src/codificar.ts`: lê o tecido quadro a quadro (mp4box + VideoDecoder), desenha cada quadro e codifica (VideoEncoder + mp4-muxer/webm-muxer).
- `src/exportar.ts`: gravação em tempo real com MediaRecorder (reserva para navegadores sem WebCodecs).

Para trocar o tecido (precisa ter pelo menos 10 s): `FFMPEG=ffmpeg scripts/tecido-em-loop.sh <novo-tecido.mp4>` e depois `for d in 8 16; do DURACAO=$d FFMPEG=ffmpeg scripts/preparar-tecido.sh; done`.

## No modal (front)

- `<video autoplay muted loop playsinline>` com `object-fit: cover` e `object-position: right center`.
- Por cima, um véu em gradiente na cor do partido (da esquerda, até 60% da largura).
- Texto branco em cores escuras, `#1f2937` em cores claras (o JSON já diz qual).
