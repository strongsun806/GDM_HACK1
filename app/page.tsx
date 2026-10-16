"use client";

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Shield, Radio, Cpu, Eye } from "lucide-react";
import VoiceController from "@/components/VoiceController";
import DashboardPanel from "@/components/DashboardPanel";
import { SimulationData, SystemLogEntry } from "@/types/simulation";

// Next.js App Router SSR 충돌 방지를 위해 ThreeViewer를 dynamic import (ssr: false)로 로드
const ThreeViewer = dynamic(() => import("@/components/ThreeViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#02050b] flex flex-col items-center justify-center gap-3 text-cyan-400 font-mono">
      <div className="w-11 h-11 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(6,182,212,0.5)]" />
      <p className="text-xs tracking-widest uppercase animate-pulse">
        INITIALIZING 3D DIGITAL TWIN MONITOR (YEOUIDO B2-B3)...
      </p>
    </div>
  ),
});

const INITIAL_SIMULATION: SimulationData = {
  status: "DANGER",
  scenario: "폭우로 인한 여의도역 지하 2층 개찰구 급속 침수 및 비상 탈출",
  waterLevel: 2.4,
  dangerZone: [-10, 1.5, 6],
  evacuationPath: [
    [-9, 1.2, 5],
    [-2, 1.2, 2],
    [6, 1.4, 4],
    [12, 2.2, 8],
    [16, 4.5, 11],
  ],
  vulnerablePath: [
    [-8, 1.2, 2],
    [1, 1.2, -1],
    [8, 1.2, -2],
    [13, 1.3, -2],
    [13, 4.6, -2],
    [16, 4.6, 9],
  ],
  droneTarget: [-10, 3.6, 6],
  aiReport: {
    summary:
      "시간당 110mm 극한 호우로 서측 개찰구 유입수 급증(수위 2.4m). 서측 일반 계단이 위험 구역[-10, 1.5, 6]으로 판정되어 동측 비상계단 및 방수 엘리베이터로 경로 재탐색 완료.",
    casualties: "대합실 체류 승객 68명 긴급 대피 필요 | 잔여 골든타임 04분 50초",
    actionRequired:
      "서측 개찰구 차수문 즉시 폐쇄, 일반 승객은 동남측 비상출구(네온 그린 경로)로, 휠체어/교통약자는 동측 방수 엘리베이터 타워(옐로우 경로)로 분산 유도.",
  },
};

function getTimeStr(): string {
  const now = new Date();
  return now.toTimeString().split(" ")[0];
}

