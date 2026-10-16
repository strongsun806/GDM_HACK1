"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertOctagon,
  Droplets,
  Cpu,
  Clock,
  ShieldAlert,
  Terminal,
  Activity,
  Navigation,
  Siren,
  CheckSquare,
  Square,
  MapPin,
  FileText,
  CloudRain,
  Users,
} from "lucide-react";
import { SimulationData, SystemLogEntry } from "@/types/simulation";

interface DashboardPanelProps {
  simulation: SimulationData;
  logs: SystemLogEntry[];
  isLoading: boolean;
  onWaterLevelOverride: (level: number) => void;
}

/**
 * 실시간 수위 변동을 시각화하는 미세 진동 물결 파형 그래프 (Canvas Sparkline & Hydro Waveform)
 */
function WaterLevelSparkline({ waterLevel }: { waterLevel: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(30, 41, 59, 0.7)";
      ctx.lineWidth = 1;
      for (let y = 10; y < h; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const normLevel = Math.min(1, Math.max(0.05, waterLevel / 5.0));
      const baseY = h - normLevel * (h - 10) - 4;
      const amp = 2.2 + normLevel * 4.5;
      offset += 0.12 + normLevel * 0.14;

      const grad = ctx.createLinearGradient(0, baseY - amp, 0, h);
      if (waterLevel >= 2.2) {
        grad.addColorStop(0, "rgba(244, 63, 94, 0.55)");
        grad.addColorStop(1, "rgba(14, 165, 233, 0.08)");
      } else {
        grad.addColorStop(0, "rgba(56, 189, 248, 0.5)");
        grad.addColorStop(1, "rgba(14, 165, 233, 0.05)");
      }

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const wave =
          Math.sin(x * 0.06 + offset) * amp +
          Math.cos(x * 0.13 - offset * 1.4) * (amp * 0.45);
        const y = Math.max(2, Math.min(h - 2, baseY + wave));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const wave =
          Math.sin(x * 0.06 + offset) * amp +
          Math.cos(x * 0.13 - offset * 1.4) * (amp * 0.45);
        const y = Math.max(2, Math.min(h - 2, baseY + wave));
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = waterLevel >= 2.2 ? "#fb7185" : "#38bdf8";
      ctx.lineWidth = 2;
      ctx.shadowColor = waterLevel >= 2.2 ? "#f43f5e" : "#00d2ff";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [waterLevel]);

  return (
    <div className="relative w-full h-11 rounded-lg bg-slate-950/95 border border-slate-800/90 overflow-hidden">
      <canvas ref={canvasRef} width={320} height={44} className="w-full h-full block" />
      <div className="absolute top-1 left-2 text-[9px] font-mono text-slate-400 pointer-events-none flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span>HYDRO-SONAR WAVEFORM // LIVE TELEMETRY</span>
      </div>
      <div className="absolute top-1 right-2 text-[9px] font-mono text-cyan-300 pointer-events-none">
        +{(waterLevel * 0.12).toFixed(2)}m/min
      </div>
    </div>
  );
}

/**
 * 개별 로그 라인에 실제 타이핑 효과(Typewriter effect)를 부여하는 컴포넌트
 */
function TypewriterLogLine({
  log,
  isRecent,
}: {
  log: SystemLogEntry;
  isRecent: boolean;
}) {
  const [displayed, setDisplayed] = useState(isRecent ? "" : log.message);

  useEffect(() => {
    if (!isRecent) {
      setDisplayed(log.message);
      return;
    }

    let idx = 0;
    setDisplayed("");
    const timer = setInterval(() => {
      idx += 2;
      if (idx >= log.message.length) {
        setDisplayed(log.message);
        clearInterval(timer);
      } else {
        setDisplayed(log.message.slice(0, idx));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [log.message, isRecent]);

  const colorClass =
    log.level === "critical"
      ? "text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]"
      : log.level === "warn"
      ? "text-amber-300"
      : log.level === "success"
      ? "text-emerald-400"
      : "text-cyan-300";

  return (
    <div className="leading-snug break-words font-mono text-[11px]">
      <span className="text-slate-500 mr-1.5">[{log.timestamp}]</span>
      <span className={`font-semibold ${colorClass}`}>
        {displayed}
        {displayed.length < log.message.length && (
          <span className="inline-block w-1.5 h-3 ml-0.5 bg-cyan-400 animate-pulse align-middle" />
        )}
      </span>
    </div>
  );
}

export default function DashboardPanel({
  simulation,
  logs,
  isLoading,
  onWaterLevelOverride,
}: DashboardPanelProps) {
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const [checklist, setChecklist] = useState([
    { id: "chk-1", text: "서측 개찰구 차수문 2단계 긴급 폐쇄", checked: true },
    { id: "chk-2", text: "동측 방수 엘리베이터 #3 교통약자 우선 호출", checked: true },
    { id: "chk-3", text: "드론 #A1 수면 서치라이트 및 구명튜브 투하 대기", checked: false },
  ]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const toggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const statusMap = {
    DANGER: {
      badge: "STATUS: CRITICAL",
      alertText: "ALERT // FLOOD BREACH",
      color:
        "bg-rose-500/20 text-rose-200 border-rose-500/80 shadow-[0_0_18px_rgba(244,63,94,0.5)]",
      panelBorder:
        "border-rose-500/45 shadow-[0_0_25px_rgba(244,63,94,0.14)]",
    },
    WARNING: {
      badge: "STATUS: WARNING",
      alertText: "ALERT // PUMP ACTIVE",
      color:
        "bg-amber-500/20 text-amber-200 border-amber-500/80 shadow-[0_0_18px_rgba(245,158,11,0.4)]",
      panelBorder:
        "border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.12)]",
    },
    CLEAR: {
      badge: "STATUS: SAFE",
      alertText: "SYSTEM // NOMINAL",
      color:
        "bg-emerald-500/20 text-emerald-200 border-emerald-500/80 shadow-[0_0_18px_rgba(16,185,129,0.4)]",
      panelBorder:
        "border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.12)]",
    },
  };

  const currentStatus = statusMap[simulation.status] || statusMap.DANGER;
  const waterPercentage = Math.min(100, Math.max(0, (simulation.waterLevel / 5.0) * 100));

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
      {/* 1. 상단 재난 경보 배지 (사이렌 비콘 & 점멸 Alert) + 실시간 수위 파형 그래프 */}
      <div
        className={`rounded-xl bg-slate-950/80 backdrop-blur-2xl border p-3.5 flex flex-col gap-2.5 transition-all duration-300 ${currentStatus.panelBorder}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-6 h-6 rounded-md bg-rose-950/90 border border-rose-500/60">
              <Siren className="w-3.5 h-3.5 text-rose-400 animate-siren" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-100">
                Disaster Telemetry
              </span>
              <span className="text-[9px] font-mono font-bold text-rose-400 tracking-widest animate-pulse">
                {currentStatus.alertText}
              </span>
            </div>
          </div>

          <div
            className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-extrabold flex items-center gap-1.5 ${currentStatus.color}`}
          >
            <AlertOctagon className="w-3 h-3 text-rose-400 animate-spin" />
            <span>{currentStatus.badge}</span>
          </div>
        </div>

        {/* 현재 시나리오 브리핑 바 */}
        <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 text-[11px] font-semibold text-cyan-200 shadow-inner">
          {simulation.scenario}
        </div>

        {/* 골든타임 6분 내 120명 전원 안전 대피 핵심 지표 배너 */}
        <div className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/45 flex items-center justify-between text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>골든타임 6분 내 120명 전원 안전 대피</span>
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-extrabold border border-emerald-400/40">
            98.4% SIMULATED
          </span>
        </div>

        {/* 수위 실시간 수치 게이지 & 물결 파형 그래프(Sparkline) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Droplets className="w-3.5 h-3.5 text-sky-400 animate-bounce" />
              <span>Water Level:</span>
            </span>
            <span className="font-bold text-sky-300">
              {simulation.waterLevel.toFixed(1)} m{" "}
              <span className="text-slate-500 font-normal">/ Max 5.0m</span>
            </span>
          </div>

          <WaterLevelSparkline waterLevel={simulation.waterLevel} />

          <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-700/80 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                simulation.waterLevel >= 2.2
                  ? "bg-gradient-to-r from-sky-500 via-amber-500 to-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                  : simulation.waterLevel >= 1.0
                  ? "bg-gradient-to-r from-sky-500 to-amber-400"
                  : "bg-gradient-to-r from-cyan-500 to-sky-400"
              }`}
              style={{ width: `${waterPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[10px] font-mono text-slate-400">
              MANUAL SURGE SIMULATOR
            </span>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={simulation.waterLevel}
              onChange={(e) => onWaterLevelOverride(parseFloat(e.target.value))}
              className="w-36 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* 2. GEMINI 4 ARGON DIAGNOSTIC REPORT (Track 3 Grounding + 스캔라인 + 현장 검증 체크리스트) */}
      <div className="relative overflow-hidden rounded-xl bg-slate-950/80 backdrop-blur-2xl border border-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.14)] p-3.5 flex flex-col gap-2.5">
        <div className="pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent animate-scanline" />

        <div className="flex items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400 animate-pulse" />
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-100">
              GEMINI 4 ARGON DIAGNOSTIC REPORT
            </h3>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-purple-500/40">
            <div className="flex items-end gap-0.5 h-3">
              <span className="w-0.5 h-1.5 bg-cyan-400 animate-pulse" />
              <span className="w-0.5 h-3 bg-purple-400 animate-bounce" />
              <span className="w-0.5 h-2 bg-cyan-300 animate-pulse" />
              <span className="w-0.5 h-2.5 bg-rose-400 animate-bounce" />
            </div>
            <span className="text-[9px] font-mono text-purple-200 font-bold">
              {isLoading ? "SCANNING" : "1M CTX SYNC"}
            </span>
          </div>
        </div>

        {/* Track 3 Grounding 데이터 소스 배지 (재해지도 + 기상피드 + Google Maps + 도면 PDF) */}
        <div className="grid grid-cols-3 gap-1 text-[9px] font-mono relative z-10">
          <div className="px-1.5 py-1 rounded bg-slate-900/90 border border-slate-700/80 text-sky-300 flex items-center gap-1 truncate">
            <CloudRain className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="truncate">기상청 110mm/h</span>
          </div>
          <div className="px-1.5 py-1 rounded bg-slate-900/90 border border-slate-700/80 text-emerald-300 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">Maps Grounded</span>
          </div>
          <div className="px-1.5 py-1 rounded bg-slate-900/90 border border-slate-700/80 text-amber-300 flex items-center gap-1 truncate">
            <FileText className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">여의도역 도면 PDF</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs relative z-10">
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase text-cyan-400 flex items-center gap-1">
              <Activity className="w-3 h-3" /> 피해 예측 및 구조물 진단
            </span>
            <p className="text-slate-200 leading-relaxed text-[11px]">
              {simulation.aiReport.summary}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-rose-950/35 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)] flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase text-rose-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-rose-400 animate-spin" /> 인명 피해 예측 및 잔여 골든타임
            </span>
            <p className="text-rose-200 font-bold text-[11px]">
              {simulation.aiReport.casualties}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/45 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase text-emerald-300 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-emerald-400" /> AI 즉각 권고 조치 (Action Required)
            </span>
            <p className="text-emerald-100 leading-relaxed text-[11px]">
              {simulation.aiReport.actionRequired}
            </p>
          </div>

          {/* Track 3 검증 가능한 현장 대응 체크리스트 (Verifiable Field Checklist) */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase text-cyan-300 font-bold">
              ✓ VERIFIABLE FIELD CHECKLIST (현장 대원 검증 루프)
            </span>
            {checklist.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleCheck(item.id)}
                className="flex items-center gap-2 text-left text-[11px] text-slate-200 hover:text-cyan-300 transition-colors"
              >
                {item.checked ? (
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                <span className={item.checked ? "line-through text-slate-400" : ""}>
                  {item.text}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[10px] font-mono">
            <div className="px-2 py-1.5 rounded bg-slate-900/95 border border-rose-500/35 text-rose-200 flex items-center gap-1.5">
              <Navigation className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="truncate">
                HAZARD: [{simulation.dangerZone.join(", ")}]
              </span>
            </div>
            <div className="px-2 py-1.5 rounded bg-slate-900/95 border border-cyan-500/35 text-cyan-200 flex items-center gap-1.5">
              <Navigation className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">
                DRONE: [{simulation.droneTarget.join(", ")}]
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ARGON REASONING LOOP TERMINAL (실시간 타이핑 효과 & 자동 스크롤) */}
      <div className="rounded-xl bg-slate-950/85 backdrop-blur-2xl border border-emerald-500/35 shadow-[0_0_25px_rgba(16,185,129,0.1)] p-3.5 flex-1 min-h-[155px] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-100">
              ARGON REASONING LOOP TERMINAL
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            LIVE STREAM
          </span>
        </div>

        <div
          ref={logContainerRef}
          className="flex-1 rounded-lg bg-[#030711] border border-slate-800/90 p-2.5 overflow-y-auto flex flex-col gap-1.5 shadow-inner"
        >
          {logs.map((log, index) => (
            <TypewriterLogLine
              key={log.id}
              log={log}
              isRecent={index >= logs.length - 4}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
