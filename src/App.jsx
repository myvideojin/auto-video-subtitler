import React, { useState, useRef, useEffect } from 'react';
import ToolFAQ from './components/ToolFAQ';

import BrandedNav from './components/BrandedNav';
import BrandedFooter from './components/BrandedFooter';
import { 
  Upload, Play, Pause, Volume2, VolumeX,
  Settings, Video, FileText, FileVideo,
  SkipBack, SkipForward, Repeat, Loader2, CheckCircle2, AlertCircle, AlertTriangle
} from 'lucide-react';
import { useToolUsage } from './hooks/useToolUsage';

export default function AutoSubtitler() {
  const { checkUsage, incrementUsage } = useToolUsage();

  const faqs = [
    {
      "question": "What languages are supported by the Auto Subtitler?",
      "answer": "Our AI model currently detects and transcribes English with high accuracy, with multi-language support coming soon."
    },
    {
      "question": "Does this tool upload my video to a server?",
      "answer": "No, all transcription and subtitle generation happens entirely in your browser using local AI logic for maximum privacy."
    },
    {
      "question": "Can I download the SRT file?",
      "answer": "Yes! You can choose to download the SRT subtitle file, burn the subtitles directly into the video, or both."
    },
    {
      "question": "Are there any file size limits?",
      "answer": "Because this tool runs locally on your device, we recommend videos under 2GB to prevent browser memory exhaustion."
    },
    {
      "question": "Is this tool completely free?",
      "answer": "Yes, you can generate accurate subtitles for free without any watermarks or hidden fees."
    }
  ];

  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  
  // Video state
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLooping, setIsLooping] = useState(true);

  // Subtitler state
  const [outputMode, setOutputMode] = useState('both'); // 'srt', 'burn', 'both'
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('Booting Engine...');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [srtUrl, setSrtUrl] = useState(null);
  const [resultVideoUrl, setResultVideoUrl] = useState(null);
  const [downloadFileName, setDownloadFileName] = useState("");

  const ffmpegRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const loadStarted = useRef(false);

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;

    const loadFFmpeg = async () => {
      try {
        setLoadingMsg("Fetching Engine...");
        const { createFFmpeg } = window.FFmpeg;
        const ffmpeg = createFFmpeg({
           log: true,
           corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
        });
        ffmpegRef.current = ffmpeg;
        await ffmpeg.load();
        setIsReady(true);
        setLoadingMsg('Engine Loaded');
        setError(null);
      } catch (err) {
        console.error("FFmpeg load error:", err);
        setError("Error: " + (err.message || "Failed to initialize WebAssembly."));
        setLoadingMsg("Failed to Load");
      }
    };
    
    setTimeout(() => {
        if (window.FFmpeg) {
            loadFFmpeg();
        } else {
            setError("Global FFmpeg library failed to inject.");
        }
    }, 500);
  }, []);

  // Handle file upload
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type.startsWith('video/')) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setVideoUrl(url);
      setError(null);
    } else {
        setError('Please upload a valid video file.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile);
      const url = URL.createObjectURL(droppedFile);
      setVideoUrl(url);
      setError(null);
    } else {
        setError('Please upload a valid video file.');
    }
  };

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleScrub = (e) => {
    if (videoRef.current) {
      const scrubTime = (e.target.value / 100) * videoRef.current.duration;
      videoRef.current.currentTime = scrubTime;
      setProgress(e.target.value);
    }
  };

  const stepFrame = (forward) => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime += forward ? 0.033 : -0.033;
    }
  };

  const extractAudio = async (videoFile) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const arrayBuffer = await videoFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    let audio;
    if (audioBuffer.numberOfChannels === 2) {
        const SCALING_FACTOR = Math.sqrt(2);
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        audio = new Float32Array(left.length);
        for (let i = 0; i < audioBuffer.length; ++i) {
            audio[i] = SCALING_FACTOR * (left[i] + right[i]) / 2;
        }
    } else {
        audio = audioBuffer.getChannelData(0);
    }
    return audio;
  };

  const formatTime = (time) => {
      const date = new Date(time * 1000);
      const hh = String(date.getUTCHours()).padStart(2, '0');
      const mm = String(date.getUTCMinutes()).padStart(2, '0');
      const ss = String(date.getUTCSeconds()).padStart(2, '0');
      const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
      return `${hh}:${mm}:${ss},${ms}`;
  };

  const handleProcess = async () => {
    if (!checkUsage()) {
      setError("Daily limit reached. Free users can process tools 3 times a day. Please upgrade for unlimited access.");
      return;
    }
    incrementUsage();

    if (!file || !isReady) return;

    if (file.size > 2000 * 1024 * 1024) {
      setError("File is too large for client-side processing. Please use a file under 2GB.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setSrtUrl(null);
    setResultVideoUrl(null);
    setProcessProgress(0);
    setDownloadFileName(file.name.split('.')[0]);

    try {
      setLoadingMsg('Extracting audio track...');
      const audioData = await extractAudio(file);

      setLoadingMsg('Loading AI Model (Whisper)...');
      setProcessProgress(10);
      
      const output = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./workers/whisper.worker.js', import.meta.url), { type: 'module' });
        
        worker.addEventListener('message', (event) => {
            const { status, data, output, error } = event.data;
            if (status === 'progress') {
                if (data.status === 'progress') {
                    setLoadingMsg(`Downloading AI Model (${Math.round(data.progress)}%)...`);
                } else if (data.status === 'ready') {
                    setLoadingMsg('Transcribing audio...');
                    setProcessProgress(30);
                }
            } else if (status === 'decoding') {
                setLoadingMsg((prev) => prev.includes('...') ? 'Transcribing audio.' : prev + '.');
                setProcessProgress((p) => (p < 60 ? p + 0.1 : 60));
            } else if (status === 'complete') {
                worker.terminate();
                resolve(output);
            } else if (status === 'error') {
                worker.terminate();
                reject(new Error(error));
            }
        });

        worker.postMessage({ audioData });
      });

      if (!output.chunks || output.chunks.length === 0) {
        throw new Error("No speech detected in the video.");
      }

      setLoadingMsg('Formatting Subtitles...');
      setProcessProgress(60);

      let srtContent = '';
      output.chunks.forEach((chunk, index) => {
          srtContent += `${index + 1}\n`;
          srtContent += `${formatTime(chunk.timestamp[0])} --> ${formatTime(chunk.timestamp[1] || chunk.timestamp[0] + 2)}\n`;
          srtContent += `${chunk.text.trim()}\n\n`;
      });

      const srtBlob = new Blob([srtContent], { type: 'text/plain' });
      const localSrtUrl = window.URL.createObjectURL(srtBlob);
      
      if (outputMode === 'srt') {
        setSrtUrl(localSrtUrl);
        setResult({ message: 'Transcription complete! Click below to download.' });
      } else {
        const ffmpeg = ffmpegRef.current;
        const { fetchFile } = window.FFmpeg;
        
        setLoadingMsg('Preparing video engine...');
        setProcessProgress(70);
        
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));
        ffmpeg.FS('writeFile', 'subs.srt', new TextEncoder().encode(srtContent));
        
        setLoadingMsg('Fetching fonts...');
        const fontUrl = 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf';
        ffmpeg.FS('writeFile', 'Roboto-Regular.ttf', await fetchFile(fontUrl));

        setLoadingMsg('Burning subtitles into video...');
        
        ffmpeg.setProgress(({ ratio }) => {
          const percent = Math.min(Math.max(Math.round(ratio * 100), 0), 100);
          setProcessProgress(70 + Math.floor(percent * 0.3));
        });

        await ffmpeg.run(
          '-i', 'input.mp4',
          '-vf', "subtitles=subs.srt:fontsdir=/:force_style='Fontname=Roboto,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2'",
          '-c:a', 'copy',
          'output.mp4'
        );

        setLoadingMsg('Finalizing...');
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const localVideoUrl = window.URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        
        setResultVideoUrl(localVideoUrl);
        
        if (outputMode === 'both') {
          setSrtUrl(localSrtUrl);
        }

        setResult({ message: 'Processing complete! Click below to download your files.' });

        ffmpeg.setProgress(() => {});
        ffmpeg.FS('unlink', 'input.mp4');
        ffmpeg.FS('unlink', 'subs.srt');
        ffmpeg.FS('unlink', 'Roboto-Regular.ttf');
        ffmpeg.FS('unlink', 'output.mp4');
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during processing.');
    } finally {
      setIsProcessing(false);
      setProcessProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12">
      
      <script type="application/ld+json">
        {JSON.stringify({'@context': 'https://schema.org', '@graph': [{'@type': 'SoftwareApplication', 'name': 'Videojin Auto Subtitler', 'applicationCategory': 'MultimediaApplication', 'operatingSystem': 'All', 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'}}, {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': 'What languages are supported by the Auto Subtitler?', 'acceptedAnswer': {'@type': 'Answer', 'text': 'Our AI model currently detects and transcribes English with high accuracy, with multi-language support coming soon.'}}, {'@type': 'Question', 'name': 'Does this tool upload my video to a server?', 'acceptedAnswer': {'@type': 'Answer', 'text': 'No, all transcription and subtitle generation happens entirely in your browser using local AI logic for maximum privacy.'}}, {'@type': 'Question', 'name': 'Can I download the SRT file?', 'acceptedAnswer': {'@type': 'Answer', 'text': 'Yes! You can choose to download the SRT subtitle file, burn the subtitles directly into the video, or both.'}}, {'@type': 'Question', 'name': 'Are there any file size limits?', 'acceptedAnswer': {'@type': 'Answer', 'text': 'Because this tool runs locally on your device, we recommend videos under 2GB to prevent browser memory exhaustion.'}}, {'@type': 'Question', 'name': 'Is this tool completely free?', 'acceptedAnswer': {'@type': 'Answer', 'text': 'Yes, you can generate accurate subtitles for free without any watermarks or hidden fees.'}}]}, {'@type': 'HowTo', 'name': 'How to Auto-Subtitle Videos using AI', 'step': [{'@type': 'HowToStep', 'name': 'Upload Video', 'text': 'Upload the video file you want to subtitle.'}, {'@type': 'HowToStep', 'name': 'Select Output Mode', 'text': 'Choose between exporting an SRT file, burning subtitles directly into the video, or generating both.'}, {'@type': 'HowToStep', 'name': 'Generate', 'text': 'Click Generate Subtitles and let our AI automatically detect speech and create accurate captions.'}, {'@type': 'HowToStep', 'name': 'Download', 'text': 'Download your generated SRT file or captioned video instantly.'}]}]})}
      </script>
      <BrandedNav />
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Video className="text-blue-500" /> AI Auto-Subtitler
            </h1>
            <p className="text-gray-400 font-medium">Automatically generate highly accurate captions entirely in your browser.</p>
          </div>
          {videoUrl && !isProcessing && (
            <button 
              onClick={() => { setFile(null); setVideoUrl(null); setResult(null); setError(null); }}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full font-bold text-sm transition-colors border border-white/10"
            >
              Upload New Video
            </button>
          )}
        </div>

        {!videoUrl ? (
          <div 
            className="w-full max-w-3xl mx-auto h-[60vh] border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center p-8 text-center hover:bg-white/5 hover:border-blue-500/50 transition-all cursor-pointer group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              id="video-input" 
              accept="video/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <label htmlFor="video-input" className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
              <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <h2 className="text-2xl font-black mb-2">Select a Video</h2>
              <p className="text-gray-400 max-w-sm">Drag and drop your .mp4 or .mov file here to generate subtitles.</p>
              <div className="mt-8 px-4 py-2 bg-white/5 rounded-full text-xs font-bold text-gray-500 uppercase tracking-widest">
                Local AI Processing • Zero Uploads
              </div>
            </label>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Preview Area */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full bg-black rounded-3xl border border-white/10 shadow-2xl overflow-hidden shrink-0 aspect-video flex items-center justify-center">
                {resultVideoUrl ? (
                  <video 
                    src={resultVideoUrl}
                    className="w-full h-full object-contain bg-zinc-900"
                    controls
                    playsInline
                  />
                ) : (
                  <video 
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain bg-zinc-900"
                    onTimeUpdate={handleTimeUpdate}
                    loop={isLooping}
                    muted={isMuted}
                    playsInline
                  />
                )}
              </div>

              {/* Transport Controls */}
              {!resultVideoUrl && (
                <div className="w-full mt-6 bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => stepFrame(false)} className="p-2 text-gray-400 hover:text-white"><SkipBack size={20} /></button>
                    <button onClick={togglePlay} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                      {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>
                    <button onClick={() => stepFrame(true)} className="p-2 text-gray-400 hover:text-white"><SkipForward size={20} /></button>
                  </div>
                  
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progress}
                    onChange={handleScrub}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  
                  <div className="flex justify-between mt-4">
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-lg ${isMuted ? 'text-red-400 bg-red-400/10' : 'text-gray-400 hover:text-white'}`}>
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button onClick={() => setIsLooping(!isLooping)} className={`p-2 rounded-lg ${isLooping ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:text-white'}`}>
                      <Repeat size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Settings */}
            <div className="w-full lg:w-[350px] space-y-6">
              
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                 <div className="text-blue-200 text-xs">
                   <span className="font-bold text-blue-400">Hardware Notice:</span> 
                   Because this tool runs complex neural networks on your device CPU, videos are limited to 2GB.
                </div>
              </div>

              {/* Settings */}
              {!result && !isProcessing && (
                <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                    <Settings size={16} /> Output Mode
                  </h3>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => setOutputMode('srt')}
                      className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all border ${outputMode === 'srt' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}
                    >
                      <FileText size={18} /> Export SRT
                    </button>
                    <button 
                      onClick={() => setOutputMode('burn')}
                      className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all border ${outputMode === 'burn' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}
                    >
                      <Video size={18} /> Burn-in Video
                    </button>
                    <button 
                      onClick={() => setOutputMode('both')}
                      className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all border ${outputMode === 'both' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}
                    >
                      <FileVideo size={18} /> Generate Both
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}

              {result && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-300 mb-4">{result.message}</p>
                  <div className="flex flex-col gap-3">
                    {resultVideoUrl && (
                      <a 
                        href={resultVideoUrl} 
                        download={`captioned_${downloadFileName}.mp4`}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all text-sm"
                      >
                        <Video size={16} />
                        Download Video
                      </a>
                    )}
                    {srtUrl && (
                      <a 
                        href={srtUrl} 
                        download={`${downloadFileName}.srt`}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all text-sm"
                      >
                        <FileText size={16} />
                        Download SRT
                      </a>
                    )}
                  </div>
                </div>
              )}

              {!result && (
                <button 
                  onClick={handleProcess}
                  disabled={isProcessing || !isReady}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all flex flex-col items-center justify-center gap-2 transform relative overflow-hidden ${
                    isProcessing || !isReady
                      ? 'bg-white/10 text-white/50 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 hover:-translate-y-1'
                  }`}
                >
                  {isProcessing && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300"
                      style={{ width: `${processProgress}%` }}
                    ></div>
                  )}
                  
                  <div className="relative flex items-center gap-2">
                    {(isProcessing || !isReady) ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                    {isProcessing || !isReady ? loadingMsg : 'Generate Subtitles'}
                  </div>
                </button>
              )}

            </div>
          </div>
        )}
      </div>

      {/* SEO Sections */}
      <div className="mt-24 space-y-24 max-w-4xl mx-auto px-4">
        {/* How It Works */}
        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">How to Auto-Subtitle Videos using AI</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-emerald-500/20">1</div>
              <h3 className="text-xl font-bold mb-3 text-emerald-400 mt-2">Upload Video</h3>
              <p className="text-gray-400">Upload the video file you want to subtitle directly in your browser.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">2</div>
              <h3 className="text-xl font-bold mb-3 text-blue-400 mt-2">Select Output Mode</h3>
              <p className="text-gray-400">Choose between exporting an SRT file, burning subtitles into the video, or both.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20">3</div>
              <h3 className="text-xl font-bold mb-3 text-indigo-400 mt-2">Generate</h3>
              <p className="text-gray-400">Click Generate Subtitles and let our AI automatically detect speech and create accurate captions.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-purple-500/20">4</div>
              <h3 className="text-xl font-bold mb-3 text-purple-400 mt-2">Download</h3>
              <p className="text-gray-400">Download your generated SRT file or captioned video instantly.</p>
            </div>
          </div>
        </section>

        {/* Feature Breakdown */}
        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">Why Use Our AI Auto-Subtitler?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Highly Accurate AI</h3>
              <p className="text-gray-400">Powered by Whisper AI to ensure high accuracy for detecting and transcribing speech.</p>
            </div>
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Multiple Output Options</h3>
              <p className="text-gray-400">Export subtitles as SRT files for YouTube, or burn them directly into your video file.</p>
            </div>
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">100% Local Processing</h3>
              <p className="text-gray-400">Everything happens in your browser. Your video files are never uploaded to our servers.</p>
            </div>
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Completely Free</h3>
              <p className="text-gray-400">Enjoy fast and reliable subtitle generation without paywalls or subscriptions.</p>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">Built for Content Creators & Professionals</h2>
          <div className="space-y-6">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="md:w-1/3">
                <h3 className="text-xl font-bold mb-2">Content Creators</h3>
              </div>
              <div className="md:w-2/3">
                <p className="text-gray-400">Boost engagement by ensuring viewers can understand your content even with the sound off.</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="md:w-1/3">
                <h3 className="text-xl font-bold mb-2">Educators</h3>
              </div>
              <div className="md:w-2/3">
                <p className="text-gray-400">Make tutorials and educational content easily accessible to everyone by providing accurate captions.</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="md:w-1/3">
                <h3 className="text-xl font-bold mb-2">Social Media Managers</h3>
              </div>
              <div className="md:w-2/3">
                <p className="text-gray-400">Quickly burn subtitles into clips for TikTok, Instagram Reels, and YouTube Shorts before posting.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ToolFAQ faqs={faqs} />
      <BrandedFooter />
    </div>
  );
}
