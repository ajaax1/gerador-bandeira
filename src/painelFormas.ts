import { FONTES, NOMES_FORMA, type Forma, type TipoForma } from "./formas";

const ICONES: Record<TipoForma, string> = {
    retangulo: '<rect x="3" y="6" width="18" height="12" rx="1.5"/>',
    elipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
    triangulo: '<path d="M12 4 21 19H3Z"/>',
    losango: '<path d="M12 3 21 12 12 21 3 12Z"/>',
    estrela: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7Z"/>',
    faixaH: '<rect x="2" y="9" width="20" height="6"/>',
    faixaV: '<rect x="9" y="2" width="6" height="20"/>',
    texto: '<path d="M5 6h14M12 6v13M9 19h6"/>',
};

const ICONES_ACAO = {
    subir: '<path d="m6 15 6-6 6 6"/>',
    descer: '<path d="m6 9 6 6 6-6"/>',
    duplicar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    excluir: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};

function svg(caminho: string): string {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${caminho}</svg>`;
}

export interface AcoesPainel {
    adicionar: (tipo: TipoForma) => void;
    selecionar: (id: string | null) => void;
    mover: (id: string, direcao: 1 | -1) => void;
    duplicar: (id: string) => void;
    remover: (id: string) => void;
    alterar: () => void;
}

interface CampoNumero {
    chave: "x" | "y" | "largura" | "altura" | "rotacao" | "opacidade" | "raio";
    rotulo: string;
    min: number;
    max: number;
    passo: number;
}

function camposPara(forma: Forma): CampoNumero[] {
    const campos: CampoNumero[] = [];
    if (forma.tipo !== "faixaH") campos.push({ chave: "x", rotulo: "Posição horizontal", min: -200, max: 1480, passo: 1 });
    if (forma.tipo !== "faixaV") campos.push({ chave: "y", rotulo: "Posição vertical", min: -360, max: 360, passo: 1 });
    if (forma.tipo === "faixaH" || forma.tipo === "faixaV") {
        campos.push({ chave: "x", rotulo: "Centro do giro", min: 0, max: 1280, passo: 1 });
    }
    if (forma.tipo !== "faixaH" && forma.tipo !== "texto") campos.push({ chave: "largura", rotulo: "Largura", min: 4, max: 1400, passo: 1 });
    if (forma.tipo !== "faixaV") {
        campos.push({ chave: "altura", rotulo: forma.tipo === "texto" ? "Tamanho da letra" : "Altura", min: 4, max: 800, passo: 1 });
    }
    campos.push({ chave: "rotacao", rotulo: "Rotação (graus)", min: -180, max: 180, passo: 1 });
    campos.push({ chave: "opacidade", rotulo: "Opacidade", min: 0, max: 1, passo: 0.05 });
    if (forma.tipo === "retangulo") campos.push({ chave: "raio", rotulo: "Arredondar cantos", min: 0, max: 300, passo: 1 });
    const vistos = new Set<string>();
    return campos.filter((c) => (vistos.has(c.chave) ? false : (vistos.add(c.chave), true)));
}

export class PainelFormas {
    private formaAtual: Forma | null = null;
    private readonly entradas = new Map<string, HTMLInputElement[]>();

    constructor(
        private readonly areaAdicionar: HTMLElement,
        private readonly lista: HTMLUListElement,
        private readonly areaPropriedades: HTMLElement,
        private readonly acoes: AcoesPainel,
    ) {
        for (const tipo of Object.keys(NOMES_FORMA) as TipoForma[]) {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "botaoForma";
            botao.title = `Adicionar ${NOMES_FORMA[tipo].toLowerCase()}`;
            botao.innerHTML = `${svg(ICONES[tipo])}<span>${NOMES_FORMA[tipo]}</span>`;
            botao.addEventListener("click", () => this.acoes.adicionar(tipo));
            this.areaAdicionar.appendChild(botao);
        }
    }

    renderizarCamadas(formas: Forma[], selecionado: string | null, temLogo: boolean, idLogo: string): void {
        this.lista.replaceChildren();
        if (temLogo) {
            const li = document.createElement("li");
            li.className = `camada${selecionado === idLogo ? " ativa" : ""}`;
            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "camadaNome";
            botao.innerHTML = `<span class="amostra amostraLogo" aria-hidden="true"></span><span>Logo</span>`;
            botao.addEventListener("click", () => this.acoes.selecionar(idLogo));
            li.appendChild(botao);
            this.lista.appendChild(li);
        }
        if (!formas.length) {
            const vazio = document.createElement("li");
            vazio.className = "camadaVazia";
            vazio.textContent = "Nenhuma forma ainda. Use os botões acima.";
            this.lista.appendChild(vazio);
            return;
        }
        [...formas].reverse().forEach((forma, indiceInvertido) => {
            const indice = formas.length - 1 - indiceInvertido;
            const li = document.createElement("li");
            li.className = `camada${forma.id === selecionado ? " ativa" : ""}`;
            const nome = document.createElement("button");
            nome.type = "button";
            nome.className = "camadaNome";
            const titulo = forma.tipo === "texto" ? `Texto "${forma.texto}"` : NOMES_FORMA[forma.tipo];
            nome.innerHTML = `<span class="amostra" style="background:${forma.cor}" aria-hidden="true"></span>`;
            const rotulo = document.createElement("span");
            rotulo.textContent = titulo;
            nome.appendChild(rotulo);
            nome.addEventListener("click", () => this.acoes.selecionar(forma.id));
            li.appendChild(nome);
            const acoes: Array<[keyof typeof ICONES_ACAO, string, () => void, boolean]> = [
                ["subir", "Trazer para frente", () => this.acoes.mover(forma.id, 1), indice === formas.length - 1],
                ["descer", "Mandar para trás", () => this.acoes.mover(forma.id, -1), indice === 0],
                ["duplicar", "Duplicar", () => this.acoes.duplicar(forma.id), false],
                ["excluir", "Excluir", () => this.acoes.remover(forma.id), false],
            ];
            for (const [icone, rotuloAcao, fazer, desabilitado] of acoes) {
                const b = document.createElement("button");
                b.type = "button";
                b.className = `iconeAcao${icone === "excluir" ? " perigo" : ""}`;
                b.setAttribute("aria-label", `${rotuloAcao}: ${titulo}`);
                b.title = rotuloAcao;
                b.disabled = desabilitado;
                b.innerHTML = svg(ICONES_ACAO[icone]);
                b.addEventListener("click", fazer);
                li.appendChild(b);
            }
            this.lista.appendChild(li);
        });
    }

    renderizarPropriedades(forma: Forma | null): void {
        this.formaAtual = forma;
        this.entradas.clear();
        this.areaPropriedades.replaceChildren();
        if (!forma) return;

        const titulo = document.createElement("h3");
        titulo.textContent = `Editar ${NOMES_FORMA[forma.tipo].toLowerCase()}`;
        this.areaPropriedades.appendChild(titulo);

        if (forma.tipo === "texto") {
            const campo = this.criarCampo("Texto");
            const input = document.createElement("input");
            input.type = "text";
            input.value = forma.texto;
            input.maxLength = 40;
            input.setAttribute("aria-label", "Texto");
            input.addEventListener("input", () => {
                forma.texto = input.value;
                this.acoes.alterar();
            });
            campo.appendChild(input);

            const campoFonte = this.criarCampo("Fonte");
            const select = document.createElement("select");
            select.setAttribute("aria-label", "Fonte");
            for (const f of FONTES) {
                const opcao = document.createElement("option");
                opcao.value = f.valor;
                opcao.textContent = f.nome;
                opcao.selected = f.valor === forma.fonte;
                select.appendChild(opcao);
            }
            select.addEventListener("change", () => {
                forma.fonte = select.value;
                this.acoes.alterar();
            });
            campoFonte.appendChild(select);

            const estilos = document.createElement("div");
            estilos.className = "estilosTexto";
            for (const [chave, rotulo] of [["negrito", "Negrito"], ["italico", "Itálico"]] as const) {
                const label = document.createElement("label");
                label.className = "check";
                const check = document.createElement("input");
                check.type = "checkbox";
                check.checked = forma[chave];
                check.addEventListener("change", () => {
                    forma[chave] = check.checked;
                    this.acoes.alterar();
                });
                const texto = document.createElement("span");
                texto.textContent = rotulo;
                label.append(check, texto);
                estilos.appendChild(label);
            }
            this.areaPropriedades.appendChild(estilos);
        }

        const campoCor = this.criarCampo("Cor");
        const linhaCor = document.createElement("div");
        linhaCor.className = "cor";
        const picker = document.createElement("input");
        picker.type = "color";
        picker.value = forma.cor.toLowerCase();
        picker.setAttribute("aria-label", "Cor da forma");
        const hex = document.createElement("input");
        hex.type = "text";
        hex.value = forma.cor.toUpperCase();
        hex.maxLength = 7;
        hex.spellcheck = false;
        hex.setAttribute("aria-label", "Cor da forma em hexadecimal");
        const aplicarCor = (valor: string) => {
            const normal = valor.startsWith("#") ? valor : `#${valor}`;
            if (!/^#[0-9a-fA-F]{6}$/.test(normal)) return;
            forma.cor = normal.toUpperCase();
            picker.value = forma.cor.toLowerCase();
            if (document.activeElement !== hex) hex.value = forma.cor;
            this.acoes.alterar();
        };
        picker.addEventListener("input", () => aplicarCor(picker.value));
        hex.addEventListener("input", () => aplicarCor(hex.value.trim()));
        linhaCor.append(picker, hex);
        campoCor.appendChild(linhaCor);

        for (const c of camposPara(forma)) {
            const campo = this.criarCampo(c.rotulo);
            const linha = document.createElement("div");
            linha.className = "numeroFaixa";
            const faixa = document.createElement("input");
            faixa.type = "range";
            faixa.min = String(c.min);
            faixa.max = String(c.max);
            faixa.step = String(c.passo);
            faixa.setAttribute("aria-label", c.rotulo);
            const numero = document.createElement("input");
            numero.type = "number";
            numero.min = String(c.min);
            numero.max = String(c.max);
            numero.step = String(c.passo);
            numero.setAttribute("aria-label", `${c.rotulo} (valor)`);
            const aplicar = (origem: HTMLInputElement) => {
                const v = Number(origem.value);
                if (Number.isNaN(v)) return;
                forma[c.chave] = v;
                if (origem !== faixa) faixa.value = String(v);
                if (origem !== numero) numero.value = String(v);
                this.acoes.alterar();
            };
            faixa.addEventListener("input", () => aplicar(faixa));
            numero.addEventListener("input", () => aplicar(numero));
            faixa.value = numero.value = String(forma[c.chave]);
            linha.append(faixa, numero);
            campo.appendChild(linha);
            this.entradas.set(c.chave, [faixa, numero]);
        }
    }

    sincronizar(): void {
        const forma = this.formaAtual;
        if (!forma) return;
        for (const [chave, inputs] of this.entradas) {
            const valor = String(forma[chave as CampoNumero["chave"]]);
            for (const input of inputs) {
                if (document.activeElement !== input && input.value !== valor) input.value = valor;
            }
        }
    }

    private criarCampo(rotulo: string): HTMLElement {
        const campo = document.createElement("div");
        campo.className = "campo";
        const span = document.createElement("span");
        span.textContent = rotulo;
        campo.appendChild(span);
        this.areaPropriedades.appendChild(campo);
        return campo;
    }
}
