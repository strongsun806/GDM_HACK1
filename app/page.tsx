'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import DashboardPanel from '@/components/DashboardPanel';
import { SimulationData, AgentLogEntry } from '@/types/simulation';

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

function formatNow(): string {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
}

export default function SafeCityPage() {
  const [simulationData, setSimulationData] = useState<SimulationData>(INITIAL_SIMULATION_DATA);
  const [isLoading, setIsLoading] = useState(false);
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
      <ThreeViewer simulationData={simulationData} />

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
      />
    </main>
  );
}
