import "./style.css";
import { carregarLogo, criarCanvasArte, hexParaRgb, luminancia, type ConfigArte } from "./arte";
import { Editor, ID_LOGO } from "./editor";
import { codificarVideo, webCodecsDisponivel, type Qualidade } from "./codificar";
import { baixarBlob, gravarVideo, tipoSuportado, type Formato } from "./exportar";
import {
    criarForma,
    duplicarForma,
    fonteCss,
    modeloDiagonal,
    modeloDuasFaixasV,
    modeloTresFaixas,
    type Forma,
    type TipoForma,
} from "./formas";
import { PainelFormas } from "./painelFormas";
import { Renderizador, type AjustesTecido } from "./renderizador";

const urlLuz = (duracao: number) => `${import.meta.env.BASE_URL}tecido-luz-${duracao}.mp4`;
const urlExemplo = `${import.meta.env.BASE_URL}exemplo-pt.svg`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const PADRAO_TECIDO: AjustesTecido = { contraste: 1, brilho: 0.35, sombra: 0.6, deslocamento: 1 };

const estado = {
    sigla: "PT",
    cor: "#E30613",
    logo: null as HTMLCanvasElement | null,
    arquivoLogo: null as File | null,
    tamanho: 230,
    posX: 960,
    posY: 0,
    texto: "auto" as "auto" | "claro" | "escuro",
    veu: 0.25,
    tecido: { ...PADRAO_TECIDO },
    formas: [] as Forma[],
    selecionado: null as string | null,
    duracao: 10,
    gravando: false,
    pausarPrevia: false,
};

const canvasBandeira = $<HTMLCanvasElement>("bandeira");
const canvasArte = document.createElement("canvas");
const renderizador = new Renderizador(canvasBandeira);

const luz = document.createElement("video");
luz.src = urlLuz(estado.duracao);
luz.muted = true;
luz.loop = true;
luz.playsInline = true;
luz.crossOrigin = "anonymous";
void luz.play().catch(() => undefined);

function configArte(): ConfigArte {
    return {
        cor: estado.cor,
        formas: estado.formas,
        logo: estado.logo,
        larguraLogo: estado.logo?.width ?? 0,
        alturaLogo: estado.logo?.height ?? 0,
        tamanho: estado.tamanho,
        posX: estado.posX,
        posY: estado.posY,
    };
}

function retanguloLogo() {
    if (!estado.logo) return null;
    const altura = estado.tamanho;
    return { x: estado.posX, y: estado.posY, altura, largura: (estado.logo.width / estado.logo.height) * altura };
}

const editor = new Editor($<HTMLCanvasElement>("editor"), {
    arte: () => canvasArte,
    formas: () => estado.formas,
    selecionado: () => estado.selecionado,
    logo: retanguloLogo,
    selecionar: (id) => selecionar(id),
    alterar: () => {
        agendarArte();
        painel.sincronizar();
    },
    moverLogo: (x, y) => {
        definirFaixa("posX", x);
        definirFaixa("posY", y);
    },
    remover: (id) => remover(id),
});

let arteAgendada = false;
function agendarArte(): void {
    if (arteAgendada) return;
    arteAgendada = true;
    requestAnimationFrame(() => {
        arteAgendada = false;
        atualizarArte();
    });
}

const fontesPedidas = new Set<string>();
function pedirFontes(): void {
    for (const forma of estado.formas) {
        if (forma.tipo !== "texto") continue;
        const fonte = fonteCss(forma);
        if (fontesPedidas.has(fonte)) continue;
        fontesPedidas.add(fonte);
        void document.fonts.load(fonte, forma.texto).then(() => agendarArte());
    }
}

function atualizarArte(): void {
    pedirFontes();
    criarCanvasArte(configArte(), undefined, canvasArte);
    renderizador.atualizarArte(canvasArte);
    editor.desenhar();
}

