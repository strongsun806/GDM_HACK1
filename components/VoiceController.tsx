"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  AlertTriangle,
  Accessibility,
  ShieldCheck,
  Radio,
} from "lucide-react";

interface VoiceControllerProps {
  onSimulate: (prompt: string, presetId?: string) => Promise<void>;
  isLoading: boolean;
}

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal?: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

const PRESET_SCENARIOS = [
  {
    id: "scenario-1",
    label: "[시나리오 1: 폭우로 인한 지하 2층 개찰구 급속 침수]",
    subLabel: "SURGE 3.1m // 서측 차수문 폐쇄 및 긴급 우회",
    prompt: "폭우로 인한 지하 2층 개찰구 급속 침수 발생, 서측 계단 진입 불가 및 비상 대피 경로 산출",
    icon: AlertTriangle,
    stripeClass: "hazard-stripes-red",
    borderGlow:
      "border-rose-500/80 hover:border-rose-400 text-rose-100 shadow-[0_0_18px_rgba(244,63,94,0.28)] hover:shadow-[0_0_25px_rgba(244,63,94,0.55)]",
    tagStyle: "bg-rose-600 text-white border-rose-300",
    tagText: "LVL 3.1m",
  },
  {
    id: "scenario-2",
    label: "[시나리오 2: 지하 3층 승강장 휠체어 이용자 고립 및 우회로 탐색]",
    subLabel: "SURGE 2.3m // 방수 엘리베이터 #3 옐로우 라인 가동",
    prompt: "지하 3층 승강장 휠체어 이용자 고립 발생, 방수 엘리베이터 경유 교통약자 우회로 탐색",
    icon: Accessibility,
    stripeClass: "hazard-stripes-amber",
    borderGlow:
      "border-amber-500/80 hover:border-amber-300 text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)]",
    tagStyle: "bg-amber-500 text-slate-950 border-amber-200",
    tagText: "LVL 2.3m",
  },
  {
    id: "scenario-3",
    label: "[시나리오 3: 구조 드론 파견 및 배수 펌프 가동]",
    subLabel: "DRAIN 0.6m // 드론 서치라이트 정밀 수색 및 배수 풀가동",
    prompt: "구조 드론 파견 및 배수 펌프 가동, 북동측 승강장 잔류 인원 수색 및 수위 안정화",
    icon: ShieldCheck,
    stripeClass: "hazard-stripes-cyan",
    borderGlow:
      "border-cyan-500/80 hover:border-cyan-300 text-cyan-100 shadow-[0_0_18px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]",
    tagStyle: "bg-cyan-400 text-slate-950 border-cyan-100",
    tagText: "LVL 0.6m",
  },
];

/**
 * 실시간 Web Waveform 오디오 비주얼라이저 (마이크 수신 또는 AI 응답 시 격렬히 춤추는 파형)
 */
