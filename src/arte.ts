import { desenharForma, type Forma } from "./formas";
import { ALTURA, LARGURA } from "./renderizador";

const ESCALA = 2;

export interface ConfigArte {
    cor: string;
    formas: Forma[];
    logo: CanvasImageSource | null;
    larguraLogo: number;
    alturaLogo: number;
    tamanho: number;
    posX: number;
    posY: number;
}

function desenhar(ctx: CanvasRenderingContext2D, config: ConfigArte, alturaTotal: number): void {
    ctx.fillStyle = config.cor;
    ctx.fillRect(0, 0, LARGURA, alturaTotal);
    for (const forma of config.formas) desenharForma(ctx, forma, alturaTotal / 2);
    if (!config.logo || !config.larguraLogo || !config.alturaLogo) return;
    const altura = config.tamanho;
    const largura = (config.larguraLogo / config.alturaLogo) * altura;
    const centroY = alturaTotal / 2 + config.posY;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(config.logo, config.posX - largura / 2, centroY - altura / 2, largura, altura);
}

export function criarCanvasArte(config: ConfigArte, alturaTotal = ALTURA, alvo?: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = alvo ?? document.createElement("canvas");
    canvas.width = LARGURA * ESCALA;
    canvas.height = alturaTotal * ESCALA;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponível.");
    ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);
    desenhar(ctx, config, alturaTotal);
    return canvas;
}

export async function carregarLogo(arquivo: File, removerBranco: boolean): Promise<{ imagem: HTMLCanvasElement; largura: number; altura: number }> {
    const url = URL.createObjectURL(arquivo);
    try {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        await img.decode();
        let largura = img.naturalWidth || 1000;
        let altura = img.naturalHeight || 1000;
        const minimo = 1400;
        if (Math.max(largura, altura) < minimo) {
            const fator = minimo / Math.max(largura, altura);
            if (arquivo.type === "image/svg+xml") {
                largura = Math.round(largura * fator);
                altura = Math.round(altura * fator);
            }
        }
        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext("2d", { willReadFrequently: removerBranco });
        if (!ctx) throw new Error("Canvas 2D indisponível.");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, largura, altura);
        if (removerBranco) tirarFundoBranco(ctx, largura, altura);
        const imagem = recortarTransparencia(canvas);
        return { imagem, largura: imagem.width, altura: imagem.height };
    } finally {
        URL.revokeObjectURL(url);
    }
}

function tirarFundoBranco(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
    const dados = ctx.getImageData(0, 0, largura, altura);
    const p = dados.data;
    for (let i = 0; i < p.length; i += 4) {
        const minimo = Math.min(p[i], p[i + 1], p[i + 2]);
        if (minimo >= 245) {
            p[i + 3] = 0;
        } else if (minimo >= 215) {
            p[i + 3] = Math.round(p[i + 3] * ((245 - minimo) / 30));
        }
    }
    ctx.putImageData(dados, 0, 0);
}

function recortarTransparencia(origem: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = origem.getContext("2d");
    if (!ctx) return origem;
    const { width, height } = origem;
    const p = ctx.getImageData(0, 0, width, height).data;
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (p[(y * width + x) * 4 + 3] > 8) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }
    if (x1 < 0) return origem;
    const recorte = document.createElement("canvas");
    recorte.width = x1 - x0 + 1;
    recorte.height = y1 - y0 + 1;
    recorte.getContext("2d")?.drawImage(origem, x0, y0, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height);
    return recorte;
}

export function luminancia(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    const canal = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function hexParaRgb(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
