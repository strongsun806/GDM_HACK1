'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Droplets,
  Send,
  Mic,
  MicOff,
  Terminal,
  Accessibility,
  FileText,
  CloudRain,
  MapPin,
  Cpu,
  Radio,
  CheckCircle2,
  Sparkles,
  Volume2,
  VolumeX,
  Users,
  Timer,
  CheckSquare,
  Square,
  GitCompare,
} from 'lucide-react';
import { SimulationData, AgentLogEntry } from '@/types/simulation';

interface DashboardPanelProps {
  simulationData: SimulationData;
  isLoading: boolean;
  agentLogs: AgentLogEntry[];
  onSubmitPrompt: (prompt: string) => void;
  onManualWaterChange: (level: number) => void;
}

const QUICK_SCENARIOS = [
  {
    label: '🌊 1번 출구 폭우 유입 (코드 레드)',
    prompt:
      '여의도역 1번 출구 계단으로 시간당 110mm 폭우가 폭포수처럼 쏟아져 들어오고 휠체어 승객이 승강장에 고립됨',
  },
  {
    label: '🔥 환승통로 침수 합선 · 연기 감지',
    prompt: '서쪽 환승 통로 변전실 침수로 인한 배전반 스파크 화재 및 유독 연기 확산 발생',
  },
  {
    label: '✅ 배수 펌프 가동 · 상황 해제',
    prompt: '배수 펌프 100% 가동 완료 및 역사 내 전 구역 침수 상황 해제 복구',
  },
];

