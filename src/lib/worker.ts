/* eslint-disable camelcase */
import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = false;

// ==================== TYPES ====================
interface TranscriptionChunk {
    tokens: any[];
    finalised: boolean;
}

interface TranscriptionOutput {
    text: string;
    chunks?: any[];
}

interface WorkerMessage {
    type?: string;
    audio?: any;
    model?: string;
    multilingual?: boolean;
    quantized?: boolean;
    subtask?: string;
    language?: string;
}

interface ProgressState {
    startTime: number | null;
    lastUpdateTime: number | null;
    smoothedProgress: number;
    updateInterval: number;
    minProgressStep: number;
    lastProgress: number;
}

interface ProgressData {
    progress: number;
    timeElapsed: number;
    estimatedTotal: number | null;
}

interface TranscriptionConfig {
    model: string;
    multilingual: boolean;
    quantized: boolean;
    subtask: string;
    language: string;
}

// ==================== CONSTANTS ====================
const LOG_LEVEL = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const DEFAULT_CONFIG = {
    updateInterval: 200,
    minProgressStep: 1,
    maxRetainedChunks: 5,
    logLevel: LOG_LEVEL.INFO
};

// ==================== UTILITIES ====================
class TranscriptionError extends Error {
    constructor(message: string, public readonly details?: any) {
        super(message);
        this.name = 'TranscriptionError';
    }
}

const progressState: ProgressState = {
    startTime: null,
    lastUpdateTime: null,
    smoothedProgress: 0,
    updateInterval: DEFAULT_CONFIG.updateInterval,
    minProgressStep: DEFAULT_CONFIG.minProgressStep,
    lastProgress: 0
};

let logLevel = DEFAULT_CONFIG.logLevel;

function log(level: number, message: string, data?: any) {
    if (level >= logLevel) {
        const prefix = `[Worker] ${new Date().toISOString()}`;
        console[level === LOG_LEVEL.ERROR ? 'error' :
            level === LOG_LEVEL.WARN ? 'warn' : 'log'](
                `${prefix} ${message}`, data || ''
            );
    }
}

// ==================== PROGRESS CALCULATION ====================
function calculateProgress(
    chunks: TranscriptionChunk[],
    state: ProgressState
): ProgressData | null {
    const now = performance.now();
    if (!state.startTime) state.startTime = now;

    const finalized = chunks.filter(c => c.finalised).length;
    const total = chunks.length;

    const rawProgress = total > 0
        ? Math.min(100, (finalized / (total * 0.9)) * 100)
        : 0;

    state.smoothedProgress = 0.7 * state.smoothedProgress + 0.3 * rawProgress;
    const progress = Math.round(state.smoothedProgress);

    // Skip if progress change is too small
    if (Math.abs(progress - state.lastProgress) < state.minProgressStep && progress !== 100) {
        return null;
    }

    state.lastProgress = progress;

    const elapsed = (now - (state.startTime || now)) / 1000;
    let estimate = null;
    if (state.smoothedProgress > 5) {
        estimate = elapsed / (state.smoothedProgress / 100);
    }

    return {
        progress,
        timeElapsed: Math.round(elapsed),
        estimatedTotal: estimate ? Math.round(estimate) : null
    };
}

// ==================== PIPELINE FACTORY ====================
export class PipelineFactory {
    static task: string | null = null;
    static model: string | undefined = undefined;
    static quantized: boolean | null = null;
    static instance: any = null;

    static async getInstance(progress_callback?: (data: any) => void): Promise<any> {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                quantized: this.quantized,
                progress_callback,
                revision: this.model?.includes("/whisper-medium") ? "no_attentions" : "main"
            });
        }
        return this.instance;
    }

    static async cleanup() {
        if (this.instance) {
            await this.instance.dispose();
            this.instance = null;
        }
    }
}

export class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
    static override task = "automatic-speech-recognition";
    static override model: string | undefined = undefined;
    static override quantized: boolean | null = null;
}

