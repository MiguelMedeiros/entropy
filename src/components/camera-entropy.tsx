import { Camera, CameraOff, Check, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CAMERA_FRAME_COUNT,
  CAMERA_FRAME_HEIGHT,
  CAMERA_FRAME_INTERVAL_MS,
  CAMERA_FRAME_WIDTH,
  createCameraEntropyCollector,
} from "../lib/camera-entropy";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

type CameraStatus = "idle" | "starting" | "ready" | "capturing" | "captured" | "error";

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera permission was denied. Allow camera access for this page and try again.";
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "No usable camera was found on this device.";
    }
    if (error.name === "NotReadableError" || error.name === "AbortError") {
      return "The camera is busy or could not be started. Close other camera apps and try again.";
    }
  }
  return error instanceof Error ? error.message : "The camera could not be accessed.";
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export function CameraEntropyControls({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef(0);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<CameraStatus>(value ? "captured" : "idle");
  const [progress, setProgress] = useState(value ? 100 : 0);
  const [error, setError] = useState<string | null>(null);

  const releaseCamera = () => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
      releaseCamera();
    };
  }, []);

  const stopCamera = () => {
    runRef.current += 1;
    releaseCamera();
    setProgress(value ? 100 : 0);
    setStatus(value ? "captured" : "idle");
  };

  const startCamera = async () => {
    setError(null);
    setProgress(0);
    setStatus("starting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera capture is unavailable here. Open the app from HTTPS or localhost in a supported browser.");
      }

      releaseCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (!mountedRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview could not be created.");
      video.srcObject = stream;
      await video.play();
      setStatus("ready");
    } catch (captureError) {
      releaseCamera();
      setError(cameraErrorMessage(captureError));
      setStatus("error");
    }
  };

  const captureEntropy = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError("The camera image is not ready yet. Wait a moment and try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = CAMERA_FRAME_WIDTH;
    canvas.height = CAMERA_FRAME_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      setError("This browser could not prepare camera sampling.");
      setStatus("error");
      releaseCamera();
      return;
    }

    const run = runRef.current + 1;
    runRef.current = run;
    setError(null);
    setProgress(0);
    setStatus("capturing");
    const collector = createCameraEntropyCollector(CAMERA_FRAME_WIDTH, CAMERA_FRAME_HEIGHT);

    try {
      for (let index = 0; index < CAMERA_FRAME_COUNT; index += 1) {
        await wait(CAMERA_FRAME_INTERVAL_MS);
        if (!mountedRef.current || runRef.current !== run) return;

        context.drawImage(video, 0, 0, CAMERA_FRAME_WIDTH, CAMERA_FRAME_HEIGHT);
        const frame = context.getImageData(0, 0, CAMERA_FRAME_WIDTH, CAMERA_FRAME_HEIGHT);
        collector.addFrame(frame.data, performance.now());
        frame.data.fill(0);
        context.clearRect(0, 0, CAMERA_FRAME_WIDTH, CAMERA_FRAME_HEIGHT);
        setProgress(((index + 1) / CAMERA_FRAME_COUNT) * 100);
      }

      const digest = collector.digest();
      onChange(digest);
      releaseCamera();
      setStatus("captured");
      setProgress(100);
    } catch (captureError) {
      releaseCamera();
      setError(cameraErrorMessage(captureError));
      setStatus("error");
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }
  };

  const cameraActive = status === "starting" || status === "ready" || status === "capturing";

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-line bg-ink">
        <div className="relative aspect-video">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Live camera preview"
            className={cameraActive ? "size-full object-cover" : "hidden"}
          />
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-canvas/70">
              {status === "captured" && value ? (
                <>
                  <span className="flex size-12 items-center justify-center rounded-full bg-success text-white"><Check className="size-6" /></span>
                  <span className="text-sm font-semibold text-canvas">Capture digest ready</span>
                </>
              ) : (
                <>
                  <CameraOff className="size-8" />
                  <span className="text-xs leading-5">The camera stays off until you start it.</span>
                </>
              )}
            </div>
          )}
          {status === "capturing" && (
            <div className="absolute inset-x-3 bottom-3 rounded-lg bg-ink/80 p-3 text-white backdrop-blur">
              <div className="mb-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider">
                <span>Sampling frames</span><span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="bg-white/20 [&>div]:bg-white" />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {!cameraActive ? (
          <Button variant="accent" className="sm:col-span-2" onClick={startCamera}>
            {value ? <RefreshCw className="size-4" /> : <Camera className="size-4" />}
            {value ? "Start a new capture" : "Start camera"}
          </Button>
        ) : (
          <>
            <Button variant="accent" disabled={status !== "ready"} onClick={captureEntropy}>
              <Camera className="size-4" /> {status === "capturing" ? "Capturing…" : "Capture entropy"}
            </Button>
            <Button variant="outline" onClick={stopCamera}>Stop camera</Button>
          </>
        )}
      </div>

      {status === "ready" && (
        <p className="text-center text-[10px] leading-4 text-muted">Move the camera during the roughly 2.4-second capture to vary the sampled frames.</p>
      )}
      {error && <p role="alert" className="rounded-lg bg-danger/[0.06] px-3 py-2 text-xs leading-5 text-danger">{error}</p>}

      <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/[0.045] px-3 py-2.5 text-[11px] leading-5 text-muted">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-danger" />
        <span><strong className="font-semibold text-ink">Camera entropy cannot be measured reliably.</strong> Lighting, compression, fixed scenes, virtual cameras, and compromised hardware can make frames predictable. Use this for education, not real funds.</span>
      </div>

      {value && (
        <div className="rounded-xl border border-line bg-surface/55 p-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">SHA-256 capture digest</div>
          <code className="sensitive block break-all text-[11px] leading-5">{value}</code>
          <p className="mt-2 text-[10px] leading-4 text-muted">Only this digest is retained. Raw frames are not saved, uploaded, or placed in the transcript.</p>
        </div>
      )}
    </div>
  );
}
