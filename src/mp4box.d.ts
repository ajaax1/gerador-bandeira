declare module "mp4box" {
    export interface Mp4Amostra {
        is_sync: boolean;
        cts: number;
        duration: number;
        timescale: number;
        data: Uint8Array;
    }

    export interface Mp4Trilha {
        id: number;
        codec: string;
        nb_samples: number;
        video: { width: number; height: number };
    }

    export interface Mp4Info {
        videoTracks: Mp4Trilha[];
    }

    export interface Mp4Caixa {
        write(stream: DataStream): void;
    }

    export interface Mp4Arquivo {
        onReady: (info: Mp4Info) => void;
        onError: (erro: string) => void;
        onSamples: (id: number, usuario: unknown, amostras: Mp4Amostra[]) => void;
        getTrackById(id: number): {
            mdia: { minf: { stbl: { stsd: { entries: Array<{ avcC?: Mp4Caixa; hvcC?: Mp4Caixa; vpcC?: Mp4Caixa }> } } } };
        };
        setExtractionOptions(id: number, usuario?: unknown, opcoes?: { nbSamples?: number }): void;
        start(): void;
        flush(): void;
        appendBuffer(buffer: ArrayBuffer & { fileStart: number }): number;
    }

    export class DataStream {
        static BIG_ENDIAN: boolean;
        constructor(buffer?: ArrayBuffer, offset?: number, endianness?: boolean);
        buffer: ArrayBuffer;
    }

    export function createFile(): Mp4Arquivo;

    const MP4Box: { createFile: typeof createFile; DataStream: typeof DataStream };
    export default MP4Box;
}
