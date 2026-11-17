export type Formato = "webm" | "mp4";

const CANDIDATOS: Record<Formato, string[]> = {
    webm: ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"],
    mp4: ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4"],
};

export function tipoSuportado(formato: Formato): string | null {
    if (typeof MediaRecorder === "undefined") return null;
    return CANDIDATOS[formato].find((tipo) => MediaRecorder.isTypeSupported(tipo)) ?? null;
}

export function baixarBlob(blob: Blob, nome: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function gravarVideo(
    canvas: HTMLCanvasElement,
    luz: HTMLVideoElement,
    formato: Formato,
    bitsPorSegundo: number,
    aoProgredir: (fracao: number) => void,
): Promise<Blob> {
    const tipo = tipoSuportado(formato);
    if (!tipo) throw new Error(`Este navegador não grava ${formato.toUpperCase()}.`);

    const fluxo = canvas.captureStream(30);
    const gravador = new MediaRecorder(fluxo, { mimeType: tipo, videoBitsPerSecond: bitsPorSegundo });
    const partes: Blob[] = [];
    gravador.ondataavailable = (e) => {
        if (e.data.size > 0) partes.push(e.data);
    };

    const loopAntes = luz.loop;
    luz.loop = false;
    luz.pause();
    luz.currentTime = 0;
    await new Promise<void>((resolve) => luz.addEventListener("seeked", () => resolve(), { once: true }));

    const fim = new Promise<void>((resolve) => {
        const progresso = () => aoProgredir(Math.min(1, luz.currentTime / (luz.duration || 8)));
        luz.addEventListener("timeupdate", progresso);
        luz.addEventListener(
            "ended",
            () => {
                luz.removeEventListener("timeupdate", progresso);
                resolve();
            },
            { once: true },
        );
    });

    const parado = new Promise<void>((resolve) => {
        gravador.onstop = () => resolve();
    });

    gravador.start(250);
    await luz.play();
    await fim;
    gravador.stop();
    await parado;
    fluxo.getTracks().forEach((t) => t.stop());

    luz.loop = loopAntes;
    luz.currentTime = 0;
    void luz.play();

    return new Blob(partes, { type: tipo.split(";")[0] });
}
