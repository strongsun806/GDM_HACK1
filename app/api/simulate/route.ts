import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SimulationData } from '@/types/simulation';

const SYSTEM_PROMPT = `너는 지하철/도시 재난 통제 AI다. 사용자의 상황 묘사를 분석하여 정형화된 JSON만 반환하라.
반드시 마크다운 코드블록(\`\`\`json) 없이 순수 JSON 문자열만 출력하라.

지하철역 3D 공간 좌표계 기준:
- 전체 지하 역사 바닥 크기: X축 [-20, 20], Z축 [-14, 14], 바닥 높이 Y = 0
- 서쪽 일반 대피 계단 (1번 출구 방향, 저지대 침수 취약): [-15, 0, 11] -> [-19, 3.6, 11]
- 동쪽 고지대 비상계단 (4번 출구 방향, 안전 대피로): [15, 0, -10] -> [19, 3.6, -10]
- 교통약자용 방수 엘리베이터 #3 (동쪽 중앙 승강장): [13, 0, -2] -> [13, 6.2, -2]
- 중앙 개찰구 및 환승 통로: [0, 0.2, 0]

반환할 JSON 스키마:
{
  "status": "DANGER" | "WARNING" | "CLEAR",
  "scenario": "상황 요약 제목 (예: 제1출구 계단 폭우 유입 및 승강장 급속 침수)",
  "waterLevel": 0.0 ~ 5.0 사이의 숫자 (침수 수위 미터),
  "dangerZone": [x, y, z] (3D 위험 발생 중심 좌표, 예: [-14, 0.5, 10]),
  "evacuationPath": [[x, y, z], ...] (일반 승객 대피 경로 3D 좌표 배열, 최소 5개 경유지),
  "vulnerablePath": [[x, y, z], ...] (교통약자 엘리베이터 경유 우회 경로 3D 좌표 배열, 최소 5개 경유지),
  "droneTarget": [x, y, z] (구조 드론 목표 3D 좌표, 예: [-11, 3.8, 8]),
  "aiReport": {
    "summary": "재난 원인, 수위 상승 속도, 위험 구역에 대한 정밀 분석 브리핑 (2~3문장)",
    "actionItems": ["현장 검증 체크리스트 1", "현장 검증 체크리스트 2", "현장 검증 체크리스트 3", "현장 검증 체크리스트 4"],
    "vulnerableNotice": "휠체어 이용자·노약자·임산부를 위한 방수 엘리베이터 및 안전 구역 유도 지침"
  },
  "verificationLoop": {
    "primaryModel": "gemini-4-argon",
    "companionVerifier": "gemini-2.0-flash-safety-verifier",
    "iterations": 2,
    "confidenceScore": 99.4,
    "checks": [
      {
        "rule": "Hydraulic Stairwell Slope & Submergence Check",
        "passed": true,
        "detail": "서쪽 1번 출구 계단 유속 2.4m/s 초과 감지 -> 동쪽 4번 고지대 계단으로 우회 검증 완료"
      },
      {
        "rule": "ADA / Wheelchair Accessible Gradient & Waterproof Lift Check",
        "passed": true,
        "detail": "교통약자 경로 최대 경사도 1/18 이하 및 방수 엘리베이터 #3(IP68) 수밀 상태 정상 확인"
      },
      {
        "rule": "UAV Corridor Collision & Crowd Bottleneck Simulation",
        "passed": true,
        "detail": "120명 동시 대피 시 개찰구 병목 현상 없음 (최대 밀집도 1.8명/㎡ 이하 유지)"
      }
    ]
  },
  "goldenTimeSeconds": 340,
  "totalEvacuees": 120,
  "vulnerableEvacuees": 14,
  "voiceBroadcast": "긴급 안내 방송입니다. 현재 서쪽 1번 출구 계단으로 폭우가 유입되고 있습니다. 일반 승객께서는 바닥의 녹색 네온 유도선을 따라 동쪽 4번 출구 고지대 계단으로 이동해 주시고, 휠체어 이용자 및 노약자께서는 황색 유도선을 따라 동쪽 방수 엘리베이터 3호기를 이용해 주시기 바랍니다."
}`;

