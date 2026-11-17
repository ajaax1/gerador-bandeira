export type TipoForma =
    | "retangulo"
    | "elipse"
    | "triangulo"
    | "losango"
    | "estrela"
    | "faixaH"
    | "faixaV"
    | "arco"
    | "texto";

export interface Forma {
    id: string;
    tipo: TipoForma;
    x: number;
    y: number;
    largura: number;
    altura: number;
    rotacao: number;
    cor: string;
    opacidade: number;
    raio: number;
    espessura: number;
    abertura: number;
    texto: string;
    fonte: string;
    negrito: boolean;
    italico: boolean;
}

export const NOMES_FORMA: Record<TipoForma, string> = {
    retangulo: "Retângulo",
    elipse: "Elipse",
    triangulo: "Triângulo",
    losango: "Losango",
    estrela: "Estrela",
    faixaH: "Faixa horizontal",
    faixaV: "Faixa vertical",
    arco: "Arco",
    texto: "Texto",
};

export const FONTES = [
    { valor: "Montserrat", nome: "Montserrat" },
    { valor: "Roboto", nome: "Roboto" },
    { valor: "Oswald", nome: "Oswald" },
    { valor: "Bebas Neue", nome: "Bebas Neue" },
    { valor: "Merriweather", nome: "Merriweather" },
];

const EXTENSAO = 4000;

let contador = 0;
function novoId(): string {
    contador += 1;
    return `f${Date.now().toString(36)}${contador}`;
}

export function criarForma(tipo: TipoForma, parcial: Partial<Forma> = {}): Forma {
    const base: Forma = {
        id: novoId(),
        tipo,
        x: 960,
        y: 0,
        largura: 200,
        altura: 200,
        rotacao: 0,
        cor: "#FFFFFF",
        opacidade: 1,
        raio: 0,
        espessura: 36,
        abertura: 180,
        texto: "SIGLA",
        fonte: "Montserrat",
        negrito: true,
        italico: false,
    };
    if (tipo === "faixaH") Object.assign(base, { x: 640, altura: 110 });
    if (tipo === "faixaV") Object.assign(base, { largura: 110 });
    if (tipo === "retangulo") Object.assign(base, { largura: 260, altura: 160 });
    if (tipo === "elipse") Object.assign(base, { largura: 220, altura: 220 });
    if (tipo === "texto") Object.assign(base, { altura: 120 });
    if (tipo === "arco") Object.assign(base, { x: 1000, largura: 520, altura: 320 });
    return { ...base, ...parcial, id: parcial.id ?? base.id };
}

export function duplicarForma(forma: Forma): Forma {
    return { ...forma, id: novoId(), x: forma.x + 24, y: forma.y + 24 };
}

export function fonteCss(forma: Forma): string {
    return `${forma.italico ? "italic " : ""}${forma.negrito ? 800 : 400} ${forma.altura}px "${forma.fonte}", Arial, sans-serif`;
}

let medidor: CanvasRenderingContext2D | null = null;
export function larguraTexto(forma: Forma): number {
    medidor ??= document.createElement("canvas").getContext("2d");
    if (!medidor) return forma.altura * forma.texto.length * 0.6;
    medidor.font = fonteCss(forma);
    return Math.max(10, medidor.measureText(forma.texto || " ").width);
}

export function tamanhoVisual(forma: Forma): { largura: number; altura: number } {
    if (forma.tipo === "texto") return { largura: larguraTexto(forma), altura: forma.altura };
    if (forma.tipo === "faixaH") return { largura: 1280, altura: forma.altura };
    if (forma.tipo === "faixaV") return { largura: forma.largura, altura: 366 };
    if (forma.tipo === "arco") return { largura: forma.largura + forma.espessura, altura: forma.altura + forma.espessura };
    return { largura: forma.largura, altura: forma.altura };
}

