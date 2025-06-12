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
    audio: Float32Array;
    multilingual: boolean;
    quantized: boolean;
    subtask: string;
    language?: string;
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

    if (isCancelled) return null; // Don't calculate progress if cancelled

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

// ==================== PIPELINE MANAGEMENT ====================
let transcriberInstance: any = null;
let currentModel: string | null = null;
let currentQuantized: boolean | null = null;
let isCancelled = false; // Flag to indicate if transcription should be cancelled
let pipelineInitialized = false; // Track if pipeline is properly initialized

// Post a message back to the main thread
function postStatus(status: string, data: any = {}) {
    self.postMessage({ status, ...data });
}

async function cleanupPipeline() {
    if (!transcriberInstance) return;

    log(LOG_LEVEL.DEBUG, 'Cleaning up pipeline...');
    const startTime = performance.now();

    try {
        if (typeof transcriberInstance.dispose === 'function') {
            await transcriberInstance.dispose();
        }
        const cleanupTime = ((performance.now() - startTime) / 1000).toFixed(2);
        log(LOG_LEVEL.INFO, `Pipeline cleaned up in ${cleanupTime}s`);
    } catch (error) {
        log(LOG_LEVEL.ERROR, 'Error cleaning up pipeline:', error);
        throw error; // Re-throw to allow caller to handle
    } finally {
        transcriberInstance = null;
        currentModel = null;
        currentQuantized = null;
        pipelineInitialized = false;
    }
}

async function getPipelineInstance(model: string, quantized: boolean, progress_callback?: (data: any) => void) {
    // If we already have the requested pipeline loaded, return it
    if (transcriberInstance && currentModel === model && currentQuantized === quantized) {
        log(LOG_LEVEL.DEBUG, `Reusing existing model instance: ${model}`);
        postStatus('ready', { model });
        return transcriberInstance;
    }

    const startTime = performance.now();
    log(LOG_LEVEL.INFO, `Loading model: ${model} (quantized: ${quantized})`);

    try {
        // Clean up existing pipeline if any
        await cleanupPipeline();

        // Track initialization state
        pipelineInitialized = false;

        // Create new pipeline instance with progress callbacks
        transcriberInstance = await pipeline('automatic-speech-recognition', model, {
            quantized,
            progress_callback: (progress: any) => {
                if (progress_callback) {
                    progress_callback({
                        ...progress,
                        model,
                        quantized,
                        timestamp: new Date().toISOString()
                    });
                }
                if (isCancelled) {
                    log(LOG_LEVEL.INFO, 'Cancellation detected during model loading');
                    throw new TranscriptionError("Model loading cancelled by user");
                }
            },
            revision: model.includes("/whisper-medium") ? "no_attentions" : "main"
        });

        // Update state
        currentModel = model;
        currentQuantized = quantized;
        pipelineInitialized = true;

        const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
        log(LOG_LEVEL.INFO, `Model ${model} loaded in ${loadTime}s`);

        return transcriberInstance;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(LOG_LEVEL.ERROR, `Failed to load model ${model}:`, errorMessage);
        throw new TranscriptionError('Failed to load model', errorMessage);
    }
}

