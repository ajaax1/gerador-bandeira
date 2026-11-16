import { contemPonto, paraLocal, tamanhoVisual, type Forma } from "./formas";
import { ALTURA, LARGURA } from "./renderizador";

const CENTRO = ALTURA / 2;
const LIMITE_TEXTO_MODAL = 640;

export interface RetanguloLogo {
    x: number;
    y: number;
    largura: number;
    altura: number;
}

export interface FonteEditor {
    arte: () => HTMLCanvasElement;
    formas: () => Forma[];
    selecionado: () => string | null;
    logo: () => RetanguloLogo | null;
    selecionar: (id: string | null) => void;
    alterar: () => void;
    moverLogo: (x: number, y: number) => void;
    remover: (id: string) => void;
}

type Arraste =
    | { modo: "mover"; id: string; dx: number; dy: number }
    | { modo: "redimensionar"; id: string }
    | { modo: "logo"; dx: number; dy: number };

export const ID_LOGO = "__logo__";

export class Editor {
    private readonly ctx: CanvasRenderingContext2D;
    private arraste: Arraste | null = null;

    constructor(private readonly canvas: HTMLCanvasElement, private readonly fonte: FonteEditor) {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D indisponível.");
        this.ctx = ctx;
        new ResizeObserver(() => this.desenhar()).observe(canvas);
        canvas.addEventListener("pointerdown", (e) => this.aoPressionar(e));
        canvas.addEventListener("pointermove", (e) => this.aoMover(e));
        canvas.addEventListener("pointerup", (e) => this.aoSoltar(e));
        canvas.addEventListener("pointercancel", (e) => this.aoSoltar(e));
        canvas.addEventListener("keydown", (e) => this.aoTeclar(e));
    }

    private escala(): number {
        return LARGURA / Math.max(1, this.canvas.clientWidth);
    }

