import { contemPonto, paraLocal, tamanhoVisual, type Forma } from "./formas";
import { ALTURA, LARGURA } from "./renderizador";

const CENTRO = ALTURA / 2;
const LIMITE_TEXTO_MODAL = 640;
const MARGEM_ALCA = 10;

export interface RetanguloLogo {
    x: number;
    y: number;
    largura: number;
    altura: number;
}

export interface FonteEditor {
    arte: () => HTMLCanvasElement;
    formas: () => Forma[];
    selecionados: () => string[];
    logo: () => RetanguloLogo | null;
    selecionar: (ids: string[]) => void;
    alterar: () => void;
    moverLogo: (x: number, y: number) => void;
    remover: (ids: string[]) => void;
    iniciarGesto: () => void;
    encerrarGesto: () => void;
}

interface Ponto {
    x: number;
    y: number;
}

type Arraste =
    | { modo: "mover"; inicio: Ponto; formas: Map<string, Ponto>; logo: Ponto | null }
    | { modo: "redimensionar"; id: string; local0: Ponto; largura0: number; altura0: number }
    | { modo: "girar"; id: string; angulo0: number; rotacao0: number }
    | { modo: "caixa"; inicio: Ponto; fim: Ponto; base: string[] };

export const ID_LOGO = "__logo__";

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function aproximarDaTela(centro: Ponto, ponto: Ponto): Ponto {
    let t = 1;
    const minX = MARGEM_ALCA, maxX = LARGURA - MARGEM_ALCA, minY = MARGEM_ALCA, maxY = ALTURA - MARGEM_ALCA;
    const dx = ponto.x - centro.x;
    const dy = ponto.y - centro.y;
    if (ponto.x < minX && dx < 0 && centro.x >= minX) t = Math.min(t, (minX - centro.x) / dx);
    if (ponto.x > maxX && dx > 0 && centro.x <= maxX) t = Math.min(t, (maxX - centro.x) / dx);
    if (ponto.y < minY && dy < 0 && centro.y >= minY) t = Math.min(t, (minY - centro.y) / dy);
    if (ponto.y > maxY && dy > 0 && centro.y <= maxY) t = Math.min(t, (maxY - centro.y) / dy);
    return { x: limitar(centro.x + dx * t, minX, maxX), y: limitar(centro.y + dy * t, minY, maxY) };
}