const painel = new PainelFormas($("adicionarFormas"), $<HTMLUListElement>("camadas"), $("propriedades"), {
    adicionar: (tipo: TipoForma) => {
        const cor = luminancia(estado.cor) < 0.45 ? "#FFFFFF" : "#1F2937";
        const forma = criarForma(tipo, { cor, texto: estado.sigla || "SIGLA" });
        estado.formas.push(forma);
        selecionar(forma.id);
        atualizarArte();
    },
    selecionar: (id) => selecionar(id),
    mover: (id, direcao) => {
        const i = estado.formas.findIndex((f) => f.id === id);
        const j = i + direcao;
        if (i < 0 || j < 0 || j >= estado.formas.length) return;
        [estado.formas[i], estado.formas[j]] = [estado.formas[j], estado.formas[i]];
        atualizarCamadas();
        atualizarArte();
    },
    duplicar: (id) => {
        const forma = estado.formas.find((f) => f.id === id);
        if (!forma) return;
        const copia = duplicarForma(forma);
        estado.formas.splice(estado.formas.indexOf(forma) + 1, 0, copia);
        selecionar(copia.id);
        atualizarArte();
    },
    remover: (id) => remover(id),
    alterar: () => {
        agendarArte();
        atualizarCamadas();
    },
});

function atualizarCamadas(): void {
    $("grupoLogo").hidden = !estado.logo;
    $("tirarLogo").hidden = !estado.logo;
    painel.renderizarCamadas(estado.formas, estado.selecionado, Boolean(estado.logo), ID_LOGO);
}

function selecionar(id: string | null): void {
    if (estado.selecionado === id) return;
    estado.selecionado = id;
    atualizarCamadas();
    painel.renderizarPropriedades(estado.formas.find((f) => f.id === id) ?? null);
    editor.desenhar();
}

function remover(id: string): void {
    estado.formas = estado.formas.filter((f) => f.id !== id);
    if (estado.selecionado === id) {
        estado.selecionado = null;
        painel.renderizarPropriedades(null);
    }
    atualizarCamadas();
    atualizarArte();
}

function textoClaro(): boolean {
    if (estado.texto === "claro") return true;
    if (estado.texto === "escuro") return false;
    return luminancia(estado.cor) < 0.45;
}

function atualizarModal(): void {
    const claro = textoClaro();
    const topo = $("modalTopo");
    topo.style.background = estado.cor;
    topo.style.setProperty("--texto", claro ? "#ffffff" : "#1f2937");
    topo.style.setProperty("--chip-borda", claro ? "rgba(255,255,255,.6)" : "rgba(31,41,55,.45)");
    topo.style.setProperty("--chip-fundo", claro ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.55)");
    topo.style.setProperty("--fechar-fundo", claro ? "rgba(0,0,0,.28)" : "rgba(0,0,0,.08)");
    const forca = claro ? estado.veu : Math.min(0.85, estado.veu * 2.4);
    const rgb = hexParaRgb(estado.cor);
    $("veuCamada").style.background =
        `linear-gradient(90deg, rgba(${rgb},${forca}) 0%, rgba(${rgb},${forca * 0.4}) 40%, rgba(${rgb},0) 60%)`;
    $("chipSigla").textContent = estado.sigla || "—";
}

function quadro(): void {
    if (!estado.pausarPrevia) renderizador.desenhar(luz, estado.tecido);
    if ("requestVideoFrameCallback" in luz) {
        luz.requestVideoFrameCallback(quadro);
    } else {
        requestAnimationFrame(quadro);
    }
}

function nomeBase(): string {
    const limpo = (estado.sigla || "partido")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return limpo || "partido";
}

function status(texto: string): void {
    $("status").textContent = texto;
}

const faixas = new Map<string, HTMLInputElement>();
function ligarFaixa(id: string, formatar: (v: number) => string, aplicar: (v: number) => void): HTMLInputElement {
    const input = $<HTMLInputElement>(id);
    const saida = document.getElementById(`${id}Valor`);
    const sincronizar = () => {
        const v = Number(input.value);
        if (saida) saida.textContent = formatar(v);
        aplicar(v);
    };
    input.addEventListener("input", sincronizar);
    sincronizar();
    faixas.set(id, input);
    return input;
}

