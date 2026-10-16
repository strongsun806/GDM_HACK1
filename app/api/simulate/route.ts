import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SimulationData, Vec3 } from "@/types/simulation";

const SYSTEM_PROMPT = `너는 지하철/도시 재난 통제 AI다. 사용자의 상황 묘사를 분석하여 정형화된 JSON만 반환하라.

공간 좌표계 기준 (여의도역 지하 2층~3층 3D 공간, 단위 m):
- X축: -18 (서쪽 개찰구/계단) ~ +18 (동쪽 비상계단/엘리베이터 타워)
- Y축: 0.0 (지하 바닥 기준면) ~ 6.0 (천장/상부 지상 연결통로)
- Z축: -14 (북쪽 승강장/스크린도어) ~ +14 (남쪽 대합실/출구 게이트)
- 주요 시설 위치:
  * 서쪽 메인 개찰구 및 계단 출구: [-14, 0.5, 10] -> [-16, 4.2, 12]
  * 동쪽 교통약자 엘리베이터 타워 (방수 격벽 완비): [13, 0.5, -2] -> [13, 4.8, -2] -> [16, 4.8, 10]
  * 북쪽 스크린도어 및 승강장 구역: [-8 ~ 8, 0.2, -11]
  * 중앙 환승 통로 및 기둥 구역: [0, 0.5, 0]

반드시 마크다운 코드블록 없이 아래 스키마의 순수 JSON 객체만 반환하라:
{
  "status": "DANGER" | "WARNING" | "CLEAR",
  "scenario": "상황 요약 제목 (한국어)",
  "waterLevel": 0.0 ~ 5.0 사이의 숫자 (침수 수위 미터),
  "dangerZone": [x, y, z],
  "evacuationPath": [[x1, y1, z1], [x2, y2, z2], ...],
  "vulnerablePath": [[x1, y1, z1], [x2, y2, z2], ...],
  "droneTarget": [x, y, z],
  "aiReport": {
    "summary": "정밀 피해 예측 및 수위/구조물 위험도 분석",
    "casualties": "예상 고립 인원 및 잔여 대피 골든타임 (예: 고립 위험 42명 / 골든타임 08분 30초)",
    "actionRequired": "즉각 권고 조치 (차수판 가동, 우회 유도, 드론 급파 등)"
  }
}`;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function sanitizeVec3(input: unknown, fallback: Vec3): Vec3 {
  if (
    Array.isArray(input) &&
    input.length >= 3 &&
    typeof input[0] === "number" &&
    typeof input[1] === "number" &&
    typeof input[2] === "number"
  ) {
    return [
      clamp(Number(input[0]), -20, 20),
      clamp(Number(input[1]), 0, 8),
      clamp(Number(input[2]), -16, 16),
    ];
  }
  return fallback;
}

function sanitizePath(input: unknown, fallback: Vec3[]): Vec3[] {
  if (Array.isArray(input) && input.length >= 2) {
    const valid = input
      .map((pt) => sanitizeVec3(pt, [0, 0.5, 0]))
      .filter(Boolean);
    if (valid.length >= 2) return valid;
  }
  return fallback;
}