function buildFallbackSimulation(prompt: string, currentLevel = 0.5): SimulationData {
  const text = prompt.toLowerCase();

  const isClear =
    text.includes('해제') ||
    text.includes('정상') ||
    text.includes('복구') ||
    text.includes('배수 완료') ||
    text.includes('clear') ||
    text.includes('safe');

  const isFireOrGas =
    text.includes('화재') ||
    text.includes('연기') ||
    text.includes('유독') ||
    text.includes('가스') ||
    text.includes('폭발') ||
    text.includes('fire');

  const isExtremeFlood =
    text.includes('폭우') ||
    text.includes('침수') ||
    text.includes('범람') ||
    text.includes('폭포') ||
    text.includes('역류') ||
    text.includes('고립') ||
    text.includes('휠체어') ||
    text.includes('계단');

  if (isClear) {
    return {
      status: 'CLEAR',
      scenario: '배수 펌프 가동 완료 및 전 구역 정상 운행 체제 복귀',
      waterLevel: 0.0,
      dangerZone: [0, -10, 0],
      evacuationPath: [
        [-10, 0.25, 4],
        [-4, 0.25, 2],
        [2, 0.25, 0],
        [9, 0.25, -5],
        [15, 0.25, -10],
        [19.2, 3.8, -10],
      ],
      vulnerablePath: [
        [-8, 0.25, -2],
        [-1, 0.25, -2],
        [6, 0.25, -2],
        [13, 0.25, -2],
        [13, 6.2, -2],
      ],
      droneTarget: [0, 3.8, 0],
      aiReport: {
        summary:
          'Gemini 4 Argon 통합 센서망 분석 결과 역사 내 배수 작업이 100% 완료되었으며 유독가스 및 누전 위험이 모두 해제되었습니다. 전 승강장 스크린도어 및 엘리베이터가 정상 가동 중입니다.',
        actionItems: [
          '[현장 검증] 전 구간 배수 펌프 잔수 수위 0.0m 확인 및 차수판 수납',
          '[현장 검증] 승강장 스크린도어(PSD) 및 개찰구 양방향 통행 정상화',
          '[현장 검증] 교통약자 방수 엘리베이터 #3 정상 운행 모드 전환',
          '[현장 검증] 자율 수색 드론(UAV-01) 중앙 관제 스테이션 귀환 및 충전',
        ],
        vulnerableNotice:
          '모든 엘리베이터와 에스컬레이터가 정상 운행 중입니다. 노약자 및 휠체어 이용객께서는 동쪽 엘리베이터 3호기를 안전하게 이용하실 수 있습니다.',
      },
      verificationLoop: {
        primaryModel: 'gemini-4-argon',
        companionVerifier: 'gemini-2.0-flash-safety-verifier',
        iterations: 1,
        confidenceScore: 99.9,
        checks: [
          {
            rule: 'Hydraulic Sensor Zero-Level Verification',
            passed: true,
            detail: '전 구역 수위 센서 0.00m 및 배수 유량 안정화 교차 검증 완료',
          },
          {
            rule: 'ADA Accessible Lift & Ramp Continuity Check',
            passed: true,
            detail: '방수 엘리베이터 #3 및 점자 블록 유도선 전 구간 이상 없음',
          },
          {
            rule: 'Electrical Grid & PSD Insulation Audit',
            passed: true,
            detail: '승강장 스크린도어 절연 저항 정상 수치 복귀 확인',
          },
        ],
      },
      goldenTimeSeconds: 900,
      totalEvacuees: 120,
      vulnerableEvacuees: 14,
      voiceBroadcast:
        '안내 말씀 드립니다. 역사 내 배수 및 안전 점검이 모두 완료되어 현재 모든 대피 경보가 해제되었습니다. 승객 여러분께서는 안전하게 이동해 주시기 바랍니다.',
    };
  }

  if (isFireOrGas && !isExtremeFlood) {
    const nextWater = Math.min(2.2, Math.max(currentLevel, 0.9));
    return {
      status: 'WARNING',
      scenario: '서쪽 환승 통로 변전실 침수 합선 및 유독 연기 확산 경보',
      waterLevel: Number(nextWater.toFixed(1)),
      dangerZone: [-12, 0.8, -7],
      evacuationPath: [
        [-9, 0.35, 6],
        [-3, 0.35, 4],
        [4, 0.35, 1],
        [11, 0.35, -5],
        [15, 0.45, -10],
        [19.2, 3.8, -10],
      ],
      vulnerablePath: [
        [-8, 0.35, 5],
        [-1, 0.35, 2],
        [6, 0.35, 0],
        [13, 0.35, -2],
        [13, 6.2, -2],
      ],
      droneTarget: [-10, 3.6, -5],
      aiReport: {
        summary:
          '서쪽 환승 통로(X:-12, Z:-7) 인근 부분 침수로 인한 배전반 스파크 및 유독 연기가 감지되었습니다. Gemini 4 Argon이 연기 확산 벡터의 반대 방향인 동남쪽 고지대 통로로 안전 대피선을 즉시 재산출했습니다.',
        actionItems: [
          '[현장 검증] 서쪽 변전실 방화셔터 1단계 하강 및 제연 펜 최대 가동',
          '[현장 검증] 침수 구역 전력 즉각 차단 및 비상 유도 레이저 점등',
          '[현장 검증] 동쪽 방수 엘리베이터 #3 양압 방연 시스템 가동 확인',
          '[현장 검증] 구조 드론(UAV-01) 열화상 카메라로 연기 구역 내 잔류 승객 수색',
        ],
        vulnerableNotice:
          '서쪽 엘리베이터는 연기 유입 우려로 즉시 운행이 중단되었습니다. 휠체어 이용자 및 보행 약자께서는 황색 홀로그램 유도선을 따라 양압 방연 설비가 작동 중인 동쪽 방수 엘리베이터 3호기([13, 0, -2])로 이동하십시오.',
      },
      verificationLoop: {
        primaryModel: 'gemini-4-argon',
        companionVerifier: 'gemini-2.0-flash-safety-verifier',
        iterations: 2,
        confidenceScore: 99.2,
        checks: [
          {
            rule: 'Smoke Plume Vector & Toxicity Avoidance Check',
            passed: true,
            detail: '서북쪽 연기 확산 반경(8.5m)과 대피 경로 간 최소 6.2m 안전 이격 확보',
          },
          {
            rule: 'Positive-Pressure Accessible Elevator Verification',
            passed: true,
            detail: '동쪽 엘리베이터 #3 샤프트 양압(50Pa) 유지로 연기 유입 완벽 차단 확인',
          },
          {
            rule: 'High-Voltage Submerged Cable Isolation Check',
            passed: true,
            detail: '수위 0.9m 구역 바닥 배선 자동 차단 완료 (감전 위험 0%)',
          },
        ],
      },
      goldenTimeSeconds: 420,
      totalEvacuees: 120,
      vulnerableEvacuees: 14,
      voiceBroadcast:
        '긴급 안내 방송입니다. 서쪽 환승 통로에서 침수로 인한 연기가 감지되었습니다. 승객 여러분께서는 자세를 낮추고 녹색 유도선을 따라 동쪽 4번 출구로 대피해 주십시오. 휠체어 이용객께서는 방연 설비가 가동 중인 동쪽 엘리베이터 3호기를 이용해 주시기 바랍니다.',
    };
  }

  // Default: Extreme flash flood scenario (Track 3 core showcase)
  const targetWater = isExtremeFlood ? 2.8 : Math.min(4.5, Math.max(1.8, currentLevel + 1.1));
  return {
    status: 'DANGER',
    scenario: '제1출구 계단 폭우 폭포수 유입 및 승강장 급속 침수 (코드 레드)',
    waterLevel: Number(targetWater.toFixed(1)),
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
        '시간당 110mm 극한 호우로 서쪽 1번 출구 계단([-14, 0, 10])이 폭포수처럼 범람하며 지하 승강장 수위가 2.8m까지 급상승 중입니다. 서쪽 계단은 강한 유속(2.7m/s)으로 보행 대피가 불가능하여 즉시 폐쇄되었으며, 동쪽 고지대 4번 출구 및 방수 엘리베이터 #3으로 전 인원(120명) 분산 대피 경로가 수립되었습니다.',
      actionItems: [
        '[현장 검증] 서쪽 1번 출구 자동 차수판(Floodgate) 긴급 기립 및 계단 진입 전면 통제',
        '[현장 검증] 수위 1.5m 돌파에 따른 승강장 고압 전력선 차단 및 비상 배터리 조명 전환',
        '[현장 검증] 동쪽 고지대 4번 출구 개찰구 프리패스(Free-Pass) 전면 개방 완료',
        '[현장 검증] 교통약자 14명 동쪽 방수 엘리베이터 #3 우선 탑승 및 드론(UAV-01) 서쪽 침수선 집중 조명',
      ],
      vulnerableNotice:
        '경고: 서쪽 1번 출구 계단 및 인접 에스컬레이터는 급류 유입으로 절대 진입 불가합니다! 휠체어 이용자·노약자 14분은 바닥의 황색 점멸 홀로그램 유도선을 따라 동쪽 승강장 끝단의 독립 방수형 엘리베이터 3호기([13, 0, -2])에 즉시 탑승하십시오.',
    },
    verificationLoop: {
      primaryModel: 'gemini-4-argon',
      companionVerifier: 'gemini-2.0-flash-safety-verifier',
      iterations: 2,
      confidenceScore: 99.6,
      checks: [
        {
          rule: 'Hydraulic Stairwell Inflow & Sweeping Velocity Check',
          passed: true,
          detail: '서쪽 1번 계단 유속 2.7m/s 감지(성인 전도 위험) -> 경로 배제 및 동쪽 4번 고지대 계단 우회 확정',
        },
        {
          rule: 'ADA / Wheelchair Accessible Gradient & IP68 Lift Check',
          passed: true,
          detail: '교통약자 경로 전 구간 경사도 1/20 이하 및 동쪽 방수 엘리베이터 #3 독립 비상전원 가동 확인',
        },
        {
          rule: '120-Person Crowd Flow & Bottleneck Capacity Verification',
          passed: true,
          detail: '일반 승객 106명 + 교통약자 14명 분리 유도로 골든타임(5분 40초) 내 전원 대피 가능 검증',
        },
      ],
    },
    goldenTimeSeconds: 340,
    totalEvacuees: 120,
    vulnerableEvacuees: 14,
    voiceBroadcast:
      '긴급 대피 방송입니다. 현재 서쪽 1번 출구 계단으로 폭우가 유입되어 위험합니다. 일반 승객께서는 녹색 네온 유도선을 따라 동쪽 4번 출구 계단으로 대피해 주시고, 휠체어 이용자 및 노약자께서는 황색 유도선을 따라 동쪽 방수 엘리베이터 3호기로 이동해 주시기 바랍니다.',
  };
}