function caminhoEstrela(ctx: CanvasRenderingContext2D, rx: number, ry: number): void {
    const pontas = 5;
    const interno = 0.42;
    for (let i = 0; i < pontas * 2; i++) {
        const r = i % 2 === 0 ? 1 : interno;
        const a = -Math.PI / 2 + (i * Math.PI) / pontas;
        const px = Math.cos(a) * rx * r;
        const py = Math.sin(a) * ry * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

export function desenharForma(ctx: CanvasRenderingContext2D, forma: Forma, centroY: number): void {
    const w = forma.largura;
    const h = forma.altura;
    ctx.save();
    ctx.globalAlpha = forma.opacidade;
    ctx.translate(forma.x, centroY + forma.y);
    ctx.rotate((forma.rotacao * Math.PI) / 180);
    ctx.fillStyle = forma.cor;
    ctx.beginPath();
    switch (forma.tipo) {
        case "retangulo":
            ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(forma.raio, w / 2, h / 2));
            break;
        case "elipse":
            ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
            break;
        case "triangulo":
            ctx.moveTo(0, -h / 2);
            ctx.lineTo(w / 2, h / 2);
            ctx.lineTo(-w / 2, h / 2);
            ctx.closePath();
            break;
        case "losango":
            ctx.moveTo(0, -h / 2);
            ctx.lineTo(w / 2, 0);
            ctx.lineTo(0, h / 2);
            ctx.lineTo(-w / 2, 0);
            ctx.closePath();
            break;
        case "estrela":
            caminhoEstrela(ctx, w / 2, h / 2);
            break;
        case "faixaH":
            ctx.rect(-EXTENSAO, -h / 2, EXTENSAO * 2, h);
            break;
        case "faixaV":
            ctx.rect(-w / 2, -EXTENSAO, w, EXTENSAO * 2);
            break;
        case "arco": {
            const meia = (Math.max(1, Math.min(360, forma.abertura)) * Math.PI) / 360;
            ctx.ellipse(0, 0, Math.max(1, w / 2), Math.max(1, h / 2), 0, -meia, meia);
            ctx.lineWidth = forma.espessura;
            ctx.lineCap = "butt";
            ctx.strokeStyle = forma.cor;
            ctx.stroke();
            ctx.restore();
            return;
        }
        case "texto":
            ctx.font = fonteCss(forma);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(forma.texto, 0, forma.altura * 0.04);
            ctx.restore();
            return;
    }
    ctx.fill();
    ctx.restore();
}

export function paraLocal(forma: Forma, px: number, py: number, centroY: number): { x: number; y: number } {
    const dx = px - forma.x;
    const dy = py - (centroY + forma.y);
    const a = (-forma.rotacao * Math.PI) / 180;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

export function contemPonto(forma: Forma, px: number, py: number, centroY: number): boolean {
    const local = paraLocal(forma, px, py, centroY);
    if (forma.tipo === "faixaH") return Math.abs(local.y) <= forma.altura / 2;
    if (forma.tipo === "faixaV") return Math.abs(local.x) <= forma.largura / 2;
    if (forma.tipo === "arco") return dentroDoArco(forma, local.x, local.y);
    const { largura, altura } = tamanhoVisual(forma);
    return Math.abs(local.x) <= largura / 2 && Math.abs(local.y) <= altura / 2;
}

function dentroDoArco(forma: Forma, x: number, y: number): boolean {
    const rx = Math.max(1, forma.largura / 2);
    const ry = Math.max(1, forma.altura / 2);
    const angulo = Math.atan2(y / ry, x / rx);
    const meia = (Math.max(1, Math.min(360, forma.abertura)) * Math.PI) / 360;
    if (Math.abs(angulo) > meia + 0.02) return false;
    const naCurva = { x: Math.cos(angulo) * rx, y: Math.sin(angulo) * ry };
    const folga = Math.max(10, forma.espessura / 2 + 4);
    return Math.hypot(x - naCurva.x, y - naCurva.y) <= folga;
}

export function modeloArcoBorda(): Forma[] {
    return [
        criarForma("arco", { x: 1350, largura: 760, altura: 560, espessura: 34, abertura: 120, rotacao: 180, cor: "#009C3B" }),
        criarForma("arco", { x: 1350, largura: 692, altura: 492, espessura: 34, abertura: 120, rotacao: 180, cor: "#FFDF00" }),
    ];
}

export function modeloTresFaixas(cores: [string, string, string]): Forma[] {
    return [
        criarForma("faixaH", { y: -122, altura: 122, cor: cores[0] }),
        criarForma("faixaH", { y: 0, altura: 122, cor: cores[1] }),
        criarForma("faixaH", { y: 122, altura: 122, cor: cores[2] }),
    ];
}

export function modeloDiagonal(cor: string): Forma[] {
    return [criarForma("faixaH", { x: 860, y: 0, altura: 90, rotacao: -18, cor })];
}

export function modeloDuasFaixasV(cor: string): Forma[] {
    return [criarForma("faixaV", { x: 1180, largura: 120, cor }), criarForma("faixaV", { x: 1040, largura: 50, cor })];
}
