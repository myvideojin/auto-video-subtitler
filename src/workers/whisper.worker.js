// We use the CDN directly in the worker via dynamic import to bypass Vite/Rollup bundling issues
let pipeline, env;

class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny'; // Multilingual model
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (!pipeline) {
            const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
            pipeline = transformers.pipeline;
            env = transformers.env;
            env.allowLocalModels = false;
        }

        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { audioData } = event.data;

    try {
        const transcriber = await PipelineSingleton.getInstance((prog) => {
            self.postMessage({ status: 'progress', data: prog });
        });

        const output = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true,
            callback_function: (beams) => {
                // This fires when a new token is generated, proving it's not stuck
                self.postMessage({ status: 'decoding', text: beams[0].output_token_ids });
            }
        });

        self.postMessage({ status: 'complete', output });
    } catch (error) {
        self.postMessage({ status: 'error', error: error.message });
    }
});