function girar(forma: Forma, local: Ponto): Ponto {
    const a = (forma.rotacao * Math.PI) / 180;
    return {
        x: forma.x + local.x * Math.cos(a) - local.y * Math.sin(a),
        y: CENTRO + forma.y + local.x * Math.sin(a) + local.y * Math.cos(a),
    };
}

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

    private pontoArte(e: PointerEvent): Ponto {
        const r = this.canvas.getBoundingClientRect();
        const s = this.escala();
        return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s };
    }

    private formaUnica(): Forma | undefined {
        const ids = this.fonte.selecionados();
        if (ids.length !== 1) return undefined;
        return this.fonte.formas().find((f) => f.id === ids[0]);
    }

    private centro(forma: Forma): Ponto {
        return { x: forma.x, y: CENTRO + forma.y };
    }

    private alcaTamanho(forma: Forma): Ponto {
        const { largura, altura } = tamanhoVisual(forma);
        const lx = forma.tipo === "faixaH" ? 0 : largura / 2;
        const ly = forma.tipo === "faixaV" ? 0 : altura / 2;
        return aproximarDaTela(this.centro(forma), girar(forma, { x: lx, y: ly }));
    }

    private alcaGiro(forma: Forma): Ponto {
        const { largura, altura } = tamanhoVisual(forma);
        const afastar = 28 * this.escala();
        const local = forma.tipo === "faixaV"
            ? { x: Math.min(largura / 2 + afastar, 150), y: 0 }
            : { x: 0, y: -Math.min(altura / 2 + afastar, 150) };
        return aproximarDaTela(this.centro(forma), girar(forma, local));
    }

    private noLogo(p: Ponto): boolean {
        const logo = this.fonte.logo();
        return Boolean(logo && Math.abs(p.x - logo.x) <= logo.largura / 2 && Math.abs(p.y - (CENTRO + logo.y)) <= logo.altura / 2);
    }

    private acertar(p: Ponto): string | null {
        if (this.noLogo(p)) return ID_LOGO;
        const formas = this.fonte.formas();
        for (let i = formas.length - 1; i >= 0; i--) {
            if (contemPonto(formas[i], p.x, p.y, CENTRO)) return formas[i].id;
        }
        return null;
    }

    private capturar(e: PointerEvent): void {
        this.canvas.setPointerCapture(e.pointerId);
        this.fonte.iniciarGesto();
    }

    private iniciarMover(p: Ponto, ids: string[]): Arraste {
        const formas = new Map<string, Ponto>();
        for (const f of this.fonte.formas()) if (ids.includes(f.id)) formas.set(f.id, { x: f.x, y: f.y });
        const logo = this.fonte.logo();
        return { modo: "mover", inicio: p, formas, logo: ids.includes(ID_LOGO) && logo ? { x: logo.x, y: logo.y } : null };
    }

    private aoPressionar(e: PointerEvent): void {
        this.canvas.focus();
        const p = this.pontoArte(e);
        const raio = 12 * this.escala();
        const aditivo = e.shiftKey || e.ctrlKey || e.metaKey;
        const unica = this.formaUnica();
        if (unica && !aditivo) {
            const giro = this.alcaGiro(unica);
            if (Math.hypot(p.x - giro.x, p.y - giro.y) <= raio) {
                const c = this.centro(unica);
                this.arraste = { modo: "girar", id: unica.id, angulo0: Math.atan2(p.y - c.y, p.x - c.x), rotacao0: unica.rotacao };
                this.capturar(e);
                return;
            }
            const tamanho = this.alcaTamanho(unica);
            if (Math.hypot(p.x - tamanho.x, p.y - tamanho.y) <= raio) {
                const local0 = paraLocal(unica, p.x, p.y, CENTRO);
                this.arraste = { modo: "redimensionar", id: unica.id, local0, largura0: unica.largura, altura0: unica.altura };
                this.capturar(e);
                return;
            }
        }
        const atuais = this.fonte.selecionados();
        const alvo = this.acertar(p);
        if (!alvo) {
            if (!aditivo) this.fonte.selecionar([]);
            this.arraste = { modo: "caixa", inicio: p, fim: p, base: aditivo ? atuais : [] };
            this.canvas.setPointerCapture(e.pointerId);
            return;
        }
        let ids: string[];
        if (aditivo) {
            ids = atuais.includes(alvo) ? atuais.filter((id) => id !== alvo) : [...atuais, alvo];
            this.fonte.selecionar(ids);
            if (!ids.includes(alvo)) return;
        } else if (atuais.includes(alvo)) {
            ids = atuais;
        } else {
            ids = [alvo];
            this.fonte.selecionar(ids);
        }
        this.arraste = this.iniciarMover(p, ids);
        this.capturar(e);
    }

    private dentroDaCaixa(caixa: { inicio: Ponto; fim: Ponto }): string[] {
        const borda = (v: number, limite: number) => (Math.abs(v - limite) <= MARGEM_ALCA ? limite : v);
        const x0 = borda(Math.min(caixa.inicio.x, caixa.fim.x), 0);
        const x1 = borda(Math.max(caixa.inicio.x, caixa.fim.x), LARGURA);
        const y0 = borda(Math.min(caixa.inicio.y, caixa.fim.y), 0);
        const y1 = borda(Math.max(caixa.inicio.y, caixa.fim.y), ALTURA);
        const contem = (a: number, b: number, c: number, d: number) => {
            const ax = Math.max(a, 0), bx = Math.min(b, LARGURA), ay = Math.max(c, 0), by = Math.min(d, ALTURA);
            return ax < bx && ay < by && ax >= x0 && bx <= x1 && ay >= y0 && by <= y1;
        };
        const ids = this.fonte.formas().filter((f) => {
            const { largura, altura } = tamanhoVisual(f);
            const cantos = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => girar(f, { x: (sx * largura) / 2, y: (sy * altura) / 2 }));
            const xs = cantos.map((c) => c.x);
            const ys = cantos.map((c) => c.y);
            return contem(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys));
        }).map((f) => f.id);
        const logo = this.fonte.logo();
        if (logo && contem(logo.x - logo.largura / 2, logo.x + logo.largura / 2, CENTRO + logo.y - logo.altura / 2, CENTRO + logo.y + logo.altura / 2)) {
            ids.push(ID_LOGO);
        }
        return ids;
    }

    private aoMover(e: PointerEvent): void {
        const p = this.pontoArte(e);
        const arraste = this.arraste;
        if (!arraste) {
            this.atualizarCursor(p);
            return;
        }
        if (arraste.modo === "caixa") {
            arraste.fim = p;
            this.fonte.selecionar([...new Set([...arraste.base, ...this.dentroDaCaixa(arraste)])]);
            this.desenhar();
            return;
        }
        if (arraste.modo === "mover") {
            const dx = Math.round(p.x - arraste.inicio.x);
            const dy = Math.round(p.y - arraste.inicio.y);
            for (const f of this.fonte.formas()) {
                const origem = arraste.formas.get(f.id);
                if (!origem) continue;
                f.x = origem.x + dx;
                f.y = origem.y + dy;
            }
            if (arraste.logo) this.fonte.moverLogo(arraste.logo.x + dx, arraste.logo.y + dy);
            if (arraste.formas.size) this.fonte.alterar();
            return;
        }
        const forma = this.fonte.formas().find((f) => f.id === arraste.id);
        if (!forma) return;
        if (arraste.modo === "girar") {
            const c = this.centro(forma);
            let graus = arraste.rotacao0 + ((Math.atan2(p.y - c.y, p.x - c.x) - arraste.angulo0) * 180) / Math.PI;
            if (e.shiftKey) graus = Math.round(graus / 15) * 15;
            graus = ((((graus + 180) % 360) + 360) % 360) - 180;
            forma.rotacao = Math.round(graus);
            this.fonte.alterar();
            return;
        }
        const local = paraLocal(forma, p.x, p.y, CENTRO);
        const fator = (atual: number, inicial: number) => (Math.abs(inicial) < 1 ? 1 : Math.abs(atual) / Math.abs(inicial));
        const w = Math.max(8, Math.round(arraste.largura0 * fator(local.x, arraste.local0.x)));
        const h = Math.max(8, Math.round(arraste.altura0 * fator(local.y, arraste.local0.y)));
        if (forma.tipo === "faixaH" || forma.tipo === "texto") forma.altura = h;
        else if (forma.tipo === "faixaV") forma.largura = w;
        else {
            forma.largura = w;
            forma.altura = h;
        }
        this.fonte.alterar();
    }

    private atualizarCursor(p: Ponto): void {
        const unica = this.formaUnica();
        const raio = 12 * this.escala();
        let cursor = "default";
        if (unica) {
            const giro = this.alcaGiro(unica);
            const tamanho = this.alcaTamanho(unica);
            if (Math.hypot(p.x - giro.x, p.y - giro.y) <= raio) cursor = "grab";
            else if (Math.hypot(p.x - tamanho.x, p.y - tamanho.y) <= raio) cursor = "nwse-resize";
        }
        if (cursor === "default" && this.acertar(p)) cursor = "move";
        this.canvas.style.cursor = cursor;
    }

    private aoSoltar(e: PointerEvent): void {
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
        const modo = this.arraste?.modo;
        this.arraste = null;
        if (modo === "caixa") this.desenhar();
        else if (modo) this.fonte.encerrarGesto();
    }

    private aoTeclar(e: KeyboardEvent): void {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
            e.preventDefault();
            const ids = this.fonte.formas().map((f) => f.id);
            if (this.fonte.logo()) ids.push(ID_LOGO);
            this.fonte.selecionar(ids);
            return;
        }
        const ids = this.fonte.selecionados();
        if (!ids.length) return;
        if (e.key === "Escape") {
            this.fonte.selecionar([]);
            return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
            const formas = ids.filter((id) => id !== ID_LOGO);
            if (!formas.length) return;
            e.preventDefault();
            this.fonte.remover(formas);
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
        if (ids.includes(ID_LOGO)) {
            const logo = this.fonte.logo();
            if (logo) this.fonte.moverLogo(logo.x + d[0], logo.y + d[1]);
        }
        let mexeu = false;
        for (const forma of this.fonte.formas()) {
            if (!ids.includes(forma.id)) continue;
            forma.x += d[0];
            forma.y += d[1];
            mexeu = true;
        }
        if (mexeu) this.fonte.alterar();
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

        const ids = this.fonte.selecionados();
        const logo = this.fonte.logo();
        if (logo && ids.includes(ID_LOGO)) this.contorno(logo.x, CENTRO + logo.y, logo.largura, logo.altura, 0, s);
        for (const forma of this.fonte.formas()) {
            if (!ids.includes(forma.id)) continue;
            const { largura: w, altura: h } = tamanhoVisual(forma);
            this.contorno(forma.x, CENTRO + forma.y, w, h, forma.rotacao, s);
        }

        const unica = this.formaUnica();
        if (unica) {
            const c = this.centro(unica);
            const giro = this.alcaGiro(unica);
            ctx.save();
            ctx.strokeStyle = "#1d4ed8";
            ctx.lineWidth = 1.5 / s;
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(giro.x, giro.y);
            ctx.stroke();
            ctx.restore();
            this.alca(giro, s, "#1d4ed8", "#ffffff");
            this.alca(this.alcaTamanho(unica), s, "#ffffff", "#1d4ed8");
        }

        if (this.arraste?.modo === "caixa") {
            const { inicio, fim } = this.arraste;
            ctx.save();
            ctx.fillStyle = "rgba(29,78,216,0.15)";
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5 / s;
            ctx.setLineDash([6 / s, 4 / s]);
            ctx.fillRect(inicio.x, inicio.y, fim.x - inicio.x, fim.y - inicio.y);
            ctx.strokeRect(inicio.x, inicio.y, fim.x - inicio.x, fim.y - inicio.y);
            ctx.restore();
        }
    }

    private alca(p: Ponto, s: number, preenchimento: string, borda: string): void {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = preenchimento;
        ctx.strokeStyle = borda;
        ctx.lineWidth = 2 / s;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7 / s, 0, Math.PI * 2);
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