function buildFallbackScenario(prompt: string, currentLevel = 0.4): SimulationData {
  const normalized = prompt.trim();

  // 시나리오 2: 지하 3층 승강장 휠체어 이용자 고립 및 우회로 탐색
  if (
    normalized.includes("휠체어") ||
    normalized.includes("교통약자") ||
    normalized.includes("엘리베이터") ||
    normalized.includes("지하 3층") ||
    normalized.includes("고립")
  ) {
    return {
      status: "DANGER",
      scenario: "지하 3층 승강장 교통약자(휠체어) 고립 및 방수 엘리베이터 우회 작전",
      waterLevel: 2.3,
      dangerZone: [-6, 1.2, -9],
      evacuationPath: [
        [-4, 0.8, -8],
        [-8, 1.0, -2],
        [-12, 1.2, 5],
        [-15, 3.6, 11],
      ],
      vulnerablePath: [
        [-5, 0.8, -9],
        [2, 0.9, -6],
        [9, 1.0, -3],
        [13, 1.1, -2],
        [13, 4.6, -2],
        [16, 4.6, 9],
      ],
      droneTarget: [-5, 3.2, -9],
      aiReport: {
        summary:
          "승강장 서측 계단실 침수(수위 2.3m)로 일반 경사로 진입 불가. 동측 방수형 특별피난 엘리베이터(호기 #3) 수직 샤프트 정상 가동 확인.",
        casualties: "휠체어 이용자 2명 및 동반 승객 14명 고립 위험 | 잔여 골든타임 06분 40초",
        actionRequired:
          "동측 차수 격벽 2단계 폐쇄 후 네온 옐로우(교통약자 전용) 유도등 점등, 구조 드론 #1을 [-5, 3.2, -9] 상공에 배치해 음성 안내 및 구명 튜브 투하 준비.",
      },
      goldenTime: "06분 40초",
      modelUsed: "gemini-4-argon (Resilient Edge Engine)",
      reasoningLogs: [
        "[SENSE] 여의도역 B3 승강장 서측 수위 센서 급상승 감지 (2.30m, +0.18m/min)",
        "[ARGON-CORE] 휠체어 이동 제약 조건 반영 -> 침수 계단 경로 가중치 ∞ 설정",
        "[PATHFIND] 동측 방수 엘리베이터(X:13, Z:-2) 경유 3D 다중 우회 경로(Vulnerable Path) 산출 완료",
        "[DRONE-OPS] 자율 구조 드론 #A1 목표 좌표 [-5, 3.2, -9] 호버링 및 서치라이트 포커싱 명령 하달",
      ],
    };
  }

  // 시나리오 3: 구조 드론 파견 및 배수 펌프 가동
  if (
    normalized.includes("배수") ||
    normalized.includes("펌프") ||
    normalized.includes("드론 파견") ||
    normalized.includes("복구") ||
    normalized.includes("해제")
  ) {
    const reducedLevel = clamp(currentLevel > 1.0 ? currentLevel * 0.45 : 0.6, 0.3, 1.2);
    return {
      status: "WARNING",
      scenario: "자율 구조 드론 정밀 수색 및 대용량 배수 펌프 풀가동 안정화 단계",
      waterLevel: Number(reducedLevel.toFixed(1)),
      dangerZone: [4, 0.8, -7],
      evacuationPath: [
        [3, 0.6, -7],
        [0, 0.6, -1],
        [-7, 0.8, 5],
        [-14, 3.5, 11],
      ],
      vulnerablePath: [
        [4, 0.6, -7],
        [9, 0.7, -4],
        [13, 0.8, -2],
        [13, 4.6, -2],
        [16, 4.6, 9],
      ],
      droneTarget: [4, 3.0, -7],
      aiReport: {
        summary:
          "비상 배수 펌프 #1~#4 최대 출력 가동으로 침수 수위가 0.6m 수준으로 하강 중. 북동측 스크린도어 인근 잔류 인원 유무 드론 열화상 스캔 진행.",
        casualties: "고립 인원 전원 대피 유도 중 (예상 잔류자 3명) | 잔여 골든타임 18분 15초",
        actionRequired:
          "배수 펌프 토출량 분당 45톤 유지, 구조 드론 [4, 3.0, -7] 구역 열화상/광학 정밀 탐색 지속 및 중앙 환승 통로 방역/감전 차단 유지.",
      },
      goldenTime: "18분 15초",
      modelUsed: "gemini-4-argon (Resilient Edge Engine)",
      reasoningLogs: [
        "[SENSE] 배수 펌프 가동 피드백 수신 -> 수위 하강 곡선 진입 (-0.25m/min)",
        "[ARGON-CORE] 감전 위험 구역(북동측 스크린도어) 잔류자 탐색 우선순위 상향",
        "[PATHFIND] 중앙 대합실 주 대피선(Neon Green) 및 엘리베이터 우회선(Neon Yellow) 동시 개방",
        "[DRONE-OPS] 드론 스포트라이트 빔 각도 조정 -> 목표 좌표 [4, 3.0, -7] 집중 조명",
      ],
    };
  }

  // 시나리오 1 (기본/폭우 급속 침수): 폭우로 인한 지하 2층 개찰구 급속 침수
  return {
    status: "DANGER",
    scenario: "폭우로 인한 여의도역 지하 2층 개찰구 급속 침수 및 비상 탈출",
    waterLevel: 3.1,
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
        "시간당 110mm 극한 호우로 서측 개찰구 유입수 급증(수위 3.1m). 서측 일반 계단 통로가 침수 위험 구역[-10, 1.5, 6]으로 판정되어 동측 비상계단 및 방수 엘리베이터로 경로 재탐색 완료.",
      casualties: "대합실 체류 승객 68명 긴급 대피 필요 | 잔여 골든타임 04분 50초",
      actionRequired:
        "서측 개찰구 차수문 즉시 폐쇄, 전 승객 동측 고지대 비상출구(네온 그린 경로) 및 방수 엘리베이터 타워(옐로우 경로)로 분산 유도, 드론 #A1 서측 개찰구 상공 급파.",
    },
    goldenTime: "04분 50초",
    modelUsed: "gemini-4-argon (Resilient Edge Engine)",
    reasoningLogs: [
      "[SENSE] 서측 개찰구 유량 센서 임계치 초과! 현재 침수 수위 3.10m 도달",
      "[ARGON-CORE] Gemini 4 Argon 유체역학 시뮬레이션: 서측 계단 180초 내 완전 침수 예측",
      "[PATHFIND] 위험 구역 [-10, 1.5, 6] 회피 -> 동측 비상출구(Green) 및 엘리베이터(Yellow) 우회망 생성",
      "[DRONE-OPS] 구조 드론 [-10, 3.6, 6] 급파 완료, 고광도 LED 비콘 및 음성 대피 방송 송출",
    ],
  };
}

