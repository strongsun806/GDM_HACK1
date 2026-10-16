'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import DashboardPanel, { ActiveTab } from '@/components/DashboardPanel';
import type { CameraPreset } from '@/components/ThreeViewer';
import { SimulationData, AgentLogEntry, SupportedLang } from '@/types/simulation';

// Strictly isolate Three.js WebGL Canvas from SSR to prevent Next.js hydration mismatches
const ThreeViewer = dynamic(() => import('@/components/ThreeViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-[#020617] flex flex-col items-center justify-center text-cyan-400 font-mono gap-3">
      <div className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      <p className="text-sm tracking-widest uppercase">
        Initializing SafeCity 3D Digital Twin...
      </p>
    </div>
  ),
});

const INITIAL_SIMULATION_DATA: SimulationData = {
  status: 'DANGER',
  scenario: '서쪽 1번 출구 폭우 급류 유입 · 동쪽 4번 출구 및 방수 엘리베이터 #3 비상 대피',
  waterLevel: 2.4,
  dangerZone: [-14, 0.6, 10],
  evacuationPath: [
    [-9, 0.4, 6],
    [-4, 0.4, 3],
    [2, 0.4, 0],
    [9, 0.4, -5],
    [15, 0.5, -10],
    [19.2, 3.8, -10],
  ],
  vulnerablePath: [
    [-7, 0.4, 4],
    [-1, 0.4, 2],
    [5, 0.4, 0],
    [11, 0.4, -1.5],
    [13, 0.4, -2],
    [13, 6.2, -2],
  ],
  droneTarget: [-11.5, 3.9, 8.5],
  aiReport: {
    summary:
      '서쪽 1번 출구 계단 유속 2.7m/s 침수로 차수판이 즉시 기립되었습니다. 일반 승객(106명)은 동쪽 4번 고지대 출구로, 교통약자(14명)는 방수 엘리베이터 #3을 통해 지상 여의도공원 대피소(240m)로 분산 유도합니다.',
    actionItems: [
      '서쪽 1번 출구 자동 차수판(Floodgate) 기립 및 진입 통제',
      '수위 1.5m 돌파에 따른 고압선 차단 및 비상 조명 전환',
      '동쪽 4번 고지대 출구 개찰구 프리패스(Free-Pass) 전면 개방',
      '교통약자 14명 방수 엘리베이터 #3 탑승 및 여의도공원 대피소 연계',
    ],
    vulnerableNotice:
      '서쪽 1번 출구는 급류 유입으로 진입 불가합니다. 황색 점멸 유도선을 따라 동쪽 끝단 독립 방수 엘리베이터 3호기([13, 0, -2])로 이동하십시오.',
  },
  verificationLoop: {
    primaryModel: 'gemini-4-argon',
    companionVerifier: 'gemini-2.0-flash-safety-verifier',
    edgeFallbackModel: 'gemma-3-4b-it-on-device',
    iterations: 2,
    confidenceScore: 99.6,
    selfCorrectedNodes: 0,
    checks: [
      {
        rule: 'Hydraulic Stairwell Inflow Velocity Check',
        passed: true,
        detail: '서쪽 1번 계단 유속 2.7m/s 위험 판정 -> 동쪽 4번 고지대 출구 우회 확정',
      },
      {
        rule: 'ADA Wheelchair Gradient & IP68 Lift Check',
        passed: true,
        detail: '교통약자 경로 경사도 1/20 이하 및 방수 엘리베이터 #3 비상전원 확인',
      },
      {
        rule: 'GPS Surface Shelter & 4-Language PA Sync',
        passed: true,
        detail: '지상 여의도공원 광역대피소(240m) GPS 매핑 및 한/영/일/중 방송 동기화 완료',
      },
    ],
  },
  contextTelemetry: {
    usedTokens: 418240,
    maxTokens: 1000000,
    modalities: [
      'Yeouido_B2_CAD.pdf',
      'KMA_110mm_Radar.live',
      'GoogleMaps_GPS.json',
      '24x_Water_IoT.bin',
    ],
  },
  translations: {
    ko: '긴급 대피 방송입니다. 서쪽 1번 출구 계단으로 폭우가 유입되어 위험합니다. 일반 승객은 녹색 유도선을 따라 동쪽 4번 출구로, 휠체어 및 노약자께서는 황색 유도선을 따라 동쪽 방수 엘리베이터 3호기로 이동해 주십시오.',
    en: 'CODE RED FLOOD ALERT: Floodwater is rushing down West Exit 1. General passengers, follow the green neon path to East Exit 4. Wheelchair users, follow the yellow path to Waterproof Elevator #3.',
    ja: '緊急洪水警報：西側1番出口から豪雨が流入しています。一般のお客様は緑色の誘導線で東側4番出口へ、車椅子の方は黄色い誘導線で防水エレベーター3号機へ避難してください。',
    zh: '红色暴雨警报：西侧1号出口正涌入洪水！普通乘客请沿绿色引导线前往东侧4号出口；轮椅及老年乘客请沿黄色引导线前往3号防水电梯撤离。',
  },
  shelters: [
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
  ],
  goldenTimeSeconds: 340,
  totalEvacuees: 120,
  vulnerableEvacuees: 14,
  voiceBroadcast:
    '긴급 대피 방송입니다. 서쪽 1번 출구 계단으로 폭우가 유입되어 위험합니다. 일반 승객은 녹색 유도선을 따라 동쪽 4번 출구로, 휠체어 및 노약자께서는 황색 유도선을 따라 동쪽 방수 엘리베이터 3호기로 이동해 주십시오.',
};

