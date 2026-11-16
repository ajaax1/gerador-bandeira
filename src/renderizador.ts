export const LARGURA = 1280;
export const ALTURA = 366;

export interface AjustesTecido {
    contraste: number;
    brilho: number;
    sombra: number;
    deslocamento: number;
}

const DESLOC_X = 0.03;
const DESLOC_Y = 0.05;

const VERTICE = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENTO = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 cor;
uniform sampler2D u_luz;
uniform sampler2D u_arte;
uniform vec2 u_desloc;
uniform vec2 u_tamanho;
uniform float u_contraste;
uniform float u_brilho;
uniform float u_sombra;
void main() {
  float luz = texture(u_luz, vec2(v_uv.x, v_uv.y * 0.5)).r * 255.0;
  float suave = texture(u_luz, vec2(v_uv.x, 0.5 + v_uv.y * 0.5)).r * 255.0;
  vec2 deslocamento = (suave - 128.0) * u_desloc / u_tamanho;
  vec3 a = texture(u_arte, clamp(v_uv + deslocamento, 0.0, 1.0)).rgb * 255.0;
  float b = clamp(128.0 + (luz - 128.0) * u_contraste, 0.0, 255.0);
  vec3 c = b > 128.0
    ? a + (255.0 - a) * (b - 128.0) / 128.0 * u_brilho
    : a * (1.0 - (128.0 - b) / 128.0 * u_sombra);
  cor = vec4(clamp(c / 255.0, 0.0, 1.0), 1.0);
}`;

function compilar(gl: WebGL2RenderingContext, tipo: number, fonte: string): WebGLShader {
    const shader = gl.createShader(tipo);
    if (!shader) throw new Error("Não foi possível criar o shader.");
    gl.shaderSource(shader, fonte);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? "Erro ao compilar o shader.");
    }
    return shader;
}

function criarTextura(gl: WebGL2RenderingContext): WebGLTexture {
    const textura = gl.createTexture();
    if (!textura) throw new Error("Não foi possível criar a textura.");
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    return textura;
}

export class Renderizador {
    private readonly gl: WebGL2RenderingContext;
    private readonly texLuz: WebGLTexture;
    private readonly texArte: WebGLTexture;
    private readonly uniforms: Record<string, WebGLUniformLocation | null>;

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
        if (!gl) throw new Error("Este navegador não tem WebGL2.");
        this.gl = gl;

        const programa = gl.createProgram();
        if (!programa) throw new Error("Não foi possível criar o programa WebGL.");
        gl.attachShader(programa, compilar(gl, gl.VERTEX_SHADER, VERTICE));
        gl.attachShader(programa, compilar(gl, gl.FRAGMENT_SHADER, FRAGMENTO));
        gl.linkProgram(programa);
        if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(programa) ?? "Erro ao ligar o programa WebGL.");
        }
        gl.useProgram(programa);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const posicao = gl.getAttribLocation(programa, "a_pos");
        gl.enableVertexAttribArray(posicao);
        gl.vertexAttribPointer(posicao, 2, gl.FLOAT, false, 0, 0);

        this.uniforms = Object.fromEntries(
            ["u_luz", "u_arte", "u_desloc", "u_tamanho", "u_contraste", "u_brilho", "u_sombra"].map((nome) => [
                nome,
                gl.getUniformLocation(programa, nome),
            ]),
        );

        this.texLuz = criarTextura(gl);
        this.texArte = criarTextura(gl);
        gl.uniform1i(this.uniforms.u_luz, 0);
        gl.uniform1i(this.uniforms.u_arte, 1);
        gl.uniform2f(this.uniforms.u_tamanho, LARGURA, ALTURA);
        gl.viewport(0, 0, LARGURA, ALTURA);
    }

    atualizarArte(arte: HTMLCanvasElement): void {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.texArte);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, arte);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }

    desenhar(luz: HTMLVideoElement, ajustes: AjustesTecido): void {
        const gl = this.gl;
        if (luz.readyState >= 2) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texLuz);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, luz);
        }
        gl.uniform2f(this.uniforms.u_desloc, DESLOC_X * ajustes.deslocamento, DESLOC_Y * ajustes.deslocamento);
        gl.uniform1f(this.uniforms.u_contraste, ajustes.contraste);
        gl.uniform1f(this.uniforms.u_brilho, ajustes.brilho);
        gl.uniform1f(this.uniforms.u_sombra, ajustes.sombra);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