function AudioWaveformVisualizer({
  isListening,
  isProcessing,
}: {
  isListening: boolean;
  isProcessing: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const active = isListening || isProcessing;
      const barCount = 22;
      const gap = 2;
      const barWidth = (w - gap * (barCount - 1)) / barCount;

      phase += active ? 0.24 : 0.05;

      for (let i = 0; i < barCount; i++) {
        const norm = i / barCount;
        const envelope = Math.sin(norm * Math.PI);
        const wave =
          Math.sin(phase + i * 0.55) * 0.5 +
          Math.cos(phase * 1.4 - i * 0.35) * 0.5;

        const amplitude = active
          ? Math.max(0.18, Math.abs(wave) * envelope * 0.95 + 0.15)
          : 0.12 + Math.abs(Math.sin(phase + i * 0.3)) * 0.12;

        const barHeight = Math.max(3, amplitude * (h - 4));
        const x = i * (barWidth + gap);
        const y = (h - barHeight) / 2;

        if (isListening) {
          ctx.fillStyle = i % 2 === 0 ? "#fb7185" : "#f43f5e";
          ctx.shadowColor = "#f43f5e";
          ctx.shadowBlur = 8;
        } else if (isProcessing) {
          ctx.fillStyle = i % 2 === 0 ? "#c084fc" : "#38bdf8";
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = "rgba(34, 211, 238, 0.55)";
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isListening, isProcessing]);

  return (
    <canvas
      ref={canvasRef}
      width={108}
      height={32}
      className="h-8 w-[108px] rounded-md bg-slate-950/90 border border-slate-800 px-1.5 shrink-0"
    />
  );
}

export default function VoiceController({ onSimulate, isLoading }: VoiceControllerProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionConstructor =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new (SpeechRecognitionConstructor as new () => SpeechRecognitionLike)();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let combined = "";
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript;
      }
      setTranscript(combined);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (transcript.trim().length > 0) {
        onSimulate(transcript.trim());
      }
    } else {
      setTranscript("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcript.trim() || isLoading) return;
    onSimulate(transcript.trim());
  };

  // 상태 전환에 따른 네온 글로우 배지 스타일
  const statusBadge = isListening
    ? {
        label: "● VOICE LISTENING",
        style:
          "bg-rose-950/90 text-rose-300 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.85)] animate-pulse",
      }
    : isLoading
    ? {
        label: "⚡ ARGON PROCESSING",
        style:
          "bg-purple-950/90 text-purple-200 border-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.85)] animate-pulse",
      }
    : {
        label: speechSupported ? "● VOICE READY" : "● TEXT READY",
        style:
          "bg-cyan-950/80 text-cyan-300 border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.45)]",
      };

  return (
    <div className="rounded-xl bg-slate-950/85 backdrop-blur-2xl border border-cyan-500/35 shadow-[0_0_25px_rgba(6,182,212,0.12)] p-3.5 flex flex-col gap-2.5 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-100">
            Voice & Tactical Command Interface
          </h2>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border transition-all duration-300 ${statusBadge.style}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* 마이크 버튼 + 실시간 오디오 파형 비주얼라이저 + 명령어 입력창 */}
      <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleListening}
          disabled={!speechSupported || isLoading}
          title={speechSupported ? "클릭하여 음성 인식 시작/종료" : "브라우저 음성 인식 미지원"}
          className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all shrink-0 ${
            isListening
              ? "bg-rose-600 border-rose-300 text-white animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.9)]"
              : "bg-slate-900 border-cyan-500/50 text-cyan-300 hover:bg-cyan-950 hover:border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
          } disabled:opacity-40`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* 오디오 파형 비주얼라이저 */}
        <AudioWaveformVisualizer isListening={isListening} isProcessing={isLoading} />

        <input
          type="text"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={
            isListening
              ? "음성 수신 중... 재난 상황을 말씀하세요"
              : "음성 또는 재난 명령어 입력..."
          }
          className="w-full h-9 px-2.5 rounded-lg bg-slate-950 border border-slate-700/90 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
        />

        <button
          type="submit"
          disabled={isLoading || !transcript.trim()}
          className="h-9 px-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* 경고 마킹(빗금 패턴) 및 위험 수위 비례 글로우 보더가 적용된 시나리오 3종 프리셋 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
            Emergency Chain-Reaction Presets
          </span>
          <span className="text-cyan-400">INSTANT 3D SYNC</span>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {PRESET_SCENARIOS.map((preset) => {
            const IconComponent = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setTranscript(preset.prompt);
                  onSimulate(preset.prompt, preset.id);
                }}
                className={`group relative w-full text-left px-3 py-2 rounded-lg border transition-all duration-200 flex items-center justify-between gap-2 overflow-hidden disabled:opacity-50 ${preset.stripeClass} ${preset.borderGlow}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <IconComponent className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold truncate">{preset.label}</span>
                    <span className="text-[9px] font-mono text-slate-300/80 truncate">
                      {preset.subLabel}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold border shrink-0 ${preset.tagStyle}`}
                >
                  {preset.tagText}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