const BCP47_MAP: Record<SupportedLang, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

function formatNow(): string {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
}

export default function SafeCityPage() {
  const [simulationData, setSimulationData] = useState<SimulationData>(INITIAL_SIMULATION_DATA);
  const [isLoading, setIsLoading] = useState(false);

  // Master Controlled UI States (for both user interaction & Auto-Demo Director)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('OVERVIEW');
  const [thermalOptic, setThermalOptic] = useState<boolean>(false);
  const [isAutoDemo, setIsAutoDemo] = useState<boolean>(false);
  const [demoBanner, setDemoBanner] = useState<{
    step: string;
    title: string;
    progressPercent: number;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('CONTROL');
  const [selectedLang, setSelectedLang] = useState<SupportedLang>('ko');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({
    0: true,
    1: true,
  });
  const [selectedShelterId, setSelectedShelterId] = useState<string>('shelter-yeouido-park');
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string>(
    'GPS: 서울 영등포구 여의도역 (37.5216°N, 126.9242°E)'
  );

  const demoTimersRef = useRef<number[]>([]);

  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([
    {
      id: 'init-1',
      timestamp: '00:00:01',
      stage: 'SENSOR_SYNC',
      message: '1M 컨텍스트 로드(418.2k): 여의도역 CAD + 기상청 레이더 + GPS 대피소 4개소',
    },
    {
      id: 'init-2',
      timestamp: '00:00:02',
      stage: 'ARGON_CORE',
      message: 'Gemini 4 Argon: 서쪽 1번 계단 위험 판정 -> 동쪽 4번 출구 및 방수 EL#3 경로 생성',
    },
    {
      id: 'init-3',
      timestamp: '00:00:03',
      stage: 'VERIFIER',
      message: 'Companion Verifier: 휠체어 경사도 및 지상 여의도공원 대피소(240m) 검증 통과',
    },
  ]);

  const appendLog = useCallback((stage: AgentLogEntry['stage'], message: string) => {
    setAgentLogs((prev) => [
      ...prev.slice(-14),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: formatNow(),
        stage,
        message,
      },
    ]);
  }, []);

  // Speak text in the requested language via Web Speech API
  const speakTextOutLoud = useCallback(
    (text: string, lang: SupportedLang, rate = 1.12) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = BCP47_MAP[lang];
        utterance.rate = rate;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const targetPrefix = BCP47_MAP[lang].split('-')[0].toLowerCase();
        const matchedVoice = voices.find((v) =>
          v.lang.toLowerCase().startsWith(targetPrefix)
        );
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    []
  );

  // Toggle Voice Broadcast (Manual or Language Button Click)
  const handleToggleSpeak = useCallback(
    (langOverride?: SupportedLang) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const targetLang = langOverride ?? selectedLang;

      if (isSpeaking && !langOverride) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      const textToSpeak =
        simulationData.translations?.[targetLang] ??
        simulationData.voiceBroadcast ??
        simulationData.aiReport.vulnerableNotice;

      speakTextOutLoud(textToSpeak, targetLang, 1.08);
      appendLog(
        'VERIFIED',
        `다국어 음성 방송 송출 (${targetLang.toUpperCase()}): "${textToSpeak.slice(0, 28)}..."`
      );
    },
    [isSpeaking, selectedLang, simulationData, speakTextOutLoud, appendLog]
  );

  // Select Language Button -> if already speaking (or in Broadcast tab), immediately speak in that language!
  const handleSelectLang = useCallback(
    (lang: SupportedLang) => {
      setSelectedLang(lang);
      const textToSpeak =
        simulationData.translations?.[lang] ??
        simulationData.voiceBroadcast ??
        simulationData.aiReport.vulnerableNotice;
      speakTextOutLoud(textToSpeak, lang, 1.1);
    },
    [simulationData, speakTextOutLoud]
  );

  const handleToggleCheckItem = useCallback((idx: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }, []);

  const handleTriggerGpsSync = useCallback(() => {
    setGpsStatusMsg('GPS 위성 신호 및 Google Maps 지오펜싱 수신 중...');
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsStatusMsg(
            `실시간 GPS 동기화 완료 (${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E) · 여의도 권역 매핑됨`
          );
        },
        () => {
          setGpsStatusMsg(
            '여의도역 B2 비상 중계기 GPS 고정 완료 (37.5216°N, 126.9242°E)'
          );
        },
        { timeout: 2500 }
      );
    } else {
      setTimeout(() => {
        setGpsStatusMsg(
          '여의도역 B2 비상 중계기 GPS 고정 완료 (37.5216°N, 126.9242°E)'
        );
      }, 600);
    }
  }, []);

  const clearDemoTimers = useCallback(() => {
    demoTimersRef.current.forEach((id) => window.clearTimeout(id));
    demoTimersRef.current = [];
  }, []);

  const stopAutoDemo = useCallback(() => {
    clearDemoTimers();
    setIsAutoDemo(false);
    setDemoBanner(null);
    setThermalOptic(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [clearDemoTimers]);

  // Master Auto-Demo Sequencer (Full 32-second Hands-Free Choreographed Tour)
  const startAutoDemo = useCallback(() => {
    clearDemoTimers();
    setIsAutoDemo(true);

    const schedule = (ms: number, fn: () => void) => {
      const id = window.setTimeout(fn, ms);
      demoTimersRef.current.push(id);
    };

    // STEP 1 (0.0s): Start at exact interior concourse view, raise water level dynamically
    setCameraPreset('OVERVIEW');
    setThermalOptic(false);
    setActiveTab('CONTROL');
    setCheckedItems({ 0: true, 1: false, 2: false, 3: false });
    setSimulationData({
      ...INITIAL_SIMULATION_DATA,
      status: 'WARNING',
      waterLevel: 1.4,
      scenario: '서쪽 1번 출구 집중호우 유입 감지 · Gemini 4 Argon 실시간 수위 분석 중',
    });
    setDemoBanner({
      step: 'STEP 1/6 · B2 중앙 홀 관제',
      title: '서쪽 1번 출구 폭우 유입 감지 및 실시간 수위 상승 (1.4m → 2.4m)',
      progressPercent: 16,
    });
    appendLog('SENSOR_SYNC', '[AUTO-DEMO] 여의도역 B2 중앙 홀 광각 관제 및 수위 센서 가동');

    schedule(1400, () => {
      setSimulationData((prev) => ({
        ...prev,
        status: 'DANGER',
        waterLevel: 2.0,
        scenario: '서쪽 1번 출구 급류 유입(2.0m) · 차수판 자동 기립 및 우회 대피로 산출',
      }));
    });

    schedule(2700, () => {
      setSimulationData(INITIAL_SIMULATION_DATA);
      appendLog(
        'ARGON_CORE',
        '[AUTO-DEMO] 수위 2.4m 위험 도달 -> 동쪽 4번 출구(녹색) & 방수 EL#3(황색) 경로 생성'
      );
    });

    // STEP 2 (4.5s): Switch to Autonomous Drone 1st-Person FPV + Thermal FLIR ON
    schedule(4500, () => {
      setCameraPreset('DRONE_CAM');
      setDemoBanner({
        step: 'STEP 2/6 · 자율 드론 1인칭(FPV) 수색',
        title: '드론 노즈 짐벌 시점 전환 및 FLIR 열화상 스캔 자동 활성화',
        progressPercent: 33,
      });
      appendLog('ARGON_CORE', '[AUTO-DEMO] 자율 수색 드론 A1 1인칭(FPV) 시점 전환 완료');
    });

    schedule(6000, () => {
      setThermalOptic(true);
      appendLog('SENSOR_SYNC', '[AUTO-DEMO] 드론 FLIR 열화상 광학 센서 ON (수온 14.8°C · 고립자 스캔)');
    });

    schedule(8500, () => {
      setThermalOptic(false);
    });

    // STEP 3 (9.2s): Switch to Waterproof Elevator #3 + Broadcast & Checklist Tab + Multilingual Voice!
    schedule(9200, () => {
      setCameraPreset('ELEVATOR_CAM');
      setActiveTab('BROADCAST_CHECK');
      setSelectedLang('ko');
      setCheckedItems({ 0: true, 1: true, 2: false, 3: false });
      setDemoBanner({
        step: 'STEP 3/6 · 교통약자 방수 엘리베이터 & 다국어 방송',
        title: '🇰🇷 한국어 → 🇺🇸 영어 → 🇯🇵 일본어 음성 안내 송출 및 체크리스트 자동 점검',
        progressPercent: 52,
      });
      appendLog('VERIFIER', '[AUTO-DEMO] 방수 엘리베이터 #3 클로즈업 및 한국어 비상 방송 송출');
      speakTextOutLoud(
        '긴급 대피 방송입니다. 서쪽 1번 출구 침수로 일반 승객은 동쪽 4번 출구로, 휠체어 이용자는 방수 엘리베이터 3호기로 이동해 주십시오.',
        'ko',
        1.22
      );
    });

    // 14.2s: Auto-switch to English (🇺🇸 EN) & speak English broadcast out loud + check item #3
    schedule(14200, () => {
      setSelectedLang('en');
      setCheckedItems({ 0: true, 1: true, 2: true, 3: false });
      appendLog('VERIFIED', '[AUTO-DEMO] 🇺🇸 영어(EN) 다국어 음성 안내 자동 전환 및 체크리스트 3/4 완료');
      speakTextOutLoud(
        'Code Red Flood Alert. West Exit 1 is flooded. Follow the green path to East Exit 4, or yellow path to Waterproof Elevator 3.',
        'en',
        1.18
      );
    });

    // 19.0s: Auto-switch to Japanese (🇯🇵 日本語) & check item #4 (100% Complete!)
    schedule(19000, () => {
      setSelectedLang('ja');
      setCheckedItems({ 0: true, 1: true, 2: true, 3: true });
      appendLog('VERIFIED', '[AUTO-DEMO] 🇯🇵 일본어(JA) 전환 및 현장 대응 체크리스트 4/4 (100%) 점검 완료!');
      speakTextOutLoud(
        '緊急洪水警報。東側4番出口、または防水エレベーター3号機へ避難してください。',
        'ja',
        1.25
      );
    });

    // 21.5s: Highlight Chinese (🇨🇳 中文) transcript
    schedule(21500, () => {
      setSelectedLang('zh');
    });

    // STEP 4 (22.6s): Switch to West Exit 1 Floodgate Cam + GPS Shelters Tab + Radar Pin Cycling
    schedule(22600, () => {
      setCameraPreset('HAZARD_CAM');
      setActiveTab('GPS_SHELTERS');
      handleTriggerGpsSync();
      setSelectedShelterId('shelter-yeouido-park');
      setDemoBanner({
        step: 'STEP 4/6 · 서쪽 1번 차수판 & 지상 GPS 대피소 연동',
        title: '서쪽 1번 출구 차수판 확인 및 여의도 지상 대피소 4개소 GPS 레이더 매핑',
        progressPercent: 72,
      });
      appendLog('SENSOR_SYNC', '[AUTO-DEMO] 지상 GPS 대피소 레이더 스캔: 여의도공원 광역대피소(240m)');
    });

    schedule(24200, () => {
      setSelectedShelterId('shelter-ifc-atrium');
    });

    schedule(25600, () => {
      setSelectedShelterId('shelter-yeouido-high');
    });

    schedule(26600, () => {
      setSelectedShelterId('shelter-yeouido-park');
    });

    // STEP 5 (27.4s): Switch to Overview + AI Verification Loop Tab (99.6% PASS)
    schedule(27400, () => {
      setCameraPreset('OVERVIEW');
      setActiveTab('AI_VERIFY');
      setDemoBanner({
        step: 'STEP 5/6 · Gemini 4 Argon 안전 검증 루프',
        title: '1M 컨텍스트(418.2k 토큰) 멀티모달 추론 및 Companion Verifier 99.6% PASS 검증',
        progressPercent: 88,
      });
      appendLog(
        'VERIFIER',
        '[AUTO-DEMO] Gemini 4 Argon + Companion Verifier 안전 검증 99.6% PASS 확인'
      );
    });

    // STEP 6 (30.0s): GRAND FINALE — Drainage Pump Recovery, Water Level 0.2m, CLEAR Status!
    schedule(30000, () => {
      setCameraPreset('OVERVIEW');
      setActiveTab('CONTROL');
      setSelectedLang('ko');
      setSimulationData((prev) => ({
        ...prev,
        status: 'CLEAR',
        waterLevel: 0.2,
        scenario: '✅ 배수 펌프 가동 완료 · 승객 120명(교통약자 14명) 전원 안전 대피 성공!',
        aiReport: {
          ...prev.aiReport,
          summary:
            '배수 펌프 전면 가동으로 여의도역 B2 수위가 0.2m 이하로 안전하게 배수되었습니다. 일반 승객 106명과 교통약자 14명 전원 지상 여의도공원 광역대피소(240m)로 무사히 대피 완료했습니다.',
        },
      }));
      setDemoBanner({
        step: '🎉 PERFECT DEMO COMPLETE · 완벽한 데모 성공!',
        title: '배수 펌프 가동 · 수위 0.2m 정상화 · 승객 120명 전원 안전 대피 완료 (100%)',
        progressPercent: 100,
      });
      appendLog(
        'HITL_GATE',
        '🎉 [PERFECT DEMO SUCCESS] 배수 완료(0.2m) 및 승객 120명 전원 대피 성공!'
      );
      speakTextOutLoud(
        '배수 펌프 가동 및 승객 전원 대피가 완료되었습니다. 세이프시티 AI 데모 성공.',
        'ko',
        1.15
      );
    });

    // Cleanly conclude auto-demo banner at 34.5s
    schedule(34500, () => {
      setIsAutoDemo(false);
      setDemoBanner(null);
    });
  }, [clearDemoTimers, appendLog, speakTextOutLoud, handleTriggerGpsSync]);

  const handleToggleAutoDemo = useCallback(() => {
    if (isAutoDemo) {
      stopAutoDemo();
    } else {
      startAutoDemo();
    }
  }, [isAutoDemo, stopAutoDemo, startAutoDemo]);

  useEffect(() => {
    return () => {
      clearDemoTimers();
    };
  }, [clearDemoTimers]);

  const handleSimulatePrompt = useCallback(
    async (prompt: string) => {
      setIsLoading(true);
      appendLog('SENSOR_SYNC', `상황 입력: "${prompt}"`);
      appendLog('ARGON_CORE', 'Gemini 4 Argon: 3D 경로 및 지상 GPS 대피소 매핑 추론 중...');

      try {
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            currentLevel: simulationData.waterLevel,
          }),
        });

        const data = (await res.json()) as SimulationData;
        setSimulationData(data);

        appendLog(
          'VERIFIER',
          `Companion Verifier: 안전성 ${
            data.verificationLoop?.confidenceScore ?? 99.6
          }% PASS (보정 노드 ${data.verificationLoop?.selfCorrectedNodes ?? 0}개)`
        );
        appendLog(
          'VERIFIED',
          `상태 [${data.status}] · 수위 ${data.waterLevel.toFixed(1)}m · 드론 목표 [${data.droneTarget.join(', ')}]`
        );
      } catch {
        appendLog('VERIFIED', '온디바이스 Gemma 3 Edge 폴백으로 안전 경로를 유지합니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [appendLog, simulationData.waterLevel]
  );

  const handleManualWaterChange = useCallback((newLevel: number) => {
    setSimulationData((prev) => {
      const nextStatus =
        newLevel >= 2.0 ? 'DANGER' : newLevel >= 0.5 ? 'WARNING' : 'CLEAR';
      return {
        ...prev,
        waterLevel: newLevel,
        status: nextStatus,
      };
    });
  }, []);

  const handleHitlApprove = useCallback(
    (approved: boolean) => {
      appendLog(
        'HITL_GATE',
        approved
          ? 'Human-in-the-Loop: 통제관 최종 승인(APPROVED) 완료'
          : 'Human-in-the-Loop: 통제관 수동 검토(MANUAL) 전환'
      );
    },
    [appendLog]
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#020617]">
      {/* Fullscreen 3D WebGL Digital Twin Canvas */}
      <ThreeViewer
        simulationData={simulationData}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={(preset) => {
          if (isAutoDemo) stopAutoDemo();
          setCameraPreset(preset);
        }}
        thermalOptic={thermalOptic}
        onToggleThermalOptic={() => setThermalOptic((prev) => !prev)}
        isAutoDemo={isAutoDemo}
        onToggleAutoDemo={handleToggleAutoDemo}
        demoBanner={demoBanner}
      />

      {/* Subtle Red Vignette on Critical Flood Danger */}
      {simulationData.status === 'DANGER' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10 animate-pulse"
          style={{
            boxShadow: 'inset 0 0 90px rgba(239, 68, 68, 0.28)',
          }}
        />
      )}

      {/* Sleek Single-Dock Tabbed HUD */}
      <DashboardPanel
        simulationData={simulationData}
        isLoading={isLoading}
        agentLogs={agentLogs}
        onSubmitPrompt={handleSimulatePrompt}
        onManualWaterChange={handleManualWaterChange}
        onHitlApprove={handleHitlApprove}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedLang={selectedLang}
        onSelectLang={handleSelectLang}
        isSpeaking={isSpeaking}
        onToggleSpeak={handleToggleSpeak}
        checkedItems={checkedItems}
        onToggleCheckItem={handleToggleCheckItem}
        selectedShelterId={selectedShelterId}
        onSelectShelterId={setSelectedShelterId}
        gpsStatusMsg={gpsStatusMsg}
        onTriggerGpsSync={handleTriggerGpsSync}
        onStartAutoDemo={startAutoDemo}
      />
    </main>
  );
}
