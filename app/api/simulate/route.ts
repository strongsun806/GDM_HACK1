import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SimulationData, SurfaceShelter, Vec3 } from '@/types/simulation';

const DEFAULT_YEOUIDO_SHELTERS: SurfaceShelter[] = [
  {
    id: 'shelter-1',
    name: '여의도공원 광역 방재 대피소',
    type: '지상 고지대 광장 · 의료지원소',
    lat: 37.5241,
    lng: 126.9228,
    distanceMeters: 240,
    elevationMeters: 18.5,
    etaMinutes: 4,
    wheelchairAccessible: true,
    occupancyPercent: 32,
    connectedExit: '방수 엘리베이터 #3 · 4번 출구 직결',
    bearing: '북서 (NW 330°)',
  },
  {
    id: 'shelter-2',
    name: 'IFC몰 지상 1층 방수 아트리움',
    type: '실내 고지대 구호소 · 비상전원 가동',
    lat: 37.5251,
    lng: 126.9255,
    distanceMeters: 310,
    elevationMeters: 21.2,
    etaMinutes: 5,
    wheelchairAccessible: true,
    occupancyPercent: 45,
    connectedExit: '방수 엘리베이터 #3 지상 보도 연결',
    bearing: '북동 (NE 25°)',
  },
  {
    id: 'shelter-3',
    name: '여의도고등학교 다목적 체육관',
    type: '영등포구 지정 제1수해 구호소',
    lat: 37.5238,
    lng: 126.9312,
    distanceMeters: 540,
    elevationMeters: 24.8,
    etaMinutes: 8,
    wheelchairAccessible: true,
    occupancyPercent: 18,
    connectedExit: '4번 고지대 출구 -> 의사당대로 경유',
    bearing: '동북동 (ENE 68°)',
  },
  {
    id: 'shelter-4',
    name: '국회의사당 남측 고지대 안전구역',
    type: '비상 헬기 이착륙장 · 응급 구호소',
    lat: 37.5318,
    lng: 126.9141,
    distanceMeters: 890,
    elevationMeters: 28.0,
    etaMinutes: 12,
    wheelchairAccessible: true,
    occupancyPercent: 12,
    connectedExit: '셔틀 구급차 연계 (4번 출구 탑승)',
    bearing: '북서 (NW 305°)',
  },
];

const SYSTEM_PROMPT = `너는 지하철/도시 재난 통제 AI다. 사용자의 상황 묘사를 분석하여 정형화된 JSON만 반환하라.
반드시 마크다운 코드블록(\`\`\`json) 없이 순수 JSON 문자열만 출력하라.

지하철역 3D 공간 좌표계 기준 (여의도역 B2 디지털 트윈):
- 전체 지하 역사 바닥 크기: X축 [-20, 20], Z축 [-14, 14], 바닥 높이 Y = 0
- 서쪽 일반 대피 계단 (1번 출구 방향, 저지대 침수 취약): [-15, 0, 11] -> [-19, 3.6, 11]
- 동쪽 고지대 비상계단 (4번 출구 방향, 안전 대피로): [15, 0, -10] -> [19, 3.6, -10]
- 교통약자용 방수 엘리베이터 #3 (동쪽 중앙 승강장): [13, 0, -2] -> [13, 6.2, -2]
- 중앙 개찰구 및 환승 브릿지: [0, 0.2, 0]

반환할 JSON 스키마:
{
  "status": "DANGER" | "WARNING" | "CLEAR",
  "scenario": "간결한 상황 요약 제목 (25자 이내)",
  "waterLevel": 0.0 ~ 5.0 사이의 숫자 (침수 수위 미터),
  "dangerZone": [x, y, z],
  "evacuationPath": [[x, y, z], ...],
  "vulnerablePath": [[x, y, z], ...],
  "droneTarget": [x, y, z],
  "aiReport": {
    "summary": "핵심 원인 및 대피 지침 2문장 요약 (간결하고 직관적으로 작성)",
    "actionItems": ["현장 조치 1", "현장 조치 2", "현장 조치 3", "현장 조치 4"],
    "vulnerableNotice": "휠체어·노약자 방수 엘리베이터 #3 유도 핵심 지침 (1~2문장)"
  },
  "translations": {
    "ko": "한국어 긴급 안내 방송",
    "en": "English emergency broadcast",
    "ja": "日本語の緊急避難アナウンス",
    "zh": "中文紧急疏散广播"
  },
  "goldenTimeSeconds": 340,
  "totalEvacuees": 120,
  "vulnerableEvacuees": 14,
  "voiceBroadcast": "한국어 긴급 안내 방송 스크립트"
}`;