export default function DashboardPanel({
  simulationData,
  isLoading,
  agentLogs,
  onSubmitPrompt,
  onManualWaterChange,
}: DashboardPanelProps) {
  const [promptInput, setPromptInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({ 0: true });
  const [goldenTimeRemaining, setGoldenTimeRemaining] = useState<number>(
    simulationData.goldenTimeSeconds ?? 340
  );
  const [evacuatedCount, setEvacuatedCount] = useState<number>(84);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [agentLogs]);

  // Reset golden time & checklist state when scenario changes
  useEffect(() => {
    setGoldenTimeRemaining(simulationData.goldenTimeSeconds ?? 340);
    setCheckedItems({ 0: true });
    setEvacuatedCount(simulationData.status === 'CLEAR' ? 120 : 88);
  }, [simulationData.scenario, simulationData.goldenTimeSeconds, simulationData.status]);

  // Live Golden Time & Evacuee Counter Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setGoldenTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      setEvacuatedCount((prev) => {
        const total = simulationData.totalEvacuees ?? 120;
        if (prev < total) return prev + 1;
        return total;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [simulationData.totalEvacuees]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isLoading) return;
    onSubmitPrompt(promptInput.trim());
    setPromptInput('');
  };

  const handleVoiceInput = () => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const simulatedVoice =
        '긴급 상황! 서쪽 1번 출구 계단으로 폭우가 폭포수처럼 유입되어 수위가 급상승 중입니다. 휠체어 이용 승객 우회 경로를 즉시 산출하세요.';
      setPromptInput(simulatedVoice);
      onSubmitPrompt(simulatedVoice);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setPromptInput(transcript);
          onSubmitPrompt(transcript);
        }
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleVoiceBroadcast = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const script =
      simulationData.voiceBroadcast ||
      `${simulationData.scenario}. ${simulationData.aiReport.vulnerableNotice}`;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.02;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const toggleChecklist = (idx: number) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalEvacuees = simulationData.totalEvacuees ?? 120;
  const vulnerableEvacuees = simulationData.vulnerableEvacuees ?? 14;
  const completedChecks = simulationData.aiReport.actionItems.filter(
    (_, idx) => checkedItems[idx]
  ).length;

  const statusBadge = {
    DANGER: {
      bg: 'bg-red-500/20 border-red-500/70 text-red-300 shadow-[0_0_24px_rgba(239,68,68,0.4)]',
      dot: 'bg-red-500',
      label: 'CRITICAL DANGER · CODE RED',
      icon: ShieldAlert,
    },
    WARNING: {
      bg: 'bg-amber-500/20 border-amber-500/70 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      dot: 'bg-amber-400',
      label: 'WARNING · ELEVATED RISK',
      icon: AlertTriangle,
    },
    CLEAR: {
      bg: 'bg-emerald-500/20 border-emerald-500/70 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
      dot: 'bg-emerald-400',
      label: 'ALL CLEAR · NORMAL OPS',
      icon: ShieldCheck,
    },
  }[simulationData.status];

  const StatusIcon = statusBadge.icon;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 md:p-5 overflow-hidden">
      {/* TOP BAR: Cybernetic Mission Control Header + Golden Time & Evacuee Telemetry */}
      <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_35px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-cyan-300">
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-extrabold tracking-wider text-white font-mono">
                SAFECITY <span className="text-cyan-400">AI</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase rounded bg-cyan-950/90 text-cyan-300 border border-cyan-500/40">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Gemini 4 Argon × Verifier Loop
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              여의도역 B2 실시간 3D 재난 대피 디지털 트윈 · Google AI for Social Good
            </p>
          </div>
        </div>

        {/* Center Live Telemetry: Golden Time & 120 Evacuees Counter */}
        <div className="hidden xl:flex items-center gap-4 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-2">
            <Timer
              className={`w-4 h-4 ${
                simulationData.status === 'DANGER'
                  ? 'text-red-400 animate-pulse'
                  : 'text-cyan-400'
              }`}
            />
            <div>
              <div className="text-[9px] font-mono uppercase text-slate-400">GOLDEN TIME</div>
              <div
                className={`text-sm font-mono font-bold ${
                  simulationData.status === 'DANGER' ? 'text-red-300' : 'text-cyan-300'
                }`}
              >
                {formatTime(goldenTimeRemaining)}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[9px] font-mono uppercase text-slate-400">
                EVACUATION PROGRESS
              </div>
              <div className="text-xs font-mono font-bold text-emerald-300">
                {evacuatedCount} / {totalEvacuees}명 대피 완료{' '}
                <span className="text-yellow-300">(교통약자 {vulnerableEvacuees}명)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Korean AI Emergency PA Voice Broadcast + Status Badge */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleVoiceBroadcast}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
              isSpeaking
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.5)] animate-pulse'
                : 'bg-slate-900/90 border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/20'
            }`}
            title="역사 내 한국어 AI 비상 안내 방송 음성 송출 (Web Speech TTS)"
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-4 h-4 text-amber-300" />
                방송 중지
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-cyan-400" />
                AI 안내방송 송출
              </>
            )}
          </button>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs font-bold tracking-wider ${statusBadge.bg}`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusBadge.dot}`}
              />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusBadge.dot}`} />
            </span>
            <StatusIcon className="w-4 h-4" />
            <span>{statusBadge.label}</span>
          </div>
        </div>
      </header>

      {/* MIDDLE AREA: Left Multimodal Grounding + Right Argon Intelligence & Verifier Panel */}
      <div className="flex-1 flex flex-col lg:flex-row justify-between items-stretch gap-4 my-3 overflow-hidden">
        {/* LEFT COLUMN: Grounding Sources + Water Level Control + Quick Scenarios */}
        <div className="pointer-events-auto w-full lg:w-80 flex flex-col gap-2.5 self-start max-h-full overflow-y-auto pr-1">
          {/* Active Grounding Data Sources Card */}
          <div className="p-3 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 font-semibold">
                <Cpu className="w-3.5 h-3.5" />
                Multimodal Grounding Feeds
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-500/30">
                4 SYNCED
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200">
                <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">Yeouido_B2_CAD.pdf</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200">
                <CloudRain className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">KMA_110mm_HR.live</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">GoogleMaps_Elev.json</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200">
                <Droplets className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">IoT_FloodGate_01.bin</span>
              </div>
            </div>
          </div>

          {/* Real-Time Flood Water Level Controller */}
          <div className="p-3 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 shadow-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5 font-semibold">
                <Droplets className="w-4 h-4 text-sky-400" />
                실시간 침수 수위 (Water Level)
              </span>
              <span
                className={`text-sm font-mono font-extrabold px-2 py-0.5 rounded ${
                  simulationData.waterLevel >= 2.0
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : simulationData.waterLevel > 0.5
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {simulationData.waterLevel.toFixed(1)}m / 5.0m
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={simulationData.waterLevel}
              onChange={(e) => onManualWaterChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>0.0m (정상)</span>
              <span>1.5m (차수판 가동)</span>
              <span>5.0m (한계침수)</span>
            </div>
          </div>

          {/* Tactical Scenario Presets */}
          <div className="p-3 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 shadow-xl">
            <span className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              즉시 시뮬레이션 시나리오 (One-Click Test)
            </span>
            <div className="flex flex-col gap-1.5">
              {QUICK_SCENARIOS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onSubmitPrompt(item.prompt)}
                  className="text-left text-xs px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-cyan-950/70 text-slate-200 hover:text-cyan-200 border border-slate-800 hover:border-cyan-500/40 transition-all disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Argon Briefing + Companion Safety Verifier Loop + Checklists + Terminal */}
        <div className="pointer-events-auto w-full lg:w-[430px] flex flex-col gap-2.5 max-h-full overflow-y-auto pl-1">
          {/* Scenario & AI Tactical Analysis Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950/88 backdrop-blur-xl border border-cyan-500/30 shadow-2xl">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                GEMINI 4 ARGON TACTICAL REPORT
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                HAZARD: [{simulationData.dangerZone.join(', ')}]
              </span>
            </div>

            <h2 className="text-sm md:text-base font-bold text-white mb-1.5">
              {simulationData.scenario}
            </h2>

            <p className="text-xs leading-relaxed text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90 mb-2.5">
              {simulationData.aiReport.summary}
            </p>

            {/* Vulnerable & Wheelchair Accessible Priority Alert */}
            <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-400/50 mb-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-yellow-300 text-xs font-bold">
                  <Accessibility className="w-4 h-4 shrink-0" />
                  <span>교통약자 전용 방수 엘리베이터 #3 유도 지침</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-200 font-semibold">
                  {vulnerableEvacuees}명 우선 탑승
                </span>
              </div>
              <p className="text-xs text-yellow-100/90 leading-relaxed">
                {simulationData.aiReport.vulnerableNotice}
              </p>
            </div>

            {/* Argon × Companion Model Verification Loop Card (Hackathon Criterion #1 & #3) */}
            {simulationData.verificationLoop && (
              <div className="p-2.5 rounded-xl bg-cyan-950/35 border border-cyan-500/40 mb-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-cyan-300">
                    <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
                    ARGON × COMPANION VERIFICATION LOOP
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    신뢰도 {simulationData.verificationLoop.confidenceScore}% PASS
                  </span>
                </div>
                <div className="space-y-1">
                  {simulationData.verificationLoop.checks.map((chk, i) => (
                    <div
                      key={i}
                      className="text-[11px] bg-slate-900/85 px-2.5 py-1.5 rounded-lg border border-slate-800/90"
                    >
                      <div className="flex items-center justify-between font-mono text-emerald-300 font-semibold">
                        <span>✓ {chk.rule}</span>
                        <span className="text-[9px] text-cyan-400">VERIFIED</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">{chk.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Verifiable Field Checklists (Track 3 Core Requirement) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verifiable Field Checklist (현장 대응 실행 체크)
                </span>
                <span className="text-[10px] font-mono text-emerald-300">
                  {completedChecks}/{simulationData.aiReport.actionItems.length} 완료
                </span>
              </div>
              <ul className="space-y-1.5">
                {simulationData.aiReport.actionItems.map((item, idx) => {
                  const isDone = !!checkedItems[idx];
                  return (
                    <li
                      key={idx}
                      onClick={() => toggleChecklist(idx)}
                      className={`cursor-pointer flex items-start gap-2 text-xs p-2 rounded-lg border transition-all ${
                        isDone
                          ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-900/75 border-slate-800/90 text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {isDone ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      )}
                      <span className={isDone ? 'line-through opacity-85' : ''}>{item}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Live AI Agent Verification Loop Terminal */}
          <div className="p-3 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-slate-800/90 shadow-xl flex flex-col h-36">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Argon Multi-Agent Execution Log
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {isLoading ? 'COMPUTING...' : 'SYNCED'}
              </span>
            </div>
            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] pr-1"
            >
              {agentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-1.5 leading-tight">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span
                    className={`shrink-0 font-semibold ${
                      log.stage === 'VERIFIED'
                        ? 'text-emerald-400'
                        : log.stage === 'VERIFIER'
                        ? 'text-amber-300'
                        : log.stage === 'ARGON_CORE'
                        ? 'text-purple-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    [{log.stage}]
                  </span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM COMMAND CONSOLE: Natural Language + Voice Emergency Input */}
      <div className="pointer-events-auto w-full max-w-2xl mx-auto">
        <form
          onSubmit={handleFormSubmit}
          className="flex items-center gap-2 p-2 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-cyan-500/40 shadow-[0_0_30px_rgba(0,0,0,0.85)]"
        >
          <button
            type="button"
            onClick={handleVoiceInput}
            title="음성으로 재난 상황 보고 (Web Speech API)"
            className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all shrink-0 ${
              isListening
                ? 'bg-red-500/25 border-red-400 text-red-300 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-400'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="재난 상황을 입력하세요 (예: 1번 출구 계단 폭우 유입, 휠체어 승객 우회 경로 탐색)..."
            className="flex-1 bg-transparent text-xs md:text-sm text-white placeholder-slate-400 focus:outline-none font-mono px-2"
          />

          <button
            type="submit"
            disabled={isLoading || !promptInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono font-bold text-xs transition-all disabled:opacity-40 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isLoading ? '검증 중...' : 'AI 관제 실행'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
