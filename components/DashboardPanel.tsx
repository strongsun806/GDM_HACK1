'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SimulationData,
  AgentLogEntry,
  SupportedLang,
  SurfaceShelter,
} from '@/types/simulation';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Waves,
  Accessibility,
  Send,
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  Clock,
  Users,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Cpu,
  UserCheck,
  Globe,
  Database,
  MapPin,
  Navigation,
  ChevronRight,
  ChevronLeft,
  Sliders,
  Compass,
  Video,
  Square,
} from 'lucide-react';

export type ActiveTab = 'CONTROL' | 'GPS_SHELTERS' | 'BROADCAST_CHECK' | 'AI_VERIFY';

interface DashboardPanelProps {
  simulationData: SimulationData;
  isLoading: boolean;
  agentLogs: AgentLogEntry[];
  onSubmitPrompt: (prompt: string) => Promise<void>;
  onManualWaterChange: (waterLevel: number) => void;
  onHitlApprove?: (approved: boolean) => void;
  // Controlled props for seamless Master Auto-Demo Director synchronization
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  selectedLang: SupportedLang;
  onSelectLang: (lang: SupportedLang) => void;
  isSpeaking: boolean;
  onToggleSpeak: (langOverride?: SupportedLang) => void;
  checkedItems: Record<number, boolean>;
  onToggleCheckItem: (idx: number) => void;
  selectedShelterId: string;
  onSelectShelterId: (id: string) => void;
  gpsStatusMsg: string;
  onTriggerGpsSync: () => void;
  onStartAutoDemo: () => void;
}

const DEFAULT_SHELTERS: SurfaceShelter[] = [
  {
    id: 'shelter-yeouido-park',
    name: '여의도공원 잔디광장 광역대피소',
    type: '고지대 야외 광역대피소',
    lat: 37.5241,
    lng: 126.9228,
    distanceMeters: 240,
    elevationMeters: 18.5,
    etaMinutes: 4,
    wheelchairAccessible: true,
    occupancyPercent: 34,
    connectedExit: '동쪽 4번 고지대 출구 · 엘리베이터 #3',
    bearing: 'NNE 22°',
  },
  {
    id: 'shelter-ifc-atrium',
    name: 'IFC몰 노스 아트리움 지상 대피소',
    type: '내진·방수 복합건물 지상홀',
    lat: 37.5251,
    lng: 126.9255,
    distanceMeters: 310,
    elevationMeters: 19.2,
    etaMinutes: 5,
    wheelchairAccessible: true,
    occupancyPercent: 48,
    connectedExit: '동쪽 4번 출구 · 무장애 경사로',
    bearing: 'NW 315°',
  },
  {
    id: 'shelter-yeouido-high',
    name: '여의도고등학교 다목적 체육관',
    type: '지자체 지정 이재민 구호소',
    lat: 37.5238,
    lng: 126.9312,
    distanceMeters: 540,
    elevationMeters: 22.4,
    etaMinutes: 8,
    wheelchairAccessible: true,
    occupancyPercent: 21,
    connectedExit: '동쪽 4번 출구 직진 보행로',
    bearing: 'ENE 68°',
  },
  {
    id: 'shelter-assembly-plaza',
    name: '국회의사당 잔디마당 비상대피소',
    type: '국가 중요시설 광역 구호거점',
    lat: 37.5318,
    lng: 126.9141,
    distanceMeters: 890,
    elevationMeters: 24.0,
    etaMinutes: 12,
    wheelchairAccessible: true,
    occupancyPercent: 15,
    connectedExit: '방수 엘리베이터 #3 지상 셔틀 연계',
    bearing: 'WNW 295°',
  },
];

const QUICK_SCENARIOS = [
  {
    label: '🚨 폭우 계단 침수 (2.4m)',
    shortDesc: '서쪽 1번 출구 급류 유입 · 동쪽 4번/EL#3 우회',
    prompt:
      '시간당 110mm 극한 호우로 서쪽 1번 출구 계단이 폭포수처럼 침수되어 수위가 2.4m에 도달했습니다. 휠체어 이용자 14명과 일반 승객 106명의 대피 경로 및 인근 GPS 대피소를 산출하세요.',
  },
  {
    label: '⚡ 정전 · 유독연기 복합재난 (1.6m)',
    shortDesc: '북쪽 변전실 침수 스파크 · 무정전 엘리베이터 가동',
    prompt:
      '수위가 1.6m로 상승하며 북쪽 승강장 배전반 침수로 정전과 연기가 발생했습니다. 비상 독립 전원이 연결된 방수 엘리베이터 3호기 및 동쪽 고지대 출구로 우회 대피를 지시하세요.',
  },
  {
    label: '✅ 배수 펌프 가동 · 복구 (0.1m)',
    shortDesc: '수위 0.1m 하강 · 전 출구 정상 통행 재개',
    prompt:
      '배수 펌프 최대 가동으로 수위가 0.1m 이하로 내려가고 모든 위험 요인이 완전히 해제되었습니다.',
  },
];