// ==================== WORKER HANDLER ====================
self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
    try {
        const message = event.data;

        if (message.type === 'status') {
            self.postMessage({
                status: "ready",
                task: "automatic-speech-recognition",
                model: AutomaticSpeechRecognitionPipelineFactory.model || 'Xenova/whisper-tiny',
            });
            return;
        }

        if (!message.audio) {
            throw new TranscriptionError("No audio provided for transcription");
        }

        log(LOG_LEVEL.INFO, "Starting transcription", {
            model: message.model,
            language: message.language,
            audioLength: message.audio.byteLength || message.audio.length
        });

        const transcript = await transcribe({
            audio: message.audio,
            model: message.model || 'Xenova/whisper-tiny',
            multilingual: message.multilingual || false,
            quantized: message.quantized || false,
            subtask: message.subtask || 'transcribe',
            language: message.language || undefined
        });

        if (!transcript) {
            throw new TranscriptionError("Transcription returned null");
        }

        log(LOG_LEVEL.DEBUG, "Transcription complete", transcript);
        self.postMessage({
            status: "complete",
            task: "automatic-speech-recognition",
            data: transcript,
        });
    } catch (err) {
        const error = err instanceof TranscriptionError
            ? err
            : new TranscriptionError('Transcription failed', err instanceof Error ? err.message : String(err));

        log(LOG_LEVEL.ERROR, error.message, error.details);
        self.postMessage({
            status: "error",
            task: "automatic-speech-recognition",
            error: {
                message: error.message,
                details: error.details
            }
        });
    }
});

// ==================== CORE TRANSCRIPTION ====================
export const transcribe = async (
    config: TranscriptionConfig
): Promise<TranscriptionOutput | null> => {
    // Reset progress state for new transcription
    progressState.startTime = null;
    progressState.lastProgress = 0;
    progressState.smoothedProgress = 0;

    const isDistilWhisper = config.model.startsWith("distil-whisper/");
    const p = AutomaticSpeechRecognitionPipelineFactory;

    // Handle model switching
    if (p.model !== config.model || p.quantized !== config.quantized) {
        await p.cleanup();
        p.model = config.model;
        p.quantized = config.quantized;
    }

    const transcriber = await p.getInstance((data: any) => {
        self.postMessage(data);
    });

    const time_precision = transcriber.processor.feature_extractor.config.chunk_length /
        transcriber.model.config.max_source_positions;

    let chunks_to_process: TranscriptionChunk[] = [{
        tokens: [],
        finalised: false
    }];

    const chunk_callback = (chunk: any) => {
        const last = chunks_to_process[chunks_to_process.length - 1];
        Object.assign(last, chunk);
        last.finalised = true;

        if (!chunk.is_last) {
            chunks_to_process.push({
                tokens: [],
                finalised: false
            });
        }

        // Cleanup old chunks
        if (chunks_to_process.length > DEFAULT_CONFIG.maxRetainedChunks) {
            chunks_to_process = chunks_to_process.slice(-DEFAULT_CONFIG.maxRetainedChunks);
        }
    };

    const callback_function = (item: any) => {
        const now = performance.now();
        if (progressState.lastUpdateTime &&
            now - progressState.lastUpdateTime < progressState.updateInterval) {
            return;
        }

        const last = chunks_to_process[chunks_to_process.length - 1];
        last.tokens = [...item[0].output_token_ids];

        const progressData = calculateProgress(chunks_to_process, progressState);
        if (!progressData) return;

        const output = chunks_to_process.some(c => c.finalised)
            ? transcriber.tokenizer._decode_asr(chunks_to_process, {
                time_precision,
                return_timestamps: true,
                force_full_sequences: false,
            })
            : null;

        self.postMessage({
            status: "update",
            task: "automatic-speech-recognition",
            data: output,
            progress: progressData.progress,
            time: {
                elapsed: progressData.timeElapsed,
                remaining: progressData.estimatedTotal
                    ? Math.max(0, progressData.estimatedTotal - progressData.timeElapsed)
                    : null
            }
        });

        progressState.lastUpdateTime = now;
    };

    try {
        return await transcriber(config.audio, {
            top_k: 0,
            do_sample: false,
            chunk_length_s: isDistilWhisper ? 20 : 30,
            stride_length_s: isDistilWhisper ? 3 : 5,
            language: config.language,
            task: config.subtask,
            return_timestamps: true,
            force_full_sequences: false,
            callback_function,
            chunk_callback,
        });
    } catch (error) {
        throw new TranscriptionError("Transcription failed", error);
    }
};