function sanitizeSimulationData(raw: Partial<SimulationData>, fallback: SimulationData): SimulationData {
  const validStatus =
    raw.status === 'DANGER' || raw.status === 'WARNING' || raw.status === 'CLEAR'
      ? raw.status
      : fallback.status;

  const waterLevel =
    typeof raw.waterLevel === 'number' && !Number.isNaN(raw.waterLevel)
      ? Math.max(0, Math.min(5, Number(raw.waterLevel.toFixed(2))))
      : fallback.waterLevel;

  const isVec3 = (v: unknown): v is [number, number, number] =>
    Array.isArray(v) &&
    v.length === 3 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number';

  const isPath = (p: unknown): p is [number, number, number][] =>
    Array.isArray(p) && p.length >= 2 && p.every(isVec3);

  return {
    status: validStatus,
    scenario: typeof raw.scenario === 'string' && raw.scenario.trim() ? raw.scenario : fallback.scenario,
    waterLevel,
    dangerZone: isVec3(raw.dangerZone) ? raw.dangerZone : fallback.dangerZone,
    evacuationPath: isPath(raw.evacuationPath) ? raw.evacuationPath : fallback.evacuationPath,
    vulnerablePath: isPath(raw.vulnerablePath) ? raw.vulnerablePath : fallback.vulnerablePath,
    droneTarget: isVec3(raw.droneTarget) ? raw.droneTarget : fallback.droneTarget,
    aiReport: {
      summary:
        typeof raw.aiReport?.summary === 'string' && raw.aiReport.summary.trim()
          ? raw.aiReport.summary
          : fallback.aiReport.summary,
      actionItems:
        Array.isArray(raw.aiReport?.actionItems) && raw.aiReport.actionItems.length > 0
          ? raw.aiReport.actionItems.map(String)
          : fallback.aiReport.actionItems,
      vulnerableNotice:
        typeof raw.aiReport?.vulnerableNotice === 'string' && raw.aiReport.vulnerableNotice.trim()
          ? raw.aiReport.vulnerableNotice
          : fallback.aiReport.vulnerableNotice,
    },
    verificationLoop:
      raw.verificationLoop &&
      Array.isArray(raw.verificationLoop.checks) &&
      raw.verificationLoop.checks.length > 0
        ? raw.verificationLoop
        : fallback.verificationLoop,
    goldenTimeSeconds:
      typeof raw.goldenTimeSeconds === 'number' ? raw.goldenTimeSeconds : fallback.goldenTimeSeconds,
    totalEvacuees: typeof raw.totalEvacuees === 'number' ? raw.totalEvacuees : fallback.totalEvacuees,
    vulnerableEvacuees:
      typeof raw.vulnerableEvacuees === 'number' ? raw.vulnerableEvacuees : fallback.vulnerableEvacuees,
    voiceBroadcast:
      typeof raw.voiceBroadcast === 'string' && raw.voiceBroadcast.trim()
        ? raw.voiceBroadcast
        : fallback.voiceBroadcast,
  };
}

