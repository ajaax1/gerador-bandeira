import MP4Box, { type Mp4Amostra } from "mp4box";
import { ArrayBufferTarget as AlvoMp4, Muxer as MuxerMp4 } from "mp4-muxer";
import { ArrayBufferTarget as AlvoWebm, Muxer as MuxerWebm } from "webm-muxer";
import type { Formato } from "./exportar";

export type Qualidade = "leve" | "media" | "alta";

export interface OpcoesCodificacao {
    formato: Formato;
    qualidade: Qualidade;
    largura: number;
    altura: number;
    urlLuz: string;
    desenharQuadro: (quadro: VideoFrame) => void;
    canvas: HTMLCanvasElement;
    aoProgredir: (fracao: number) => void;
    sinal?: AbortSignal;
}

const QUADROS_POR_SEGUNDO = 24;

const BITRATE: Record<Formato, Record<Qualidade, number>> = {
    webm: { leve: 250_000, media: 450_000, alta: 900_000 },
    mp4: { leve: 350_000, media: 650_000, alta: 1_300_000 },
};

const CODECS: Record<Formato, string[]> = {
    webm: ["vp09.00.31.08", "vp09.00.40.08", "vp8"],
    mp4: ["avc1.640028", "avc1.4d0028", "avc1.42e028"],
};

export function webCodecsDisponivel(): boolean {
    return typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined" && typeof VideoFrame !== "undefined";
}

async function escolherConfig(formato: Formato, qualidade: Qualidade, largura: number, altura: number) {
    for (const codec of CODECS[formato]) {
        const base: VideoEncoderConfig = {
            codec,
            width: largura,
            height: altura,
            framerate: QUADROS_POR_SEGUNDO,
            latencyMode: "quality",
            ...(codec.startsWith("avc1") ? { avc: { format: "avc" as const } } : {}),
        };
        const pixels = (largura * altura) / (1280 * 366);
        const config = { ...base, bitrate: Math.round(BITRATE[formato][qualidade] * pixels), bitrateMode: "variable" as VideoEncoderBitrateMode };
        if ((await VideoEncoder.isConfigSupported(config)).supported) return { config, codec };
    }
    throw new Error(`Este navegador não codifica ${formato.toUpperCase()}.`);
}

async function lerAmostras(url: string): Promise<{ config: VideoDecoderConfig; amostras: Mp4Amostra[] }> {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error("Não foi possível carregar o tecido.");
    const buffer = (await resposta.arrayBuffer()) as ArrayBuffer & { fileStart: number };
    buffer.fileStart = 0;

    return new Promise((resolve, reject) => {
        const arquivo = MP4Box.createFile();
        const amostras: Mp4Amostra[] = [];
        let config: VideoDecoderConfig | null = null;
        let total = 0;
        arquivo.onError = (erro) => reject(new Error(erro));
        arquivo.onReady = (info) => {
            const trilha = info.videoTracks[0];
            if (!trilha) {
                reject(new Error("O tecido não tem trilha de vídeo."));
                return;
            }
            total = trilha.nb_samples;
            const entrada = arquivo.getTrackById(trilha.id).mdia.minf.stbl.stsd.entries[0];
            const caixa = entrada.avcC ?? entrada.hvcC ?? entrada.vpcC;
            let descricao: Uint8Array | undefined;
            if (caixa) {
                const fluxo = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
                caixa.write(fluxo);
                descricao = new Uint8Array(fluxo.buffer, 8);
            }
            config = {
                codec: trilha.codec,
                codedWidth: trilha.video.width,
                codedHeight: trilha.video.height,
                description: descricao,
            };
            arquivo.setExtractionOptions(trilha.id, null, { nbSamples: Infinity });
            arquivo.start();
        };
        arquivo.onSamples = (_id, _usuario, novas) => {
            amostras.push(...novas);
            if (config && amostras.length >= total) resolve({ config, amostras });
        };
        arquivo.appendBuffer(buffer);
        arquivo.flush();
        setTimeout(() => {
            if (config && amostras.length) resolve({ config, amostras });
            else reject(new Error("Não foi possível ler o tecido."));
        }, 5000);
    });
}

async function esperar(condicao: () => boolean): Promise<void> {
    while (!condicao()) await new Promise((r) => setTimeout(r, 4));
}

export async function codificarVideo(op: OpcoesCodificacao): Promise<Blob> {
    const { config: configEnc, codec } = await escolherConfig(op.formato, op.qualidade, op.largura, op.altura);
    const { config: configDec, amostras } = await lerAmostras(op.urlLuz);
    const total = amostras.length;

    const alvoMp4 = new AlvoMp4();
    const alvoWebm = new AlvoWebm();
    const muxer =
        op.formato === "mp4"
            ? new MuxerMp4({
                  target: alvoMp4,
                  video: { codec: "avc", width: op.largura, height: op.altura, frameRate: QUADROS_POR_SEGUNDO },
                  fastStart: "in-memory",
              })
            : new MuxerWebm({
                  target: alvoWebm,
                  video: { codec: codec === "vp8" ? "V_VP8" : "V_VP9", width: op.largura, height: op.altura, frameRate: QUADROS_POR_SEGUNDO },
              });

    let erro: Error | null = null;
    let codificados = 0;
    const encoder = new VideoEncoder({
        output: (pedaco, meta) => {
            muxer.addVideoChunk(pedaco, meta);
            codificados += 1;
            op.aoProgredir(codificados / total);
        },
        error: (e) => {
            erro = e instanceof Error ? e : new Error(String(e));
        },
    });
    encoder.configure(configEnc);

    const duracaoQuadro = 1_000_000 / QUADROS_POR_SEGUNDO;
    let indice = 0;
    const decoder = new VideoDecoder({
        output: (quadroLuz) => {
            try {
                op.desenharQuadro(quadroLuz);
            } finally {
                quadroLuz.close();
            }
            const quadro = new VideoFrame(op.canvas, { timestamp: Math.round(indice * duracaoQuadro), duration: Math.round(duracaoQuadro) });
            const opcoes: VideoEncoderEncodeOptions = { keyFrame: indice % (QUADROS_POR_SEGUNDO * 2) === 0 };
            encoder.encode(quadro, opcoes);
            quadro.close();
            indice += 1;
        },
        error: (e) => {
            erro = e instanceof Error ? e : new Error(String(e));
        },
    });
    decoder.configure(configDec);

    for (const amostra of amostras) {
        if (erro) throw erro;
        if (op.sinal?.aborted) throw new Error("Exportação cancelada.");
        await esperar(() => decoder.decodeQueueSize < 4 && encoder.encodeQueueSize < 6);
        decoder.decode(
            new EncodedVideoChunk({
                type: amostra.is_sync ? "key" : "delta",
                timestamp: (1_000_000 * amostra.cts) / amostra.timescale,
                duration: (1_000_000 * amostra.duration) / amostra.timescale,
                data: amostra.data,
            }),
        );
    }
    await decoder.flush();
    await encoder.flush();
    decoder.close();
    encoder.close();
    if (erro) throw erro;
    muxer.finalize();

    const buffer = op.formato === "mp4" ? alvoMp4.buffer : alvoWebm.buffer;
    return new Blob([buffer], { type: op.formato === "mp4" ? "video/mp4" : "video/webm" });
}