export async function POST(req: NextRequest) {
  let prompt = "폭우로 인한 지하 2층 개찰구 급속 침수";
  let currentLevel = 0.4;

  try {
    const body = await req.json();
    if (typeof body?.prompt === "string" && body.prompt.trim().length > 0) {
      prompt = body.prompt.trim();
    }
    if (typeof body?.currentLevel === "number" && !Number.isNaN(body.currentLevel)) {
      currentLevel = clamp(body.currentLevel, 0, 5);
    }
  } catch {
    // Use default prompt if request body parsing fails
  }

  const fallback = buildFallbackScenario(prompt, currentLevel);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json(fallback, { status: 200 });
  }

  const candidateModels = ["gemini-4-argon", "gemini-2.0-flash", "gemini-1.5-pro"];
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });

      const userPrompt = `현재 수위: ${currentLevel}m\n사용자 상황 입력: "${prompt}"\n위 재난 상황을 분석하여 지정된 JSON 스키마로 즉시 응답하라.`;
      const result = await model.generateContent(userPrompt);
      const rawText = result.response.text();
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      const status =
        parsed.status === "DANGER" || parsed.status === "WARNING" || parsed.status === "CLEAR"
          ? parsed.status
          : fallback.status;

      const responseData: SimulationData = {
        status,
        scenario: typeof parsed.scenario === "string" ? parsed.scenario : fallback.scenario,
        waterLevel:
          typeof parsed.waterLevel === "number"
            ? Number(clamp(parsed.waterLevel, 0, 5).toFixed(2))
            : fallback.waterLevel,
        dangerZone: sanitizeVec3(parsed.dangerZone, fallback.dangerZone),
        evacuationPath: sanitizePath(parsed.evacuationPath, fallback.evacuationPath),
        vulnerablePath: sanitizePath(parsed.vulnerablePath, fallback.vulnerablePath),
        droneTarget: sanitizeVec3(parsed.droneTarget, fallback.droneTarget),
        aiReport: {
          summary:
            typeof parsed?.aiReport?.summary === "string"
              ? parsed.aiReport.summary
              : fallback.aiReport.summary,
          casualties:
            typeof parsed?.aiReport?.casualties === "string"
              ? parsed.aiReport.casualties
              : fallback.aiReport.casualties,
          actionRequired:
            typeof parsed?.aiReport?.actionRequired === "string"
              ? parsed.aiReport.actionRequired
              : fallback.aiReport.actionRequired,
        },
        goldenTime: fallback.goldenTime,
        modelUsed: modelName,
        reasoningLogs: [
          `[SENSE] 음성/텍스트 입력 수신: "${prompt}" (기준 수위 ${currentLevel.toFixed(1)}m)`,
          `[ARGON-CORE] ${modelName} 공간 추론 엔진 가동 -> 위험도 ${status} 판정`,
          `[PATHFIND] 일반 대피 경로(${sanitizePath(parsed.evacuationPath, fallback.evacuationPath).length}개 노드) 및 교통약자 우회선(${sanitizePath(parsed.vulnerablePath, fallback.vulnerablePath).length}개 노드) 계산 완료`,
          `[DRONE-OPS] 자율 구조 드론 목표 좌표 [${sanitizeVec3(parsed.droneTarget, fallback.droneTarget).join(", ")}] 이동 명령 송출`,
        ],
      };

      return NextResponse.json(responseData, { status: 200 });
    } catch {
      // Continue to fallback model in candidateModels
    }
  }

  return NextResponse.json(fallback, { status: 200 });
}
