import { Check, Mic, MicOff, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  MICROPHONE_CHUNK_COUNT,
  MICROPHONE_CHUNK_INTERVAL_MS,
  MICROPHONE_CHUNK_SAMPLES,
  audioLevel,
  createMicrophoneEntropyCollector,
} from "../lib/microphone-entropy";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

type MicrophoneStatus = "idle" | "starting" | "ready" | "capturing" | "captured" | "error";

function microphoneErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Microphone permission was denied. Allow microphone access for this page and try again.";
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "No usable microphone was found on this device.";
    }
    if (error.name === "NotReadableError" || error.name === "AbortError") {
      return "The microphone is busy or could not be started. Close other recording apps and try again.";
    }
  }
  return error instanceof Error ? error.message : "The microphone could not be accessed.";
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export function MicrophoneEntropyControls({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const runRef = useRef(0);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<MicrophoneStatus>(value ? "captured" : "idle");
  const [progress, setProgress] = useState(value ? 100 : 0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const releaseMicrophone = () => {
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    if (contextRef.current && contextRef.current.state !== "closed") {
      void contextRef.current.close().catch(() => undefined);
    }
    contextRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
      releaseMicrophone();
    };
  }, []);

  const stopMicrophone = () => {
    runRef.current += 1;
    releaseMicrophone();
    setLevel(0);
    setProgress(value ? 100 : 0);
    setStatus(value ? "captured" : "idle");
  };

  const startMicrophone = async () => {
    setError(null);
    setLevel(0);
    setProgress(0);
    setStatus("starting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone capture is unavailable here. Open the app from HTTPS or localhost in a supported browser.");
      }
      if (!window.AudioContext) {
        throw new Error("Web Audio is unavailable in this browser.");
      }

      releaseMicrophone();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: { ideal: false },
          noiseSuppression: { ideal: false },
          autoGainControl: { ideal: false },
        },
      });

      if (!mountedRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      streamRef.current = stream;
      const audioContext = new AudioContext({ latencyHint: "interactive" });
      contextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = MICROPHONE_CHUNK_SAMPLES;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      await audioContext.resume();

      setStatus("ready");
    } catch (captureError) {
      releaseMicrophone();
      setError(microphoneErrorMessage(captureError));
      setStatus("error");
    }
  };

  const captureEntropy = async () => {
    const analyser = analyserRef.current;
    const audioContext = contextRef.current;
    if (!analyser || !audioContext || audioContext.state === "closed") {
      setError("The microphone stream is not ready yet. Wait a moment and try again.");
      return;
    }

    const run = runRef.current + 1;
    runRef.current = run;
    setError(null);
    setProgress(0);
    setLevel(0);
    setStatus("capturing");
    const collector = createMicrophoneEntropyCollector(audioContext.sampleRate, MICROPHONE_CHUNK_SAMPLES);
    const samples = new Float32Array(MICROPHONE_CHUNK_SAMPLES);

    try {
      for (let index = 0; index < MICROPHONE_CHUNK_COUNT; index += 1) {
        await wait(MICROPHONE_CHUNK_INTERVAL_MS);
        if (!mountedRef.current || runRef.current !== run) return;

        analyser.getFloatTimeDomainData(samples);
        collector.addChunk(samples, performance.now());
        setLevel(audioLevel(samples));
        samples.fill(0);
        setProgress(((index + 1) / MICROPHONE_CHUNK_COUNT) * 100);
      }

      const digest = collector.digest();
      onChange(digest);
      releaseMicrophone();
      setStatus("captured");
      setProgress(100);
      setLevel(0);
    } catch (captureError) {
      releaseMicrophone();
      setError(microphoneErrorMessage(captureError));
      setStatus("error");
      setLevel(0);
    } finally {
      samples.fill(0);
    }
  };

  const microphoneActive = status === "starting" || status === "ready" || status === "capturing";
  const displayedLevel = Math.min(100, level * 900);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-line bg-ink">
        <div className="relative flex h-44 flex-col items-center justify-center gap-3 px-6 text-center text-canvas/70">
          {status === "captured" && value ? (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-success text-white"><Check className="size-6" /></span>
              <span className="text-sm font-semibold text-canvas">Capture digest ready</span>
            </>
          ) : microphoneActive ? (
            <>
              <span className="relative flex size-14 items-center justify-center rounded-full bg-white/10 text-white">
                {status === "capturing" && <span className="absolute inset-0 animate-ping rounded-full bg-accent/35" />}
                <Mic className="relative size-6" />
              </span>
              <span className="text-sm font-semibold text-canvas">{status === "starting" ? "Starting microphone…" : status === "capturing" ? "Listening locally…" : "Microphone ready"}</span>
              <div className="w-full max-w-52">
                <div className="mb-1 flex justify-between text-[9px] uppercase tracking-wider"><span>Signal</span><span>{Math.round(displayedLevel)}%</span></div>
                <Progress value={displayedLevel} className="bg-white/15 [&>div]:bg-accent" />
              </div>
            </>
          ) : (
            <>
              <MicOff className="size-8" />
              <span className="text-xs leading-5">The microphone stays off until you start it.</span>
            </>
          )}

          {status === "capturing" && (
            <div className="absolute inset-x-3 bottom-3 rounded-lg bg-ink/80 p-2.5 text-white backdrop-blur">
              <div className="mb-1.5 flex justify-between text-[9px] font-semibold uppercase tracking-wider"><span>Sampling audio</span><span>{Math.round(progress)}%</span></div>
              <Progress value={progress} className="bg-white/20 [&>div]:bg-white" />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {!microphoneActive ? (
          <Button variant="accent" className="sm:col-span-2" onClick={startMicrophone}>
            {value ? <RefreshCw className="size-4" /> : <Mic className="size-4" />}
            {value ? "Start a new capture" : "Start microphone"}
          </Button>
        ) : (
          <>
            <Button variant="accent" disabled={status !== "ready"} onClick={captureEntropy}>
              <Mic className="size-4" /> {status === "capturing" ? "Listening…" : "Capture entropy"}
            </Button>
            <Button variant="outline" onClick={stopMicrophone}>Stop microphone</Button>
          </>
        )}
      </div>

      {status === "ready" && (
        <p className="text-center text-[10px] leading-4 text-muted">Speak, clap, or vary nearby sounds during the roughly 3.2-second capture.</p>
      )}
      {error && <p role="alert" className="rounded-lg bg-danger/[0.06] px-3 py-2 text-xs leading-5 text-danger">{error}</p>}

      <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/[0.045] px-3 py-2.5 text-[11px] leading-5 text-muted">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-danger" />
        <span><strong className="font-semibold text-ink">Microphone entropy cannot be measured reliably.</strong> Silence, repeated speech, tones, audio processing, virtual devices, and compromised hardware can make samples predictable. Use this for education, not real funds.</span>
      </div>

      {value && (
        <div className="rounded-xl border border-line bg-surface/55 p-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">SHA-256 capture digest</div>
          <code className="sensitive block break-all text-[11px] leading-5">{value}</code>
          <p className="mt-2 text-[10px] leading-4 text-muted">Only this digest is retained. Raw samples are not saved, uploaded, or encoded as an audio recording.</p>
        </div>
      )}
    </div>
  );
}
