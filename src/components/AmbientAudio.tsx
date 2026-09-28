import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";

export const AmbientAudio: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/aud.mp3");
    audio.loop = true;
    audio.volume = 0.25;
    audioRef.current = audio;

    // Check if user previously enabled audio
    const savedAudio = localStorage.getItem("zx_ambient_audio");
    if (savedAudio === "true") {
      audio.play().then(() => setIsPlaying(true)).catch(() => {
        // Browser autoplay blocked until user interacts
        setIsPlaying(false);
      });
    }

    // Auto-enable on first user click if desired
    const handleFirstGesture = () => {
      if (localStorage.getItem("zx_ambient_audio") !== "false" && audioRef.current && audioRef.current.paused) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          localStorage.setItem("zx_ambient_audio", "true");
        }).catch(() => {});
      }
      window.removeEventListener("pointerdown", handleFirstGesture);
    };

    window.addEventListener("pointerdown", handleFirstGesture);

    return () => {
      window.removeEventListener("pointerdown", handleFirstGesture);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      localStorage.setItem("zx_ambient_audio", "false");
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        localStorage.setItem("zx_ambient_audio", "true");
      }).catch(() => {});
    }
  };

  return (
    <button
      onClick={toggleAudio}
      title={isPlaying ? "Mute soundtrack" : "Play ambient soundtrack"}
      aria-label="Toggle ambient soundtrack"
      className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-xs border"
      style={{
        background: isPlaying ? "var(--zx-surface-alt)" : "var(--zx-surface)",
        borderColor: isPlaying ? "var(--zx-primary)" : "var(--zx-border)",
        color: isPlaying ? "var(--zx-primary)" : "var(--zx-muted)",
      }}
    >
      {isPlaying ? (
        /* Equalizer Waveform Indicator */
        <div className="flex items-end gap-0.5 h-3.5 w-3.5">
          <span
            className="w-0.5 rounded-full animate-pulse"
            style={{
              height: "100%",
              background: "var(--zx-primary)",
              animationDelay: "0ms",
            }}
          />
          <span
            className="w-0.5 rounded-full animate-pulse"
            style={{
              height: "65%",
              background: "var(--zx-primary)",
              animationDelay: "150ms",
            }}
          />
          <span
            className="w-0.5 rounded-full animate-pulse"
            style={{
              height: "85%",
              background: "var(--zx-primary)",
              animationDelay: "300ms",
            }}
          />
        </div>
      ) : (
        <VolumeX className="w-3.5 h-3.5 text-[var(--zx-muted)]" />
      )}
    </button>
  );
};