// ==================== MESSAGE HANDLER ====================
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { type, audio, model, multilingual, quantized, subtask, language } = e.data;
    log(LOG_LEVEL.DEBUG, `Received message: ${type}`, { model, multilingual, quantized, hasAudio: !!audio });

    try {
        switch (type) {
            case 'loadModel':
                if (!model) throw new Error('No model specified');
                log(LOG_LEVEL.INFO, `Loading model: ${model} (quantized: ${quantized}, multilingual: ${multilingual})`);
                await getPipelineInstance(model, quantized ?? true, (progress) => {
                    postStatus('progress', {
                        ...progress,
                        name: model,
                        timestamp: new Date().toISOString()
                    });
                });
                postStatus('ready', { model });
                break;

            case 'transcribe':
                if (!audio) throw new Error('No audio data provided');
                if (!model) throw new Error('No model specified');

                isCancelled = false;
                postStatus('transcribing', { model });

                try {
                    log(LOG_LEVEL.INFO, 'Starting transcription', {
                        model,
                        audioLength: audio.length,
                        sampleRate: 16000 // Assuming 16kHz sample rate
                    });

                    const result = await transcribe({
                        model,
                        audio,
                        multilingual: multilingual ?? false,
                        quantized: quantized ?? true,
                        subtask: subtask ?? 'transcribe',
                        language
                    });

                    log(LOG_LEVEL.INFO, 'Transcription completed successfully', {
                        textLength: result?.text?.length || 0,
                        chunksCount: result?.chunks?.length || 0
                    });

                    postStatus('complete', {
                        data: result,
                        model
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    log(LOG_LEVEL.ERROR, `Transcription failed: ${errorMessage}`);
                    throw error; // Re-throw to be caught by the outer try-catch
                }
                break;

            case 'cancel':
                log(LOG_LEVEL.INFO, 'Cancellation requested');
                isCancelled = true;
                await cleanupPipeline();
                postStatus('cancelled');
                break;

            case 'status':
                postStatus(pipelineInitialized ? 'ready' : 'loading', {
                    model: currentModel,
                    message: pipelineInitialized ? 'Model ready' : 'No model loaded'
                });
                break;

            default:
                log(LOG_LEVEL.WARN, `Unknown message type: ${type}`);
                break;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(LOG_LEVEL.ERROR, `Worker error: ${errorMessage}`);
        postStatus('error', {
            error: errorMessage,
            model: currentModel,
            message: `Error: ${errorMessage}`
        });
    }
};

// Notify that the worker is ready
postStatus('ready', { message: 'Worker initialized' });

// ==================== CORE TRANSCRIPTION ====================
const transcribe = async (
    config: TranscriptionConfig
): Promise<TranscriptionOutput | null> => {
    const startTime = performance.now();
    const isDistilWhisper = config.model.startsWith("distil-whisper/");

    try {
        log(LOG_LEVEL.INFO, '=== STARTING TRANSCRIPTION ===', {
            model: config.model,
            language: config.language || 'auto',
            audioLength: config.audio.length,
            isDistilWhisper,
            timestamp: new Date().toISOString()
        });

        if (isCancelled) {
            const message = 'Transcription cancelled before starting';
            log(LOG_LEVEL.INFO, message);
            throw new TranscriptionError(message);
        }

        // Get the pipeline instance
        log(LOG_LEVEL.DEBUG, 'Getting pipeline instance...');
        const transcriber = await getPipelineInstance(config.model, config.quantized, (data: any) => {
            // Forward model loading progress to the main thread
            log(LOG_LEVEL.DEBUG, 'Model loading progress:', data);
            self.postMessage({
                status: 'progress',
                ...data
            });
        });

        if (!transcriber) {
            throw new TranscriptionError("Failed to get transcriber instance");
        }

        log(LOG_LEVEL.DEBUG, 'Pipeline instance obtained', {
            model: config.model,
            modelType: transcriber.constructor.name
        });

        if (isCancelled) {
            log(LOG_LEVEL.INFO, 'Transcription cancelled after pipeline instance check');
            throw new TranscriptionError('Transcription cancelled by user after pipeline check.');
        }

        const time_precision = transcriber.processor.feature_extractor.config.chunk_length /
            transcriber.model.config.max_source_positions;

        log(LOG_LEVEL.DEBUG, 'Audio processing parameters', {
            time_precision,
            sample_rate: transcriber.processor.feature_extractor.config.sampling_rate,
            chunk_length: transcriber.processor.feature_extractor.config.chunk_length,
            max_source_positions: transcriber.model.config.max_source_positions
        });

        let chunks_to_process: TranscriptionChunk[] = [{
            tokens: [],
            finalised: false
        }];

        const chunk_callback = (chunk: any) => {
            log(LOG_LEVEL.DEBUG, 'Chunk callback', {
                chunk,
                chunksCount: chunks_to_process.length
            });

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
            if (isCancelled) {
                log(LOG_LEVEL.INFO, 'Cancellation detected in callback_function');
                throw new TranscriptionError("Transcription cancelled during progress update.");
            }

            if (!item || !Array.isArray(item) || !item[0]) {
                log(LOG_LEVEL.DEBUG, 'Callback received invalid item:', item);
                return;
            }


            const now = performance.now();
            if (progressState.lastUpdateTime &&
                now - progressState.lastUpdateTime < progressState.updateInterval) {
                return;
            }

            const last = chunks_to_process[chunks_to_process.length - 1];
            if (!last) {
                log(LOG_LEVEL.WARN, 'No last chunk available');
                return;
            }


            last.tokens = [...(item[0].output_token_ids || [])];

            const progressData = calculateProgress(chunks_to_process, progressState);
            if (!progressData) {
                log(LOG_LEVEL.DEBUG, 'No progress data available yet');
                return;
            }

            let output = null;
            try {
                if (chunks_to_process.some(c => c.finalised)) {
                    output = transcriber.tokenizer._decode_asr(chunks_to_process, {
                        time_precision,
                        return_timestamps: true,
                        force_full_sequences: false,
                    });
                    log(LOG_LEVEL.DEBUG, 'Decoded output', {
                        textLength: output?.text?.length || 0,
                        chunksCount: output?.chunks?.length || 0
                    });
                }
            } catch (decodeError) {
                log(LOG_LEVEL.ERROR, 'Error decoding ASR output:', decodeError);
                // Don't fail the whole transcription if decoding fails
            }

            self.postMessage({
                status: "update",
                task: "automatic-speech-recognition",
                data: output || { text: '', chunks: [] },
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

        log(LOG_LEVEL.INFO, 'Starting transcription with options', {
            chunk_length_s: isDistilWhisper ? 20 : 30,
            stride_length_s: isDistilWhisper ? 3 : 5,
            language: config.language,
            task: config.subtask
        });

        // Start the transcription
        const result = await transcriber(config.audio, {
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

        log(LOG_LEVEL.INFO, '=== TRANSCRIPTION COMPLETE ===', {
            duration: ((performance.now() - startTime) / 1000).toFixed(2) + 's',
            resultLength: result?.length || 0
        });

        return result || { text: '', chunks: [] };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(LOG_LEVEL.ERROR, 'Transcription failed', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            duration: ((performance.now() - startTime) / 1000).toFixed(2) + 's'
        });
        throw new TranscriptionError(`Transcription failed: ${errorMessage}`, error);
    }
};