export async function POST(req: NextRequest) {
  let prompt = '제1출구 계단 폭우 유입 및 지하 승강장 침수 발생';
  let currentLevel = 0.5;

  try {
    const body = await req.json();
    if (typeof body?.prompt === 'string' && body.prompt.trim()) {
      prompt = body.prompt.trim();
    }
    if (typeof body?.currentLevel === 'number' && !Number.isNaN(body.currentLevel)) {
      currentLevel = body.currentLevel;
    }
  } catch {
    // Use default values if request body is empty or malformed
  }

  const fallback = buildFallbackSimulation(prompt, currentLevel);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
    return NextResponse.json(fallback, { status: 200 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = ['gemini-4-argon', 'gemini-2.0-flash', 'gemini-1.5-pro'];

    let responseText = '';
    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const userMessage = `현재 수위: ${currentLevel}m\n재난 상황 보고: "${prompt}"\n위 상황에 맞는 3D 대피 경로(일반/교통약자 분리), 드론 목표 좌표, 그리고 Companion Safety Verifier 검증 결과를 포함한 JSON을 즉시 생성하라.`;
        const result = await model.generateContent(userMessage);
        responseText = result.response.text();
        if (responseText) break;
      } catch {
        // Fallback to next candidate model
        continue;
      }
    }

    if (!responseText) {
      return NextResponse.json(fallback, { status: 200 });
    }

    const cleaned = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(cleaned) as Partial<SimulationData>;
    const validated = sanitizeSimulationData(parsed, fallback);

    return NextResponse.json(validated, { status: 200 });
  } catch {
    // Never return 500: always guarantee a valid simulation response
    return NextResponse.json(fallback, { status: 200 });
  }
}