export const LANG_CONFIG: Record<
  SupportedLang,
  { label: string; flag: string; ttsLang: string }
> = {
  ko: { label: '한국어', flag: '🇰🇷', ttsLang: 'ko-KR' },
  en: { label: 'EN', flag: '🇺🇸', ttsLang: 'en-US' },
  ja: { label: '日本語', flag: '🇯🇵', ttsLang: 'ja-JP' },
  zh: { label: '中文', flag: '🇨🇳', ttsLang: 'zh-CN' },
};

export default function DashboardPanel({
  simulationData,
  isLoading,
  agentLogs,
  onSubmitPrompt,
  onManualWaterChange,
  onHitlApprove,
  activeTab,
  onSelectTab,
  selectedLang,
  onSelectLang,
  isSpeaking,
  onToggleSpeak,
  checkedItems,
  onToggleCheckItem,
  selectedShelterId,
  onSelectShelterId,
  gpsStatusMsg,
  onTriggerGpsSync,
  onStartAutoDemo,
}: DashboardPanelProps) {
  const [isDockOpen, setIsDockOpen] = useState(true);
  const [promptInput, setPromptInput] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    simulationData.goldenTimeSeconds ?? 340
  );
  const [isListening, setIsListening] = useState(false);
  const [hitlApproved, setHitlApproved] = useState<boolean>(true);

  // Built-in Demo Video Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const shelters =
    simulationData.shelters && simulationData.shelters.length > 0
      ? simulationData.shelters
      : DEFAULT_SHELTERS;

  useEffect(() => {
    setRemainingSeconds(simulationData.goldenTimeSeconds ?? 340);
  }, [simulationData.goldenTimeSeconds]);

  useEffect(() => {
    if (simulationData.status === 'CLEAR') return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [simulationData.status]);

  const currentBroadcastText =
    simulationData.translations?.[selectedLang] ||
    simulationData.voiceBroadcast ||
    simulationData.aiReport.vulnerableNotice;

  // Built-in 1-Click Screen / Tab Video Recorder (.webm download) + Auto-Starts Demo Tour!
  const handleToggleScreenRecord = useCallback(async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 },
        audio: true,
      });

      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SafeCity_AI_Demo_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
      };

      recorder.start(200);
      setIsRecording(true);
      // Automatically trigger the full choreographed Auto-Demo Tour 600ms after recording starts!
      setTimeout(() => {
        onStartAutoDemo();
      }, 600);
    } catch {
      setIsRecording(false);
    }
  }, [isRecording, onStartAutoDemo]);

  const handleVoiceMicInput = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      const sample =
        '서쪽 1번 출구 계단 폭우 유입 심각, 휠체어 탑승객 14명 방수 엘리베이터 3호기 및 여의도공원 대피소 유도 요망';
      setPromptInput(sample);
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setPromptInput(transcript);
        onSubmitPrompt(transcript);
      }
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [isListening, onSubmitPrompt]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isLoading) return;
    await onSubmitPrompt(promptInput.trim());
    setPromptInput('');
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const statusBadge = {
    DANGER: {
      label: 'CODE RED · 침수 위험',
      bg: 'bg-red-500/20 border-red-500/70 text-red-200',
      dot: 'bg-red-500',
      icon: <ShieldAlert className="w-4 h-4 text-red-400 animate-bounce" />,
    },
    WARNING: {
      label: 'WARNING · 수위 경계',
      bg: 'bg-amber-500/20 border-amber-500/70 text-amber-200',
      dot: 'bg-amber-400',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    },
    CLEAR: {
      label: 'CLEAR · 정상 가동',
      bg: 'bg-emerald-500/20 border-emerald-500/70 text-emerald-200',
      dot: 'bg-emerald-400',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    },
  }[simulationData.status];

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalActions = simulationData.aiReport.actionItems.length || 1;
  const checklistProgress = Math.round((completedCount / totalActions) * 100);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-2.5 sm:p-4 overflow-hidden">
      {/* =====================================================================
          1. COMPACT TOP TELEMETRY BAR (Includes 1-Click Demo Video Recorder!)
      ===================================================================== */}
      <header className="pointer-events-auto w-full flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center">
            <Waves className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                SAFECITY <span className="text-cyan-400">AI</span>
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950/90 text-cyan-300 border border-cyan-500/40">
                <Sparkles className="w-2.5 h-2.5" /> Gemini 4 Argon · 여의도역 B2
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all ${statusBadge.bg}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusBadge.dot} animate-ping`} />
            {statusBadge.icon}
            <span>{statusBadge.label}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-mono">
            <span className="text-slate-400">수위</span>
            <span className="font-bold text-cyan-300">
              {simulationData.waterLevel.toFixed(1)}m
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-red-400" />
            <span
              className={`font-bold ${
                simulationData.status === 'DANGER' ? 'text-red-400' : 'text-emerald-300'
              }`}
            >
              {simulationData.status === 'CLEAR'
                ? 'SAFE'
                : formatCountdown(remainingSeconds)}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-mono text-slate-200">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>{simulationData.totalEvacuees ?? 120}명</span>
            <span className="text-amber-300">
              (♿ {simulationData.vulnerableEvacuees ?? 14})
            </span>
          </div>

          {/* 1-Click Demo Video Recorder Button */}
          <button
            type="button"
            onClick={handleToggleScreenRecord}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              isRecording
                ? 'bg-red-500/30 border-red-400 text-red-200 animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 border-rose-500/50 text-rose-300'
            }`}
            title="클릭 시 화면 녹화와 동시에 자동 데모 투어가 시작됩니다!"
          >
            {isRecording ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current text-red-400" />
                <span>녹화 완료·저장</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">데모 녹화</span>
              </>
            )}
          </button>

          {/* Dock Collapse / Expand Button */}
          <button
            type="button"
            onClick={() => setIsDockOpen((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition-all"
            title={isDockOpen ? '관제 패널 접기 (3D 전체화면)' : '관제 패널 펼치기'}
          >
            {isDockOpen ? (
              <>
                <span className="hidden sm:inline">패널 접기</span>
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>관제 패널 열기</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* =====================================================================
          2. SINGLE RESPONSIVE TABBED CONTROL DOCK (Right Side, Collapsible)
      ===================================================================== */}
      {isDockOpen && (
        <aside className="pointer-events-auto self-end my-auto w-full sm:w-[375px] md:w-[400px] max-h-[calc(100vh-125px)] flex flex-col rounded-2xl bg-slate-950/88 backdrop-blur-2xl border border-slate-800/90 shadow-2xl overflow-hidden">
          <div className="grid grid-cols-4 gap-1 p-1.5 bg-slate-900/95 border-b border-slate-800">
            <button
              type="button"
              onClick={() => onSelectTab('CONTROL')}
              className={`py-2 px-1 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                activeTab === 'CONTROL'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400 ring-2 ring-cyan-400/30 shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>실시간 관제</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('GPS_SHELTERS')}
              className={`py-2 px-1 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                activeTab === 'GPS_SHELTERS'
                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400 ring-2 ring-emerald-400/30 shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>GPS 대피소</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('BROADCAST_CHECK')}
              className={`py-2 px-1 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                activeTab === 'BROADCAST_CHECK'
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-400 ring-2 ring-amber-400/30 shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>방송·체크</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('AI_VERIFY')}
              className={`py-2 px-1 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                activeTab === 'AI_VERIFY'
                  ? 'bg-purple-500/25 text-purple-200 border border-purple-400 ring-2 ring-purple-400/30 shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>AI 검증</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
            {activeTab === 'CONTROL' && (
              <>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                      현재 재난 시나리오
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      드론 목표 [{simulationData.droneTarget.join(', ')}]
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white leading-snug">
                    {simulationData.scenario}
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">
                    {simulationData.aiReport.summary}
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div className="px-2.5 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-[11px] text-emerald-200 font-medium truncate">
                        일반: 동쪽 4번 출구
                      </span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg bg-amber-950/50 border border-amber-500/40 flex items-center gap-1.5">
                      <Accessibility className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-[11px] text-amber-200 font-medium truncate">
                        약자: 방수 EL #3
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Waves className="w-3.5 h-3.5 text-cyan-400" />
                      실시간 침수 수위 제어
                    </span>
                    <span className="text-base font-mono font-extrabold text-cyan-300">
                      {simulationData.waterLevel.toFixed(1)}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={simulationData.waterLevel}
                    onChange={(e) => onManualWaterChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                    <span>0.0m 정상</span>
                    <span className="text-amber-400">1.5m 단전</span>
                    <span className="text-red-400">2.4m 위험</span>
                    <span>5.0m 한계</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    원클릭 재난 시나리오 시뮬레이션
                  </span>
                  {QUICK_SCENARIOS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isLoading}
                      onClick={() => onSubmitPrompt(item.prompt)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 transition-all group disabled:opacity-50"
                    >
                      <div className="text-xs font-bold text-slate-100 group-hover:text-cyan-300">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.shortDesc}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'GPS_SHELTERS' && (
              <>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-emerald-400 animate-spin" />
                      <span className="text-xs font-bold text-white">
                        GPS 지상 광역대피소 레이더
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onTriggerGpsSync}
                      className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-[10px] font-mono font-bold text-emerald-200 flex items-center gap-1 transition-all"
                    >
                      <Navigation className="w-3 h-3" />
                      내 GPS 동기화
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono">
                    <span className="text-emerald-300 font-bold">
                      37.5216°N, 126.9242°E
                    </span>
                    <span className="text-slate-400">±3.8m 고정밀</span>
                  </div>

                  <div className="relative h-36 rounded-xl bg-[#04121c] border border-emerald-500/30 overflow-hidden flex items-center justify-center">
                    <div className="w-28 h-28 rounded-full border border-emerald-500/25" />
                    <div className="absolute w-16 h-16 rounded-full border border-emerald-500/35" />
                    <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-500/20" />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-500/20" />

                    <div className="relative z-10 flex flex-col items-center">
                      <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white animate-ping absolute" />
                      <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white relative" />
                      <span className="mt-1 px-1.5 py-0.2 rounded bg-slate-950/90 text-[9px] font-mono text-red-300">
                        여의도역(현위치)
                      </span>
                    </div>

                    {[
                      { id: 'shelter-yeouido-park', top: '20%', left: '62%', short: '여의도공원(240m)' },
                      { id: 'shelter-ifc-atrium', top: '24%', left: '26%', short: 'IFC몰(310m)' },
                      { id: 'shelter-yeouido-high', top: '65%', left: '74%', short: '여의도고(540m)' },
                      { id: 'shelter-assembly-plaza', top: '72%', left: '20%', short: '국회의사당(890m)' },
                    ].map((pin) => {
                      const isSel = selectedShelterId === pin.id;
                      return (
                        <button
                          key={pin.id}
                          type="button"
                          onClick={() => onSelectShelterId(pin.id)}
                          style={{ top: pin.top, left: pin.left }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-mono transition-all flex items-center gap-1 ${
                            isSel
                              ? 'bg-emerald-400 text-slate-950 font-extrabold scale-115 ring-4 ring-emerald-400/40 shadow-lg z-20'
                              : 'bg-slate-900/90 text-emerald-300 border border-emerald-500/50 hover:scale-105'
                          }`}
                        >
                          <MapPin className="w-2.5 h-2.5" />
                          {pin.short}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] font-mono text-emerald-300">{gpsStatusMsg}</p>
                </div>

                <div className="space-y-2">
                  {shelters.map((sh) => {
                    const isSelected = sh.id === selectedShelterId;
                    return (
                      <div
                        key={sh.id}
                        onClick={() => onSelectShelterId(sh.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-950/50 border-emerald-400 ring-2 ring-emerald-400/30 shadow-md'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">
                                {sh.name}
                              </span>
                              {sh.wheelchairAccessible && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/50 text-[9px] font-mono text-amber-300">
                                  ♿ 무장애
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              연계 출구: {sh.connectedExit}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-xs font-extrabold shrink-0">
                            {sh.distanceMeters}m
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                          <div className="text-slate-300">
                            해발고도:{' '}
                            <span className="text-cyan-300 font-bold">
                              {sh.elevationMeters}m
                            </span>
                          </div>
                          <div className="text-slate-300">
                            도보:{' '}
                            <span className="text-emerald-300 font-bold">
                              약 {sh.etaMinutes}분
                            </span>
                          </div>
                          <div className="text-slate-300 text-right">
                            수용률:{' '}
                            <span className="text-amber-300 font-bold">
                              {sh.occupancyPercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {activeTab === 'BROADCAST_CHECK' && (
              <>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      다국어 비상 안내방송 (TTS)
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleSpeak()}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 border transition-all ${
                        isSpeaking
                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 animate-pulse'
                          : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/30'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5" /> 음성 송출 중...
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" /> 음성 송출
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    {(['ko', 'en', 'ja', 'zh'] as SupportedLang[]).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          onSelectLang(lang);
                          onToggleSpeak(lang);
                        }}
                        className={`py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                          selectedLang === lang
                            ? 'bg-cyan-500/30 border-cyan-400 text-white ring-2 ring-cyan-400/40 scale-105'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {LANG_CONFIG[lang].flag} {LANG_CONFIG[lang].label}
                      </button>
                    ))}
                  </div>

                  <p className="p-2.5 rounded-lg bg-slate-950/90 border border-cyan-500/30 text-[11px] text-cyan-100 leading-relaxed">
                    “{currentBroadcastText}”
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold">
                    <Accessibility className="w-4 h-4" />
                    교통약자 14명 방수 엘리베이터 #3 우선 유도
                  </div>
                  <p className="text-[11px] text-amber-100/90 leading-relaxed">
                    {simulationData.aiReport.vulnerableNotice}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      현장 대응 체크리스트
                    </span>
                    <span className="text-[11px] font-mono text-cyan-400 font-bold">
                      {completedCount}/{totalActions} ({checklistProgress}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${checklistProgress}%` }}
                    />
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {simulationData.aiReport.actionItems.map((item, idx) => {
                      const done = !!checkedItems[idx];
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onToggleCheckItem(idx)}
                          className={`w-full text-left p-2 rounded-lg border text-[11px] flex items-start gap-2 transition-all ${
                            done
                              ? 'bg-emerald-950/40 border-emerald-400/60 text-emerald-200'
                              : 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          )}
                          <span className={done ? 'line-through opacity-85' : ''}>
                            {item}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-[11px] font-bold text-white">
                        역무 통제관 최종 승인 (HITL)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        차수판 기립 및 개찰구 전면 개방
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !hitlApproved;
                      setHitlApproved(next);
                      onHitlApprove?.(next);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                      hitlApproved
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-amber-500/20 border-amber-400 text-amber-300'
                    }`}
                  >
                    {hitlApproved ? 'APPROVED' : 'MANUAL'}
                  </button>
                </div>
              </>
            )}

            {activeTab === 'AI_VERIFY' && (
              <>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" />
                      Gemini 4 Argon · 1M Context
                    </span>
                    <span className="text-[11px] font-mono text-white font-bold">
                      418.2k / 1,000k
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400"
                      style={{ width: '42%' }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(
                      simulationData.contextTelemetry?.modalities ?? [
                        'Yeouido_CAD.pdf',
                        'KMA_Radar.live',
                        'GoogleMaps_GPS.json',
                        '24x_Water_IoT.bin',
                      ]
                    ).map((m, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[9px] font-mono text-slate-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {simulationData.verificationLoop && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300">
                        교차 검증 신뢰도 (Self-Correction)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-extrabold">
                        {simulationData.verificationLoop.confidenceScore.toFixed(1)}% PASS
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {simulationData.verificationLoop.checks.map((chk, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-slate-950/90 border border-slate-800/90 text-[11px]"
                        >
                          <div className="font-mono font-bold text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">{chk.rule}</span>
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            {chk.detail}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    실시간 에이전트 추론 로그
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[10px]">
                    {agentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-1.5 rounded bg-slate-950/90 border border-slate-800/70 text-slate-300"
                      >
                        <span className="text-cyan-400 font-bold">[{log.stage}]</span>{' '}
                        {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <form
            onSubmit={handleFormSubmit}
            className="p-2.5 bg-slate-900/95 border-t border-slate-800 flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={handleVoiceMicInput}
              className={`p-2 rounded-xl border transition-all shrink-0 ${
                isListening
                  ? 'bg-red-500/25 border-red-400 text-red-300 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-cyan-300'
              }`}
              title="음성으로 재난 상황 보고"
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              disabled={isLoading}
              placeholder="재난 상황 입력 (예: 1번 출구 침수, 휠체어 대피)..."
              className="flex-1 bg-slate-950 text-xs text-white placeholder-slate-500 px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={isLoading || !promptInput.trim()}
              className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>실행</span>
            </button>
          </form>
        </aside>
      )}
    </div>
  );
}
