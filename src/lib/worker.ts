/* eslint-disable camelcase */
import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = false;

// Define model factories
// Ensures only one model is created of each type
export class PipelineFactory {
    static task: string | null = null;
    static model: string | undefined = undefined;
    static quantized: boolean | null = null;
    static instance: any = null;

    tokenizer: any;
    model: string | undefined;
    quantized: boolean | null;

    constructor(tokenizer: any, model: string | undefined, quantized: boolean | null) {
        this.tokenizer = tokenizer;
        this.model = model;
        this.quantized = quantized;
    }

    static async getInstance(progress_callback: ((data: any) => void) | null = null): Promise<any> {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                quantized: this.quantized,
                progress_callback,
                revision: this.model && this.model.includes("/whisper-medium") ? "no_attentions" : "main"
            });
        }
        return this.instance;
    }
}

export class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
    static override task: string = "automatic-speech-recognition";
    static override model: string | undefined = undefined;
    static override quantized: boolean | null = null;
}

self.addEventListener("message", async (event: MessageEvent) => {
    console.log('[Worker] Received message:', event.data);
    try {
        const message = event.data;
        console.log('[Worker] Starting transcription...');
        if (message.audio) {
            console.log('[Worker] Audio type:', Object.prototype.toString.call(message.audio), 'Length:', message.audio.byteLength || message.audio.length);
        }
        let transcript = await transcribe(
            message.audio,
            message.model,
            message.multilingual,
            message.quantized,
            message.subtask,
            message.language,
        );
        if (transcript === null) {
            console.error('[Worker] Transcription returned null');
            self.postMessage({
                status: "error",
                task: "automatic-speech-recognition",
                data: 'Transcription failed or returned null.'
            });
            return;
        }
        console.log('[Worker] Transcription complete:', transcript);
        self.postMessage({
            status: "complete",
            task: "automatic-speech-recognition",
            data: transcript,
        });
    } catch (err) {
        console.error('[Worker] Error during transcription:', err);
        self.postMessage({
            status: "error",
            task: "automatic-speech-recognition",
            data: err instanceof Error ? err.message : String(err),
        });
    }
});

export const transcribe = async (
    audio: any,
    model: string,
    multilingual: boolean,
    quantized: boolean,
    subtask: string,
    language: string,
): Promise<any> => {
    // Allowed model names:
    // 'Xenova/whisper-tiny', 'Xenova/whisper-base', 'Xenova/whisper-small', 'Xenova/whisper-medium',
    // 'distil-whisper/distil-medium.en', 'distil-whisper/distil-large-v2'
    // Use the model name as provided.
    let modelName = model;
    const isDistilWhisper = typeof model === "string" && model.startsWith("distil-whisper/");
    const p = AutomaticSpeechRecognitionPipelineFactory;
    if (p.model !== modelName || p.quantized !== quantized) {
        p.model = modelName;
        p.quantized = quantized;
        if (p.instance !== null) {
            (await p.getInstance()).dispose();
            p.instance = null;
        }
    }
    let transcriber: any = await p.getInstance((data: any) => {
        self.postMessage(data);
    });
    const time_precision =
        transcriber.processor.feature_extractor.config.chunk_length /
        transcriber.model.config.max_source_positions;

    // Storage for chunks to be processed. Initialise with an empty chunk.
    let chunks_to_process: Array<{ tokens: any[]; finalised: boolean }> = [
        {
            tokens: [],
            finalised: false,
        },
    ];

    function chunk_callback(chunk: any) {
        let last = chunks_to_process[chunks_to_process.length - 1];
        Object.assign(last, chunk);
        last.finalised = true;
        if (!chunk.is_last) {
            chunks_to_process.push({
                tokens: [],
                finalised: false,
            });
        }
    }

    function callback_function(item: any) {
        let last = chunks_to_process[chunks_to_process.length - 1];
        last.tokens = [...item[0].output_token_ids];
        let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
            time_precision: time_precision,
            return_timestamps: true,
            force_full_sequences: false,
        });
        self.postMessage({
            status: "update",
            task: "automatic-speech-recognition",
            data: data,
        });
    }

    let output = await transcriber(audio, {
        top_k: 0,
        do_sample: false,
        chunk_length_s: isDistilWhisper ? 20 : 30,
        stride_length_s: isDistilWhisper ? 3 : 5,
        language: language,
        task: subtask,
        return_timestamps: true,
        force_full_sequences: false,
        callback_function: callback_function,
        chunk_callback: chunk_callback,
    }).catch((error: any) => {
        self.postMessage({
            status: "error",
            task: "automatic-speech-recognition",
            data: error,
        });
        return null;
    });
    return output;
};