function definirFaixa(id: string, valor: number): void {
    const input = faixas.get(id);
    if (!input) return;
    input.value = String(valor);
    input.dispatchEvent(new Event("input"));
}

function definirCor(hex: string): void {
    const normal = hex.startsWith("#") ? hex : `#${hex}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(normal)) return;
    estado.cor = normal.toUpperCase();
    $<HTMLInputElement>("corPicker").value = estado.cor.toLowerCase();
    if (document.activeElement !== $("corHex")) $<HTMLInputElement>("corHex").value = estado.cor;
    atualizarArte();
    atualizarModal();
}

async function lerLogo(): Promise<void> {
    if (!estado.arquivoLogo) return;
    try {
        const { imagem } = await carregarLogo(estado.arquivoLogo, $<HTMLInputElement>("removerBranco").checked);
        estado.logo = imagem;
        $("uploadTexto").textContent = estado.arquivoLogo.name;
        atualizarCamadas();
        atualizarArte();
        status("");
    } catch {
        status("Não foi possível abrir esse arquivo de logo.");
    }
}

function tirarLogo(): void {
    estado.logo = null;
    estado.arquivoLogo = null;
    $<HTMLInputElement>("logo").value = "";
    $("uploadTexto").textContent = "Escolher arquivo (PNG ou SVG com fundo transparente)";
    if (estado.selecionado === ID_LOGO) estado.selecionado = null;
    atualizarCamadas();
    atualizarArte();
}

$<HTMLInputElement>("sigla").addEventListener("input", (e) => {
    estado.sigla = (e.target as HTMLInputElement).value.trim();
    atualizarModal();
});

$<HTMLInputElement>("logo").addEventListener("change", (e) => {
    const arquivo = (e.target as HTMLInputElement).files?.[0];
    if (!arquivo) return;
    estado.arquivoLogo = arquivo;
    void lerLogo();
});

const area = $("uploadArea");
area.addEventListener("dragover", (e) => {
    e.preventDefault();
    area.classList.add("arrastando");
});
area.addEventListener("dragleave", () => area.classList.remove("arrastando"));
area.addEventListener("drop", (e) => {
    e.preventDefault();
    area.classList.remove("arrastando");
    const arquivo = e.dataTransfer?.files?.[0];
    if (!arquivo) return;
    estado.arquivoLogo = arquivo;
    void lerLogo();
});

$("tirarLogo").addEventListener("click", tirarLogo);
$<HTMLInputElement>("removerBranco").addEventListener("change", () => void lerLogo());
$<HTMLInputElement>("corPicker").addEventListener("input", (e) => definirCor((e.target as HTMLInputElement).value));
$<HTMLInputElement>("corHex").addEventListener("input", (e) => definirCor((e.target as HTMLInputElement).value.trim()));

document.querySelectorAll<HTMLInputElement>('input[name="texto"]').forEach((radio) =>
    radio.addEventListener("change", () => {
        estado.texto = radio.value as typeof estado.texto;
        atualizarModal();
    }),
);

document.querySelectorAll<HTMLButtonElement>("[data-modelo]").forEach((botao) =>
    botao.addEventListener("click", () => {
        const claro = luminancia(estado.cor) < 0.45;
        const contraste = claro ? "#FFFFFF" : "#1F2937";
        const novas =
            botao.dataset.modelo === "tresFaixas"
                ? modeloTresFaixas(["#111111", "#FFFFFF", estado.cor])
                : botao.dataset.modelo === "diagonal"
                  ? modeloDiagonal(contraste)
                  : modeloDuasFaixasV(contraste);
        estado.formas.push(...novas);
        selecionar(novas[novas.length - 1].id);
        atualizarArte();
    }),
);

ligarFaixa("tamanho", (v) => `${v}px`, (v) => { estado.tamanho = v; agendarArte(); });
ligarFaixa("posX", (v) => `${v}px`, (v) => { estado.posX = v; agendarArte(); });
ligarFaixa("posY", (v) => `${v > 0 ? "+" : ""}${v}px`, (v) => { estado.posY = v; agendarArte(); });
ligarFaixa("veu", (v) => `${Math.round(v * 100)}%`, (v) => { estado.veu = v; atualizarModal(); });

const faixasTecido: Array<[keyof AjustesTecido, string]> = [
    ["contraste", "contraste"],
    ["brilho", "brilho"],
    ["sombra", "sombra"],
    ["deslocamento", "desloc"],
];
for (const [chave, id] of faixasTecido) {
    ligarFaixa(id, (v) => v.toFixed(2), (v) => { estado.tecido[chave] = v; });
}

$("restaurar").addEventListener("click", () => {
    for (const [chave, id] of faixasTecido) definirFaixa(id, PADRAO_TECIDO[chave]);
});

function travarBotoes(travar: boolean): void {
    for (const id of ["baixarWebm", "baixarMp4", "baixarArte", "baixarConfig"]) {
        const botao = $<HTMLButtonElement>(id);
        botao.disabled = travar || botao.dataset.semSuporte === "1";
    }
}

const BITRATE_GRAVACAO: Record<Qualidade, number> = { leve: 1_000_000, media: 2_500_000, alta: 6_000_000 };

function opcaoMarcada(nome: string): string {
    return document.querySelector<HTMLInputElement>(`input[name="${nome}"]:checked`)?.value ?? "";
}

async function exportar(formato: Formato): Promise<void> {
    if (estado.gravando) return;
    estado.gravando = true;
    travarBotoes(true);
    const qualidade = (opcaoMarcada("qualidade") || "media") as Qualidade;
    const largura = Number(opcaoMarcada("resolucao")) || 1280;
    const altura = Math.round((largura * 366) / 1280 / 2) * 2;
    const nome = `bandeira-${nomeBase()}-${estado.duracao}s${largura === 1280 ? "" : `-${largura}`}.${formato}`;
    const inicio = performance.now();
    try {
        let blob: Blob | null = null;
        if (webCodecsDisponivel()) {
            estado.pausarPrevia = true;
            luz.pause();
            renderizador.redimensionar(largura, altura);
            try {
                blob = await codificarVideo({
                    formato,
                    qualidade,
                    largura,
                    altura,
                    urlLuz: urlLuz(estado.duracao),
                    canvas: canvasBandeira,
                    desenharQuadro: (q) => renderizador.desenhar(q, estado.tecido),
                    aoProgredir: (f) => status(`Gerando ${formato.toUpperCase()}… ${Math.round(f * 100)}%`),
                });
            } catch (erro) {
                console.warn("WebCodecs falhou, usando gravação em tempo real.", erro);
            } finally {
                estado.pausarPrevia = false;
            }
        }
        if (!blob) {
            renderizador.redimensionar(largura, altura);
            blob = await gravarVideo(canvasBandeira, luz, formato, BITRATE_GRAVACAO[qualidade], (f) =>
                status(`Gravando ${formato.toUpperCase()}… ${Math.round(f * 100)}%`),
            );
        }
        baixarBlob(blob, nome);
        const tamanho = blob.size >= 1024 * 1024 ? `${(blob.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(blob.size / 1024)} KB`;
        status(`${formato.toUpperCase()} pronto: ${tamanho}, em ${((performance.now() - inicio) / 1000).toFixed(1)} s.`);
    } catch (erro) {
        status(erro instanceof Error ? erro.message : "Falha ao gerar o vídeo.");
    } finally {
        renderizador.redimensionar(1280, 366);
        if (luz.paused) void luz.play().catch(() => undefined);
        estado.gravando = false;
        travarBotoes(false);
    }
}

for (const [id, formato] of [["baixarWebm", "webm"], ["baixarMp4", "mp4"]] as const) {
    const botao = $<HTMLButtonElement>(id);
    if (!webCodecsDisponivel() && !tipoSuportado(formato)) {
        botao.disabled = true;
        botao.dataset.semSuporte = "1";
        botao.title = `Este navegador não gera ${formato.toUpperCase()}.`;
    }
    botao.addEventListener("click", () => void exportar(formato));
}

document.querySelectorAll<HTMLInputElement>('input[name="duracao"]').forEach((radio) =>
    radio.addEventListener("change", () => {
        estado.duracao = Number(radio.value);
        luz.src = urlLuz(estado.duracao);
        void luz.play().catch(() => undefined);
    }),
);

$("baixarArte").addEventListener("click", () => {
    const arte = criarCanvasArte(configArte(), 720);
    arte.toBlob((blob) => blob && baixarBlob(blob, `arte-${nomeBase()}.png`), "image/png");
});

interface Projeto {
    versao: 1;
    sigla: string;
    cor: string;
    texto: typeof estado.texto;
    textoClaro: boolean;
    veu: number;
    video: string;
    logo: { imagem: string | null; altura: number; x: number; y: number };
    formas: Forma[];
    tecido: AjustesTecido;
}

$("baixarConfig").addEventListener("click", () => {
    const projeto: Projeto = {
        versao: 1,
        sigla: estado.sigla,
        cor: estado.cor,
        texto: estado.texto,
        textoClaro: textoClaro(),
        veu: estado.veu,
        video: `bandeira-${nomeBase()}-${estado.duracao}s.webm`,
        logo: { imagem: estado.logo?.toDataURL("image/png") ?? null, altura: estado.tamanho, x: estado.posX, y: estado.posY },
        formas: estado.formas,
        tecido: estado.tecido,
    };
    baixarBlob(new Blob([JSON.stringify(projeto, null, 2)], { type: "application/json" }), `projeto-${nomeBase()}.json`);
});

async function abrirProjeto(arquivo: File): Promise<void> {
    try {
        const projeto = JSON.parse(await arquivo.text()) as Partial<Projeto>;
        estado.sigla = projeto.sigla ?? "";
        $<HTMLInputElement>("sigla").value = estado.sigla;
        if (projeto.cor) definirCor(projeto.cor);
        estado.texto = projeto.texto ?? "auto";
        const radio = document.querySelector<HTMLInputElement>(`input[name="texto"][value="${estado.texto}"]`);
        if (radio) radio.checked = true;
        if (typeof projeto.veu === "number") definirFaixa("veu", projeto.veu);
        if (projeto.logo) {
            definirFaixa("tamanho", projeto.logo.altura);
            definirFaixa("posX", projeto.logo.x);
            definirFaixa("posY", projeto.logo.y);
        }
        if (projeto.tecido) {
            for (const [chave, id] of faixasTecido) {
                if (typeof projeto.tecido[chave] === "number") definirFaixa(id, projeto.tecido[chave]);
            }
        }
        estado.formas = (projeto.formas ?? []).map((f) => criarForma(f.tipo, f));
        estado.selecionado = null;
        painel.renderizarPropriedades(null);
        if (projeto.logo?.imagem) {
            const resposta = await fetch(projeto.logo.imagem);
            estado.arquivoLogo = new File([await resposta.blob()], "logo do projeto.png", { type: "image/png" });
            $<HTMLInputElement>("removerBranco").checked = false;
            await lerLogo();
        } else {
            tirarLogo();
        }
        atualizarModal();
        atualizarCamadas();
        atualizarArte();
        status(`Projeto "${arquivo.name}" aberto.`);
    } catch {
        status("Não foi possível abrir esse projeto.");
    }
}

$<HTMLInputElement>("abrirProjeto").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (arquivo) void abrirProjeto(arquivo);
    input.value = "";
});

async function carregarExemplo(): Promise<void> {
    try {
        const resposta = await fetch(urlExemplo);
        const arquivo = new File([await resposta.blob()], "exemplo-pt.svg", { type: "image/svg+xml" });
        if (estado.arquivoLogo) return;
        estado.arquivoLogo = arquivo;
        await lerLogo();
        $("uploadTexto").textContent = "Exemplo: logo do PT. Escolha outro arquivo";
    } catch {
        status("");
    }
}


atualizarCamadas();
atualizarArte();
atualizarModal();
quadro();
void carregarExemplo();