export default function SafeCityPage() {
  const [simulation, setSimulation] = useState<SimulationData>(INITIAL_SIMULATION);
  const [isLoading, setIsLoading] = useState(false);
  const [scenarioTrigger, setScenarioTrigger] = useState(0);
  const [logs, setLogs] = useState<SystemLogEntry[]>([
    {
      id: "init-1",
      timestamp: "11:30:01",
      stage: "SYSTEM",
      message: "[SYSTEM] SafeCity AI 3D Digital Twin 관제 모니터 (여의도역 B2-B3) 가동",
      level: "info",
    },
    {
      id: "init-2",
      timestamp: "11:30:02",
      stage: "ARGON-CORE",
      message: "[ARGON-CORE] Gemini 4 Argon 멀티모달 재난 추론 루프 온라인",
      level: "success",
    },
    {
      id: "init-3",
      timestamp: "11:30:03",
      stage: "PATHFIND",
      message: "[PATHFINDER] 홀로그램 대피선(Green Flow) 및 교통약자 우회선(Yellow Pulse) 활성화",
      level: "warn",
    },
    {
      id: "init-4",
      timestamp: "11:30:04",
      stage: "DRONE-OPS",
      message: "[DRONE-OPS] 기동 드론 #A1 서치라이트(SpotLight) 위험 구역 [-10, 1.5, 6] 조준 완료",
      level: "critical",
    },
  ]);

  const appendLog = useCallback(
    (
      message: string,
      level: SystemLogEntry["level"] = "info",
      stage: SystemLogEntry["stage"] = "ARGON-CORE"
    ) => {
      setLogs((prev) => [
        ...prev.slice(-38),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: getTimeStr(),
          stage,
          message,
          level,
        },
      ]);
    },
    []
  );

  // 관제실 현장감을 높이는 주기적 텔레메트리 백그라운드 로그 스트림
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulation((currentSim) => {
        const telemetryMessages = [
          `[SYSTEM] 수위 파동 센서 동기화 중... 현재 침수 수위 ${currentSim.waterLevel.toFixed(2)}m`,
          `[PATHFINDER] 대피 경로 유동 인구 밀도 스캔 완료 -> 병목 없음`,
          `[DRONE-OPS] 드론 #A1 광학/열화상 스포트라이트 좌표 [${currentSim.droneTarget.join(", ")}] 유지 중`,
        ];
        const pick =
          telemetryMessages[Math.floor(Math.random() * telemetryMessages.length)];
        appendLog(pick, currentSim.status === "DANGER" ? "warn" : "info", "SYSTEM");
        return currentSim;
      });
    }, 9500);

    return () => clearInterval(interval);
  }, [appendLog]);

  const handleSimulate = useCallback(
    async (prompt: string, presetId?: string) => {
      setIsLoading(true);
      setScenarioTrigger((c) => c + 1);

      appendLog(
        `[SYSTEM] ⚡ 긴급 시나리오 체인 리액션 발동: "${prompt}"`,
        "critical",
        "SENSE"
      );

      if (presetId === "scenario-1") {
        appendLog(
          "[SENSE] 폭우 유입량 급증 감지 -> 지하 2층 서측 개찰구 차수벽 경보 발령!",
          "critical",
          "SENSE"
        );
      } else if (presetId === "scenario-2") {
        appendLog(
          "[PATHFINDER] 지하 3층 휠체어 이용자 감지 -> 동측 방수 엘리베이터 #3 최우선 호출!",
          "warn",
          "PATHFIND"
        );
      } else if (presetId === "scenario-3") {
        appendLog(
          "[DRONE-OPS] 대용량 배수 펌프 #1~#4 최대 출력 가동 및 구조 드론 수색 개시!",
          "success",
          "DRONE-OPS"
        );
      }

      try {
        const response = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            currentLevel: simulation.waterLevel,
          }),
        });

        const data: SimulationData = await response.json();
        setSimulation(data);
        setScenarioTrigger((c) => c + 1);

        if (Array.isArray(data.reasoningLogs) && data.reasoningLogs.length > 0) {
          data.reasoningLogs.forEach((line, idx) => {
            setTimeout(() => {
              const normalizedLine = line.replace("[PATHFIND]", "[PATHFINDER]");
              const level: SystemLogEntry["level"] =
                normalizedLine.includes("DANGER") || normalizedLine.includes("초과")
                  ? "critical"
                  : normalizedLine.includes("PATHFINDER")
                  ? "success"
                  : idx === 1
                  ? "warn"
                  : "info";
              appendLog(normalizedLine, level);
            }, (idx + 1) * 260);
          });
        } else {
          appendLog(
            `[ARGON-CORE] 시나리오 "${data.scenario}" 3D 공간 동기화 완료 (수위 ${data.waterLevel}m)`,
            data.status === "DANGER" ? "critical" : "success"
          );
        }
      } catch {
        appendLog(
          "[SYSTEM] 통신 지연 감지 -> 로컬 안전 시뮬레이션 프로토콜 유지",
          "warn",
          "SYSTEM"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [appendLog, simulation.waterLevel]
  );

  const handleWaterLevelOverride = useCallback(
    (newLevel: number) => {
      setSimulation((prev) => ({
        ...prev,
        waterLevel: newLevel,
        status: newLevel >= 2.2 ? "DANGER" : newLevel >= 0.8 ? "WARNING" : "CLEAR",
      }));
      appendLog(
        `[SYSTEM] 수동 수위 제어 오버라이드 -> 침수 수위 ${newLevel.toFixed(1)}m 적용`,
        newLevel >= 2.2 ? "critical" : "info",
        "SYSTEM"
      );
    },
    [appendLog]
  );

  return (
    <main className="relative w-screen h-screen bg-[#02050b] text-slate-100 flex flex-col overflow-hidden">
      {/* 가상 상황실 CCTV / 디지털 트윈 모니터 외곽 음영(Vignette) 및 디지털 스캔라인 노이즈 필터 */}
      <div className="pointer-events-none fixed inset-0 z-30 cctv-vignette" />
      <div className="pointer-events-none fixed inset-0 z-30 cctv-scanlines opacity-35" />

      {/* 상단 프레임리스 관제탑 헤더 */}
      <header className="h-13 px-5 py-2.5 bg-slate-950/90 backdrop-blur-2xl border-b border-cyan-500/30 shadow-[0_4px_30px_rgba(0,0,0,0.8)] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/60 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.45)]">
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xs sm:text-sm md:text-base font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
              <span>SafeCity AI: Autonomous Disaster Response Simulator</span>
              <span className="hidden md:inline text-cyan-400 font-mono font-normal text-xs">
                | Powered by Gemini 4 Argon
              </span>
            </h1>
            <span className="text-[10px] font-mono text-slate-400 tracking-widest uppercase">
              GOOGLE AI FOR SOCIAL GOOD // CENTRAL METROPOLITAN FLOOD COMMAND
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2.5 text-xs font-mono">
          <div className="px-2.5 py-1 rounded bg-slate-900/90 border border-purple-500/40 text-purple-200 flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.2)]">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>ENGINE: {simulation.modelUsed || "gemini-4-argon"}</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-slate-900/90 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>CCTV-TWIN #04</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-rose-950/60 border border-rose-500/50 text-rose-300 flex items-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.3)]">
            <Radio className="w-3.5 h-3.5 animate-pulse text-rose-400" />
            <span>LIVE TELEMETRY</span>
          </div>
        </div>
      </header>

      {/* 메인 관제 레이아웃 (좌측 70%: 시네마틱 3D 캔버스 / 우측 30%: 인터랙티브 보이스 + 재난 상황판) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative z-10">
        {/* 좌측 70%: 3D 시뮬레이션 캔버스 */}
        <section className="w-full lg:w-[70%] h-[50vh] lg:h-full relative border-b lg:border-b-0 lg:border-r border-cyan-500/25">
          <ThreeViewer simulation={simulation} scenarioTrigger={scenarioTrigger} />
        </section>

        {/* 우측 30%: VoiceController + DashboardPanel 수직 분할 배치 */}
        <aside className="w-full lg:w-[30%] h-[50vh] lg:h-full p-3 bg-[#030711]/95 flex flex-col gap-2.5 overflow-hidden">
          <VoiceController onSimulate={handleSimulate} isLoading={isLoading} />
          <DashboardPanel
            simulation={simulation}
            logs={logs}
            isLoading={isLoading}
            onWaterLevelOverride={handleWaterLevelOverride}
          />
        </aside>
      </div>
    </main>
  );
}