    private pontoArte(e: PointerEvent): { x: number; y: number } {
        const r = this.canvas.getBoundingClientRect();
        const s = this.escala();
        return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s };
    }

    private formaSelecionada(): Forma | undefined {
        const id = this.fonte.selecionado();
        return this.fonte.formas().find((f) => f.id === id);
    }

    private alca(forma: Forma): { x: number; y: number } {
        const { largura, altura } = tamanhoVisual(forma);
        const lx = forma.tipo === "faixaH" ? 0 : largura / 2;
        const ly = forma.tipo === "faixaV" ? 0 : altura / 2;
        const a = (forma.rotacao * Math.PI) / 180;
        return {
            x: forma.x + lx * Math.cos(a) - ly * Math.sin(a),
            y: CENTRO + forma.y + lx * Math.sin(a) + ly * Math.cos(a),
        };
    }

    private aoPressionar(e: PointerEvent): void {
        this.canvas.focus();
        const p = this.pontoArte(e);
        const raioAlca = 12 * this.escala();
        const atual = this.formaSelecionada();
        if (atual) {
            const alca = this.alca(atual);
            if (Math.hypot(p.x - alca.x, p.y - alca.y) <= raioAlca) {
                this.arraste = { modo: "redimensionar", id: atual.id };
                this.canvas.setPointerCapture(e.pointerId);
                return;
            }
        }
        const logo = this.fonte.logo();
        if (logo && Math.abs(p.x - logo.x) <= logo.largura / 2 && Math.abs(p.y - (CENTRO + logo.y)) <= logo.altura / 2) {
            this.fonte.selecionar(ID_LOGO);
            this.arraste = { modo: "logo", dx: p.x - logo.x, dy: p.y - (CENTRO + logo.y) };
            this.canvas.setPointerCapture(e.pointerId);
            return;
        }
        const formas = this.fonte.formas();
        for (let i = formas.length - 1; i >= 0; i--) {
            const f = formas[i];
            if (contemPonto(f, p.x, p.y, CENTRO)) {
                this.fonte.selecionar(f.id);
                this.arraste = { modo: "mover", id: f.id, dx: p.x - f.x, dy: p.y - (CENTRO + f.y) };
                this.canvas.setPointerCapture(e.pointerId);
                return;
            }
        }
        this.fonte.selecionar(null);
    }

    private aoMover(e: PointerEvent): void {
        const p = this.pontoArte(e);
        if (!this.arraste) {
            const atual = this.formaSelecionada();
            const perto = atual && Math.hypot(p.x - this.alca(atual).x, p.y - this.alca(atual).y) <= 12 * this.escala();
            this.canvas.style.cursor = perto ? "nwse-resize" : "default";
            return;
        }
        if (this.arraste.modo === "logo") {
            this.fonte.moverLogo(Math.round(p.x - this.arraste.dx), Math.round(p.y - CENTRO - this.arraste.dy));
            return;
        }
        const id = this.arraste.id;
        const forma = this.fonte.formas().find((f) => f.id === id);
        if (!forma) return;
        if (this.arraste.modo === "mover") {
            forma.x = Math.round(p.x - this.arraste.dx);
            forma.y = Math.round(p.y - CENTRO - this.arraste.dy);
        } else {
            const local = paraLocal(forma, p.x, p.y, CENTRO);
            const w = Math.max(8, Math.round(Math.abs(local.x) * 2));
            const h = Math.max(8, Math.round(Math.abs(local.y) * 2));
            if (forma.tipo === "faixaH" || forma.tipo === "texto") forma.altura = h;
            else if (forma.tipo === "faixaV") forma.largura = w;
            else {
                forma.largura = w;
                forma.altura = h;
            }
        }
        this.fonte.alterar();
    }

    private aoSoltar(e: PointerEvent): void {
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
        this.arraste = null;
    }

    private aoTeclar(e: KeyboardEvent): void {
        const id = this.fonte.selecionado();
        if (!id) return;
        if ((e.key === "Delete" || e.key === "Backspace") && id !== ID_LOGO) {
            e.preventDefault();
            this.fonte.remover(id);
            return;
        }
        const passo = e.shiftKey ? 10 : 2;
        const delta: Record<string, [number, number]> = {
            ArrowLeft: [-passo, 0],
            ArrowRight: [passo, 0],
            ArrowUp: [0, -passo],
            ArrowDown: [0, passo],
        };
        const d = delta[e.key];
        if (!d) return;
        e.preventDefault();
        if (id === ID_LOGO) {
            const logo = this.fonte.logo();
            if (logo) this.fonte.moverLogo(logo.x + d[0], logo.y + d[1]);
            return;
        }
        const forma = this.formaSelecionada();
        if (!forma) return;
        forma.x += d[0];
        forma.y += d[1];
        this.fonte.alterar();
    }

    desenhar(): void {
        const dpr = window.devicePixelRatio || 1;
        const largura = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
        const altura = Math.max(1, Math.round((largura * ALTURA) / LARGURA));
        if (this.canvas.width !== largura || this.canvas.height !== altura) {
            this.canvas.width = largura;
            this.canvas.height = altura;
        }
        const ctx = this.ctx;
        const s = largura / LARGURA;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(this.fonte.arte(), 0, 0, largura, altura);
        ctx.setTransform(s, 0, 0, s, 0, 0);

        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5 / s;
        ctx.beginPath();
        ctx.moveTo(LIMITE_TEXTO_MODAL, 0);
        ctx.lineTo(LIMITE_TEXTO_MODAL, ALTURA);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `${12 / s}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 4 / s;
        ctx.textAlign = "right";
        ctx.fillText("← fica atrás da foto e do nome", LIMITE_TEXTO_MODAL - 8 / s, 18 / s);
        ctx.restore();

        const id = this.fonte.selecionado();
        if (id === ID_LOGO) {
            const logo = this.fonte.logo();
            if (logo) this.contorno(logo.x, CENTRO + logo.y, logo.largura, logo.altura, 0, s);
            return;
        }
        const forma = this.formaSelecionada();
        if (!forma) return;
        const { largura: w, altura: h } = tamanhoVisual(forma);
        this.contorno(forma.x, CENTRO + forma.y, w, h, forma.rotacao, s);
        const alca = this.alca(forma);
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 2 / s;
        ctx.beginPath();
        ctx.arc(alca.x, alca.y, 7 / s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    private contorno(x: number, y: number, w: number, h: number, rotacao: number, s: number): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rotacao * Math.PI) / 180);
        ctx.lineWidth = 2 / s;
        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeStyle = "#1d4ed8";
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.restore();
    }
}
