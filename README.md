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

A gravação leva 20 s (a duração do loop). Qualidade "Leve" ≈ 2,5 MB, "Média" ≈ 6 MB, "Alta" ≈ 15 MB.

## Qualidade máxima e arquivo menor (ffmpeg)

O vídeo gravado pelo navegador é maior que o gerado pelo ffmpeg. Para produção:

```bash
FFMPEG=ffmpeg scripts/gerar-bandeira.sh scripts/tecido-cinza.mp4 arte-pt.png bandeira-pt.webm
FFMPEG=ffmpeg scripts/gerar-bandeira.sh scripts/tecido-cinza.mp4 arte-pt.png bandeira-pt.mp4
```

Usa a "Arte PNG" baixada daqui. Sai com uns 600 KB a 1 MB e com a duração correta nos metadados.

## Como funciona

- `public/tecido-luz.mp4`: o tecido já processado (luz sem o gradiente e dobras suavizadas, em vai e volta de 20 s, faixa 1280×366). Metade de cima = luz; metade de baixo = luz desfocada, que move o logo junto com as dobras.
- `src/renderizador.ts`: shader WebGL2 que aplica luz, sombra e deslocamento sobre a arte, quadro a quadro.
- `src/arte.ts`: desenha a arte plana (cor + logo) em 2x.
- `src/exportar.ts`: grava o canvas com MediaRecorder.

Para trocar o tecido: `FFMPEG=ffmpeg scripts/preparar-tecido.sh <novo-tecido.mp4>`.

## No modal (front)

- `<video autoplay muted loop playsinline>` com `object-fit: cover` e `object-position: right center`.
- Por cima, um véu em gradiente na cor do partido (da esquerda, até 60% da largura).
- Texto branco em cores escuras, `#1f2937` em cores claras (o JSON já diz qual).