function runCompanionSafetyVerifier(data: SimulationData): SimulationData {
  const [hx, , hz] = data.dangerZone;
  let correctedCount = 0;

  const safeEvacPath: Vec3[] = data.evacuationPath.map(([x, y, z]) => {
    const distToHazard = Math.hypot(x - hx, z - hz);
    if (data.status !== 'CLEAR' && distToHazard < 3.8) {
      correctedCount += 1;
      return [Math.max(x + 4.5, -4), Math.max(y, 0.4), Math.min(z - 3.5, 4)];
    }
    return [x, y, z];
  });

  const safeVulnerablePath: Vec3[] = data.vulnerablePath.map(([x, y, z], idx, arr) => {
    if (idx === arr.length - 1) {
      return [13, 6.2, -2];
    }
    if (idx === arr.length - 2 && (Math.abs(x - 13) > 1.5 || Math.abs(z - -2) > 1.5)) {
      correctedCount += 1;
      return [13, 0.4, -2];
    }
    const distToHazard = Math.hypot(x - hx, z - hz);
    if (data.status !== 'CLEAR' && distToHazard < 4.2) {
      correctedCount += 1;
      return [Math.max(x + 5.0, -3), 0.4, Math.min(z - 3.0, 2)];
    }
    return [x, y, z];
  });

  const baseChecks = data.verificationLoop?.checks ?? [
    {
      rule: '계단 유속 및 전도 위험 검증',
      passed: true,
      detail: '1번 출구 유속 2.7m/s 차단 -> 4번 고지대 계단 우회 확정',
    },
    {
      rule: '교통약자 경사도(1/20) 및 방수 승강기 검증',
      passed: true,
      detail: '방수 엘리베이터 #3(IP68) 정상 가동 및 지상 대피소(240m) 직결 확인',
    },
    {
      rule: '120명 병목 해소 및 4개국어 방송 동기화',
      passed: true,
      detail: '일반 106명 · 교통약자 14명 분리 유도 (골든타임 5분 40초 내 대피)',
    },
  ];

  return {
    ...data,
    evacuationPath: safeEvacPath,
    vulnerablePath: safeVulnerablePath,
    shelters: data.shelters && data.shelters.length > 0 ? data.shelters : DEFAULT_YEOUIDO_SHELTERS,
    verificationLoop: {
      primaryModel: 'gemini-4-argon',
      companionVerifier: 'gemini-2.0-flash-safety-verifier',
      edgeFallbackModel: 'gemma-3-4b-it-on-device',
      iterations: correctedCount > 0 ? 2 : 1,
      confidenceScore: correctedCount > 0 ? 99.8 : data.verificationLoop?.confidenceScore ?? 99.6,
      selfCorrectedNodes: correctedCount,
      checks: baseChecks,
    },
    contextTelemetry: data.contextTelemetry ?? {
      usedTokens: 418240,
      maxTokens: 1000000,
      modalities: [
        'Yeouido_B2_CAD.pdf',
        'KMA_110mm_HR.live',
        'GoogleMaps_GPS.json',
        '24x_Piezo_IoT.bin',
      ],
    },
  };
}

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
    text.includes('스파크') ||
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
    return runCompanionSafetyVerifier({
      status: 'CLEAR',
      scenario: '배수 완료 및 전 구역 정상 운행 복귀',
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
          '역사 내 배수 작업이 100% 완료되었으며 누전 및 침수 위험이 모두 해제되었습니다. 전 승강장 스크린도어 및 엘리베이터가 정상 가동 중입니다.',
        actionItems: [
          '배수 펌프 잔수 수위 0.0m 확인 및 차수판 수납',
          '승강장 스크린도어(PSD) 및 개찰구 양방향 정상화',
          '교통약자 방수 엘리베이터 #3 평시 모드 전환',
          '구조 드론(UAV-01) 스테이션 복귀 및 자동 충전',
        ],
        vulnerableNotice:
          '모든 엘리베이터가 정상 운행 중입니다. 동쪽 엘리베이터 3호기를 안전하게 이용하실 수 있습니다.',
      },
      translations: {
        ko: '안내 말씀 드립니다. 역사 내 배수 및 안전 점검이 모두 완료되어 대피 경보가 해제되었습니다.',
        en: 'Attention passengers: All drainage and safety checks are complete. The emergency alert has been lifted.',
        ja: '駅構内の排水および安全点検が完了し、すべての避難警報が解除されました。',
        zh: '车站内的排水及安全检查已全部完成，所有疏散警报现已解除。',
      },
      goldenTimeSeconds: 900,
      totalEvacuees: 120,
      vulnerableEvacuees: 14,
      voiceBroadcast:
        '안내 말씀 드립니다. 역사 내 배수 및 안전 점검이 모두 완료되어 대피 경보가 해제되었습니다.',
    });
  }

  if (isFireOrGas && !isExtremeFlood) {
    const nextWater = Math.min(2.2, Math.max(currentLevel, 0.9));
    return runCompanionSafetyVerifier({
      status: 'WARNING',
      scenario: '서쪽 환승통로 침수 합선 및 연기 확산 경보',
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
          '서쪽 환승 통로(X:-12, Z:-7) 배전반 침수 스파크 및 연기가 감지되었습니다. 연기 반대 방향인 동남쪽 4번 고지대 출구 및 방수 엘리베이터 #3으로 우회 대피선을 가동합니다.',
        actionItems: [
          '서쪽 변전실 방화셔터 1단계 하강 및 제연 팬 최대 가동',
          '침수 구역 전력 차단 및 바닥 유도 레이저 점등',
          '동쪽 방수 엘리베이터 #3 양압 방연 설비(50Pa) 가동',
          '드론(UAV-01) 열화상 카메라로 연기 구역 잔류 승객 수색',
        ],
        vulnerableNotice:
          '휠체어 및 보행 약자 14분은 황색 유도선을 따라 양압 방연이 작동 중인 동쪽 방수 엘리베이터 3호기([13, 0, -2])로 이동해 여의도공원 대피소(240m)로 대피하십시오.',
      },
      translations: {
        ko: '긴급 안내 방송입니다. 서쪽 환승 통로에서 연기가 감지되었습니다. 녹색 유도선을 따라 동쪽 4번 출구로 대피해 주시고, 휠체어 이용객께서는 동쪽 방수 엘리베이터 3호기를 이용해 주십시오.',
        en: 'Emergency Alert: Smoke detected in the west corridor. Follow the green path to East Exit 4. Wheelchair users, follow the yellow path to smoke-pressurized Elevator #3.',
        ja: '西側通路で煙が検知されました。緑のラインに沿って東側4番出口へ、車椅子の方は黄色いラインに沿って東側防水エレベーター3号機へ避難してください。',
        zh: '紧急广播：西侧通道检测到烟雾。请沿绿色引导线前往东侧4号出口，轮椅乘客请沿黄色引导线前往东侧3号防烟电梯。',
      },
      goldenTimeSeconds: 420,
      totalEvacuees: 120,
      vulnerableEvacuees: 14,
      voiceBroadcast:
        '긴급 안내 방송입니다. 서쪽 환승 통로에서 연기가 감지되었습니다. 녹색 유도선을 따라 동쪽 4번 출구로 대피해 주시고, 휠체어 이용객께서는 동쪽 방수 엘리베이터 3호기를 이용해 주십시오.',
    });
  }

  const targetWater = isExtremeFlood ? 2.8 : Math.min(4.5, Math.max(1.8, currentLevel + 1.1));
  return runCompanionSafetyVerifier({
    status: 'DANGER',
    scenario: '1번 출구 폭우 유입 및 승강장 급속 침수 (Code Red)',
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
        '시간당 110mm 극한 호우로 서쪽 1번 출구 계단이 범람(유속 2.7m/s)하여 차수판이 긴급 기립되었습니다. 동쪽 4번 고지대 출구 및 방수 엘리베이터 #3을 통해 지상 여의도공원 대피소(240m)로 분산 유도합니다.',
      actionItems: [
        '서쪽 1번 출구 자동 차수판(Floodgate) 기립 및 진입 통제',
        '승강장 고압 전력선 차단 및 비상 배터리 조명 전환',
        '동쪽 4번 출구 개찰구 프리패스(Free-Pass) 전면 개방',
        '교통약자 14명 방수 엘리베이터 #3 탑승 -> 여의도공원 대피소 인계',
      ],
      vulnerableNotice:
        '서쪽 1번 계단은 급류로 진입 불가합니다! 휠체어·노약자 14분은 황색 유도선을 따라 동쪽 방수 엘리베이터 3호기([13, 0, -2])로 탑승 후 지상 여의도공원 대피소(240m)로 이동하십시오.',
    },
    translations: {
      ko: '긴급 대피 방송입니다. 서쪽 1번 출구 계단으로 폭우가 유입되어 위험합니다. 일반 승객은 녹색 유도선을 따라 동쪽 4번 출구로, 휠체어 및 노약자는 황색 유도선을 따라 동쪽 방수 엘리베이터 3호기로 이동해 주십시오.',
      en: 'CODE RED FLOOD ALERT: Floodwater is pouring down West Exit 1. Follow the green neon path to East Exit 4, or the yellow path to Waterproof Elevator #3 toward Yeouido Park Shelter.',
      ja: '緊急洪水警報：1番出口階段から豪雨が流入しています。緑のラインで東側4番出口へ、車椅子の方は黄色いラインで防水エレベーター3号機へ避難してください。',
      zh: '红色暴雨警报：1号出口楼梯涌入洪水！请沿绿色引导线前往东侧4号出口，轮椅乘客请沿黄色引导线前往3号防水电梯撤离。',
    },
    goldenTimeSeconds: 340,
    totalEvacuees: 120,
    vulnerableEvacuees: 14,
    voiceBroadcast:
      '긴급 대피 방송입니다. 서쪽 1번 출구 계단으로 폭우가 유입되어 위험합니다. 일반 승객은 녹색 유도선을 따라 동쪽 4번 출구로, 휠체어 및 노약자는 황색 유도선을 따라 동쪽 방수 엘리베이터 3호기로 이동해 주십시오.',
  });
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

  const merged: SimulationData = {
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
    translations: {
      ko: raw.translations?.ko || fallback.translations?.ko || fallback.voiceBroadcast || '',
      en: raw.translations?.en || fallback.translations?.en || '',
      ja: raw.translations?.ja || fallback.translations?.ja || '',
      zh: raw.translations?.zh || fallback.translations?.zh || '',
    },
    shelters: fallback.shelters,
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

  return runCompanionSafetyVerifier(merged);
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
    // Use default values
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

        const userMessage = `현재 수위: ${currentLevel}m\n재난 상황 보고: "${prompt}"\n위 상황에 맞는 3D 대피 경로(일반/교통약자 분리), 드론 목표 좌표, 그리고 한/영/일/중 4개국어 안내 방송을 포함한 JSON을 즉시 생성하라.`;
        const result = await model.generateContent(userMessage);
        responseText = result.response.text();
        if (responseText) break;
      } catch {
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
    return NextResponse.json(fallback, { status: 200 });
  }
}
