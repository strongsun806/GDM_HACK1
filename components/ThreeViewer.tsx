"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { SimulationData, Vec3 } from "@/types/simulation";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

interface ThreeViewerProps {
  simulation: SimulationData;
  scenarioTrigger?: number;
}

const PILLAR_COORDS: [number, number][] = [
  [-12, -6],
  [-12, 2],
  [-12, 9],
  [-4, -6],
  [-4, 2],
  [-4, 9],
  [4, -6],
  [4, 2],
  [4, 9],
  [12, -6],
  [12, 2],
  [12, 9],
];

/**
 * 1. 바닥 & 벽면 메탈 타일 그리드 CanvasTexture 생성기
 */
function createMetalTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // 베이스 다크 메탈 타일
  ctx.fillStyle = "#0b1324";
  ctx.fillRect(0, 0, 512, 512);

  // 서브 타일 격자 (4x4)
  const step = 128;
  for (let y = 0; y < 512; y += step) {
    for (let x = 0; x < 512; x += step) {
      ctx.fillStyle = (x / step + y / step) % 2 === 0 ? "#0f172a" : "#0b1324";
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4);

      // 타일 메탈 베벨 하이라이트
      ctx.strokeStyle = "rgba(56, 189, 248, 0.16)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, step - 6, step - 6);

      // 코너 리벳 포인트
      ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
      ctx.fillRect(x + 8, y + 8, 4, 4);
      ctx.fillRect(x + step - 12, y + 8, 4, 4);
      ctx.fillRect(x + 8, y + step - 12, 4, 4);
      ctx.fillRect(x + step - 12, y + step - 12, 4, 4);
    }
  }

  // 메인 섹션 네온 그리드 보더
  ctx.strokeStyle = "rgba(6, 182, 212, 0.42)";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 8);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 2. 물 표면 일렁이는 코어스틱(Water Caustics & Ripple) CanvasTexture 생성기
 */
function createWaterCausticsTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0369a1";
  ctx.fillRect(0, 0, 512, 512);

  // 물결 코어스틱 네온 라인 패턴
  for (let i = 0; i < 42; i++) {
    const x = ((i * 73) % 512);
    const y = ((i * 119) % 512);
    const r = 28 + (i % 5) * 16;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, "rgba(125, 211, 252, 0.45)");
    grad.addColorStop(0.6, "rgba(14, 165, 233, 0.18)");
    grad.addColorStop(1, "rgba(3, 105, 161, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 3. 대피선 TubeGeometry 전용 흐르는 화살표(Flowing Neon Arrows) CanvasTexture 생성기
 * texture.offset.x를 실시간으로 이동시켜 탈출구 방향으로 화살표 불빛이 빠르게 질주하는 효과 구현
 */
function createFlowingArrowTexture(hexColor: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  // 반투명 다크 네온 베이스
  ctx.fillStyle = "#04101f";
  ctx.fillRect(0, 0, 256, 128);

  // 양측 가이드 발광 스트라이프
  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, 256, 14);
  ctx.fillRect(0, 114, 256, 14);

  // 중앙 고휘도 화살표(Chevron >>>) 패턴 2연속 배치
  const drawChevron = (offsetX: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(offsetX + 20, 24);
    ctx.lineTo(offsetX + 75, 24);
    ctx.lineTo(offsetX + 115, 64);
    ctx.lineTo(offsetX + 75, 104);
    ctx.lineTo(offsetX + 20, 104);
    ctx.lineTo(offsetX + 60, 64);
    ctx.closePath();

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.restore();
  };

  drawChevron(10);
  drawChevron(130);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 2);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 씬 전체에 THREE.FogExp2('#020617', 0.022) 적용 컴포넌트
 */
function ExponentialSceneFog() {
  const { scene } = useThree();

  useEffect(() => {
    // 어둡고 축축한 지하철역 분위기를 위한 지수 안개(FogExp2) 적용
    scene.fog = new THREE.FogExp2("#020617", 0.02);
    scene.background = new THREE.Color("#020617");
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return null;
}

/**
 * 시네마틱 카메라 오빗 & 줌인 리그
 */
function CinematicCameraRig({
  simulation,
  scenarioTrigger = 0,
  controlsRef,
}: {
  simulation: SimulationData;
  scenarioTrigger?: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const animStartRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(true);
  const startAngleRef = useRef<number>(0.85);

  useEffect(() => {
    animStartRef.current = performance.now();
    isAnimatingRef.current = true;
    startAngleRef.current = 0.65 + (scenarioTrigger % 3) * 0.3;
  }, [simulation.scenario, simulation.droneTarget, scenarioTrigger]);

  useEffect(() => {
    const stopAnimation = () => {
      isAnimatingRef.current = false;
    };
    window.addEventListener("pointerdown", stopAnimation);
    window.addEventListener("wheel", stopAnimation);
    return () => {
      window.removeEventListener("pointerdown", stopAnimation);
      window.removeEventListener("wheel", stopAnimation);
    };
  }, []);

  useFrame((_, delta) => {
    if (!isAnimatingRef.current) return;

    const elapsed = (performance.now() - animStartRef.current) / 1000;
    const duration = 3.2;
    if (elapsed >= duration) {
      isAnimatingRef.current = false;
      return;
    }

    const t = Math.min(1, elapsed / duration);
    const ease = 1 - Math.pow(1 - t, 3);

    const angle = THREE.MathUtils.lerp(startAngleRef.current + 0.65, 0.78, ease);
    const radius = THREE.MathUtils.lerp(33, 25, ease);
    const height = THREE.MathUtils.lerp(22, 16.5, ease);

    const desiredPos = new THREE.Vector3(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    );

    camera.position.lerp(desiredPos, Math.min(1, delta * 4.5));

    if (controlsRef.current) {
      const targetFocus = new THREE.Vector3(
        simulation.dangerZone[0] * 0.22,
        Math.min(2.0, simulation.waterLevel * 0.4 + 0.8),
        simulation.dangerZone[2] * 0.22
      );
      controlsRef.current.target.lerp(targetFocus, Math.min(1, delta * 4.0));
      controlsRef.current.update();
    }
  });

  return null;
}

/**
 * 여의도역 지하 2층~3층 구조물 (어두운 메탈 타일 바닥/벽면 + 천장 형광등 트러스 + 기둥 젖은 질감)
 */
function SubwayStationArchitecture({ waterLevel }: { waterLevel: number }) {
  const turnstiles = useMemo(() => [-13, -10.5, -8, -5.5, -3], []);
  const screenDoors = useMemo(() => [-12, -8, -4, 0, 4, 8, 12], []);
  const wetMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const emergencyLightRef = useRef<THREE.PointLight>(null);

  const metalTileTexture = useMemo(() => createMetalTileTexture(), []);

  useFrame((state, delta) => {
    const wetHeight = Math.max(0.05, Math.min(5.4, waterLevel + 0.35));
    wetMeshRefs.current.forEach((mesh) => {
      if (!mesh) return;
      mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, wetHeight, Math.min(1, delta * 3.5));
      mesh.position.y = mesh.scale.y / 2;
    });

    if (emergencyLightRef.current) {
      emergencyLightRef.current.intensity =
        2.2 + Math.sin(state.clock.elapsedTime * 8.0) * 1.2;
    }
  });

  return (
    <group>
      {/* 비상 적색 경보등 */}
      <pointLight
        ref={emergencyLightRef}
        position={[-10, 5.2, 6]}
        color="#ff1744"
        intensity={2.4}
        distance={25}
      />

      {/* 어두운 메탈 타일 그리드 재질 바닥 */}
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[38, 0.5, 30]} />
        <meshStandardMaterial
          map={metalTileTexture}
          color="#cbd5e1"
          roughness={0.28}
          metalness={0.68}
        />
      </mesh>

      {/* 지하철역 천장 철골 트러스 & 비상 형광등 라인 (입체감 및 수면 반사광원 역할) */}
      {[-8, 0, 8].map((zPos, idx) => (
        <group key={`ceiling-beam-${idx}`} position={[0, 5.75, zPos]}>
          <mesh>
            <boxGeometry args={[36, 0.18, 0.45]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, -0.11, 0]}>
            <boxGeometry args={[32, 0.04, 0.16]} />
            <meshStandardMaterial
              color="#e0f2fe"
              emissive="#38bdf8"
              emissiveIntensity={1.6}
            />
          </mesh>
        </group>
      ))}

      {/* 시각장애인/대피 유도 점자 블록 라인 */}
      <mesh position={[0, 0.03, -8.5]} receiveShadow>
        <boxGeometry args={[34, 0.03, 0.45]} />
        <meshStandardMaterial color="#facc15" emissive="#eab308" emissiveIntensity={0.75} />
      </mesh>

      {/* 외벽 메탈 타일 구조 프레임 */}
      <mesh position={[0, 3, -14.8]} receiveShadow>
        <boxGeometry args={[38, 6, 0.4]} />
        <meshStandardMaterial
          map={metalTileTexture}
          color="#64748b"
          transparent
          opacity={0.75}
          roughness={0.35}
          metalness={0.6}
        />
      </mesh>
      <mesh position={[-18.8, 3, 0]} receiveShadow>
        <boxGeometry args={[0.4, 6, 30]} />
        <meshStandardMaterial
          map={metalTileTexture}
          color="#475569"
          transparent
          opacity={0.45}
          roughness={0.35}
          metalness={0.6}
        />
      </mesh>
      <mesh position={[18.8, 3, 0]} receiveShadow>
        <boxGeometry args={[0.4, 6, 30]} />
        <meshStandardMaterial
          map={metalTileTexture}
          color="#475569"
          transparent
          opacity={0.45}
          roughness={0.35}
          metalness={0.6}
        />
      </mesh>

      {/* 기둥 그리드 (상단 브러시드 메탈/콘크리트 + 하단 젖은 고반사 Specular 레이어 + 코너 수직 LED) */}
      {PILLAR_COORDS.map(([px, pz], idx) => (
        <group key={`pillar-${idx}`} position={[px, 0, pz]}>
          {/* 상단 기본 기둥 */}
          <mesh position={[0, 2.85, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.15, 5.7, 1.15]} />
            <meshStandardMaterial color="#334155" roughness={0.45} metalness={0.45} />
          </mesh>

          {/* 물에 잠긴 하단부 젖은 질감 (Specular & Clearcoat 반사) */}
          <mesh
            ref={(el) => {
              wetMeshRefs.current[idx] = el;
            }}
            position={[0, 0.5, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.19, 1, 1.19]} />
            <meshPhysicalMaterial
              color="#0f172a"
              roughness={0.05}
              metalness={0.78}
              clearcoat={1.0}
              clearcoatRoughness={0.04}
              reflectivity={0.98}
            />
          </mesh>

          {/* 여의도역 5·9호선 안내 네온 띠 */}
          <mesh position={[0, 3.9, 0]}>
            <boxGeometry args={[1.22, 0.28, 1.22]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#00d2ff"
              emissiveIntensity={2.0}
            />
          </mesh>

          {/* 기둥 수직 엣지 가이드 라이트 바 */}
          <mesh position={[0.59, 2.8, 0.59]}>
            <boxGeometry args={[0.05, 5.4, 0.05]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={1.2}
            />
          </mesh>
          <mesh position={[-0.59, 2.8, 0.59]}>
            <boxGeometry args={[0.05, 5.4, 0.05]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={1.2}
            />
          </mesh>

          {/* 비상 적색 경보 비콘 */}
          <mesh position={[0, 4.45, 0.6]}>
            <boxGeometry args={[0.4, 0.14, 0.06]} />
            <meshStandardMaterial
              color="#ff2a5f"
              emissive="#ff0044"
              emissiveIntensity={2.5}
            />
          </mesh>
        </group>
      ))}

      {/* 북측 지하철 스크린도어 (PSD) */}
      <group position={[0, 0, -11.5]}>
        <mesh position={[0, 3.3, 0]} castShadow>
          <boxGeometry args={[34, 0.6, 0.35]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.2} />
        </mesh>
        {screenDoors.map((sx, i) => (
          <group key={`psd-${i}`} position={[sx, 1.5, 0]}>
            <mesh>
              <boxGeometry args={[3.4, 3.0, 0.12]} />
              <meshPhysicalMaterial
                color="#7dd3fc"
                transparent
                opacity={0.28}
                roughness={0.08}
                metalness={0.15}
                transmission={0.6}
              />
            </mesh>
            <mesh position={[1.8, 0, 0]} castShadow>
              <boxGeometry args={[0.25, 3.1, 0.25]} />
              <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.25} />
            </mesh>
            <mesh position={[0, 1.4, 0.1]}>
              <boxGeometry args={[1.3, 0.1, 0.05]} />
              <meshStandardMaterial color="#ff2a5f" emissive="#ff0044" emissiveIntensity={2.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 서남측 지하철 개찰구 (Turnstile Gates) */}
      <group position={[0, 0, 6]}>
        {turnstiles.map((tx, i) => (
          <group key={`turnstile-${i}`} position={[tx, 0.6, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.5, 1.2, 1.85]} />
              <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.63, 0.6]}>
              <boxGeometry args={[0.38, 0.06, 0.38]} />
              <meshStandardMaterial
                color="#00ff9d"
                emissive="#00ff9d"
                emissiveIntensity={2.2}
              />
            </mesh>
            <mesh position={[1.1, 0, 0]}>
              <boxGeometry args={[1.5, 0.9, 0.06]} />
              <meshStandardMaterial
                color="#ff2a5f"
                transparent
                opacity={0.55}
                emissive="#ff2a5f"
                emissiveIntensity={1.2}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* 동측 교통약자 방수 엘리베이터 타워 */}
      <group position={[13, 0, -2]}>
        <mesh position={[0, 2.8, 0]}>
          <boxGeometry args={[2.8, 5.6, 2.8]} />
          <meshPhysicalMaterial
            color="#fde047"
            transparent
            opacity={0.24}
            roughness={0.1}
            metalness={0.25}
          />
        </mesh>
        <mesh position={[0, 5.65, 0]}>
          <boxGeometry args={[3.1, 0.3, 3.1]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#eab308"
            emissiveIntensity={1.8}
          />
        </mesh>
        <pointLight position={[0, 4.5, 0]} color="#fde047" intensity={3.0} distance={12} />
        <Html position={[0, 6.3, 0]} center distanceFactor={28}>
          <div className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-extrabold text-[10px] whitespace-nowrap shadow-[0_0_18px_rgba(251,191,36,0.9)] border border-white">
            ♿ 방수 엘리베이터 #3 (가동중)
          </div>
        </Html>
      </group>

      {/* 동남측 고지대 비상탈출 계단 */}
      <group position={[16, 0, 10]}>
        <mesh position={[0, 2.2, 0]} rotation={[-0.45, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 0.4, 7.5]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.35} />
        </mesh>
        <pointLight position={[0, 4.5, 1]} color="#00ff9d" intensity={3.2} distance={12} />
        <Html position={[0, 5.1, 1.5]} center distanceFactor={28}>
          <div className="px-2.5 py-0.5 rounded bg-emerald-400 text-slate-950 font-mono font-extrabold text-[10px] whitespace-nowrap shadow-[0_0_18px_rgba(16,185,129,0.9)] border border-white">
            🏃 지상 비상출구 (Exit 2)
          </div>
        </Html>
      </group>

      {/* 서남측 일반 출구 계단 */}
      <group position={[-15, 0, 11]}>
        <mesh position={[0, 2.0, 0]} rotation={[-0.45, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 0.4, 7.0]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.35} />
        </mesh>
        <Html position={[0, 4.8, 1]} center distanceFactor={28}>
          <div className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-mono font-extrabold text-[10px] whitespace-nowrap shadow-lg border border-white">
            서측 출구 (Exit 1)
          </div>
        </Html>
      </group>
    </group>
  );
}

/**
 * 2. 물(Water) 물리 표현:
 * - Z-fighting(검은 얼룩 클리핑) 완벽 제거!
 * - roughness: 0.1, metalness: 0.1, transmission: 0.6 적용된 MeshPhysicalMaterial
 * - useFrame 내 sin(clock.getElapsedTime()) 파도 정점 애니메이션 + 기둥 주변 하얀 포말(Foam)
 */
function RisingWaterAndFoam({ targetWaterLevel }: { targetWaterLevel: number }) {
  const waterSurfaceRef = useRef<THREE.Mesh>(null);
  const waterUnderVolumeRef = useRef<THREE.Mesh>(null);
  const foamGroupRef = useRef<THREE.Group>(null);
  const foamParticlesRef = useRef<THREE.Points>(null);
  const currentHeightRef = useRef<number>(0.2);

  const causticsTexture = useMemo(() => createWaterCausticsTexture(), []);

  // 고밀도 파도 평면 지오메트리
  const surfaceGeometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(37.6, 29.6, 56, 44);
    geom.rotateX(-Math.PI / 2);
    return geom;
  }, []);

  // 기둥 주변 하얀 포말 파티클
  const { foamPositions, foamAngles, foamRadii, foamPillarIndices } = useMemo(() => {
    const countPerPillar = 32;
    const total = PILLAR_COORDS.length * countPerPillar;
    const positions = new Float32Array(total * 3);
    const angles = new Float32Array(total);
    const radii = new Float32Array(total);
    const pillarIndices = new Uint16Array(total);

    let ptr = 0;
    PILLAR_COORDS.forEach(([px, pz], pIdx) => {
      for (let i = 0; i < countPerPillar; i++) {
        const angle = (i / countPerPillar) * Math.PI * 2 + (i % 3) * 0.2;
        const r = 0.82 + (i % 5) * 0.16;
        positions[ptr * 3] = px + Math.cos(angle) * r;
        positions[ptr * 3 + 1] = 0.1;
        positions[ptr * 3 + 2] = pz + Math.sin(angle) * r;
        angles[ptr] = angle;
        radii[ptr] = r;
        pillarIndices[ptr] = pIdx;
        ptr++;
      }
    });

    return {
      foamPositions: positions,
      foamAngles: angles,
      foamRadii: radii,
      foamPillarIndices: pillarIndices,
    };
  }, []);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    const safeTarget = Math.max(0.08, Math.min(5.0, targetWaterLevel));

    // 수위 부드러운 Lerp 상승
    currentHeightRef.current = THREE.MathUtils.lerp(
      currentHeightRef.current,
      safeTarget,
      Math.min(1, delta * 2.4)
    );
    const h = currentHeightRef.current;

    // 코어스틱 물결 텍스처 스크롤
    causticsTexture.offset.x = elapsed * 0.06;
    causticsTexture.offset.y = Math.sin(elapsed * 0.4) * 0.08;

    // 1. 수면 파도 애니메이션 (sin(clock.getElapsedTime()) 활용)
    if (waterSurfaceRef.current) {
      const waveBase = Math.sin(elapsed * 2.2) * 0.04;
      waterSurfaceRef.current.position.y = h + waveBase;

      const posAttr = surfaceGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        const wave1 = Math.sin(vx * 0.45 + elapsed * 2.6) * 0.065;
        const wave2 = Math.cos(vz * 0.55 - elapsed * 2.1) * 0.055;
        const ripple = Math.sin((vx + vz) * 0.35 + elapsed * 3.4) * 0.03;
        posAttr.setY(i, wave1 + wave2 + ripple);
      }
      posAttr.needsUpdate = true;
      surfaceGeometry.computeVertexNormals();
    }

    // 2. 수면 아래 깊은 물 볼륨 (파도 최저점보다 0.22m 낮게 유지하여 Z-fighting 원천 차단!)
    if (waterUnderVolumeRef.current) {
      const bodyHeight = Math.max(0.02, h - 0.22);
      waterUnderVolumeRef.current.visible = h > 0.28;
      waterUnderVolumeRef.current.scale.y = bodyHeight;
      waterUnderVolumeRef.current.position.y = bodyHeight / 2;
    }

    // 3. 기둥 주변 하얀 포말 링 동기화
    if (foamGroupRef.current) {
      foamGroupRef.current.position.y = h + 0.09;
      foamGroupRef.current.children.forEach((child, idx) => {
        const s = 1.02 + Math.sin(elapsed * 3.5 + idx) * 0.1;
        child.scale.set(s, s, 1);
      });
    }

    // 4. 기둥 주변 하얀 포말 입자 회전
    if (foamParticlesRef.current) {
      const pAttr = foamParticlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < foamAngles.length; i++) {
        const pIdx = foamPillarIndices[i];
        const [px, pz] = PILLAR_COORDS[pIdx];
        const a = foamAngles[i] + elapsed * (0.75 + (i % 3) * 0.25);
        const r = foamRadii[i] + Math.sin(elapsed * 4.2 + i) * 0.09;
        const bobY = h + 0.11 + Math.sin(elapsed * 5.5 + i * 0.7) * 0.04;
        pAttr.setXYZ(i, px + Math.cos(a) * r, bobY, pz + Math.sin(a) * r);
      }
      pAttr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* 상단 파도치는 물 표면 (roughness: 0.1, metalness: 0.1, transmission: 0.6 강제 적용) */}
      <mesh ref={waterSurfaceRef} geometry={surfaceGeometry} receiveShadow>
        <meshPhysicalMaterial
          map={causticsTexture}
          color="#0ea5e9"
          emissive="#0284c7"
          emissiveIntensity={0.38}
          roughness={0.1}
          metalness={0.1}
          transmission={0.6}
          ior={1.333}
          reflectivity={0.9}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
          transparent
          opacity={0.82}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 하부 수체 볼륨 (수면과 절대 겹치지 않는 심해 볼륨) */}
      <mesh ref={waterUnderVolumeRef} position={[0, 0.1, 0]}>
        <boxGeometry args={[37.5, 1, 29.5]} />
        <meshPhysicalMaterial
          color="#0369a1"
          emissive="#075985"
          emissiveIntensity={0.28}
          roughness={0.15}
          metalness={0.1}
          transmission={0.55}
          transparent
          opacity={0.52}
          depthWrite={false}
        />
      </mesh>

      {/* 기둥 주변 하얀 포말(Foam) 링 */}
      <group ref={foamGroupRef} position={[0, 0.2, 0]}>
        {PILLAR_COORDS.map(([px, pz], idx) => (
          <mesh
            key={`foam-ring-${idx}`}
            position={[px, 0, pz]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.74, 1.12, 28]} />
            <meshBasicMaterial
              color="#e0f2fe"
              transparent
              opacity={targetWaterLevel > 0.2 ? 0.72 : 0.15}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>

      {/* 기둥 주변 하얀 포말 파티클 */}
      <points ref={foamParticlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={foamPositions.length / 3}
            array={foamPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.15}
          transparent
          opacity={targetWaterLevel > 0.2 ? 0.92 : 0.2}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

/**
 * 위험 구역(dangerZone): 맥동하는 붉은 와이어프레임 큐브 + 아지랑이처럼 피어오르는 홀로그램 파티클
 */
function DangerZoneHologram({ position }: { position: Vec3 }) {
  const outerCubeRef = useRef<THREE.Mesh>(null);
  const innerCoreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const targetVec = useMemo(() => new THREE.Vector3(...position), [position]);

  const { particlePositions, particleSpeeds, particleOffsets } = useMemo(() => {
    const count = 96;
    const pos = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const ox = (((i * 17) % 100) / 100) * 2.8 - 1.4;
      const oy = (((i * 31) % 100) / 100) * 3.8;
      const oz = (((i * 47) % 100) / 100) * 2.8 - 1.4;
      offsets[i * 3] = ox;
      offsets[i * 3 + 1] = oy;
      offsets[i * 3 + 2] = oz;
      pos[i * 3] = position[0] + ox;
      pos[i * 3 + 1] = oy;
      pos[i * 3 + 2] = position[2] + oz;
      speeds[i] = 0.9 + ((i * 13) % 10) * 0.14;
    }

    return {
      particlePositions: pos,
      particleSpeeds: speeds,
      particleOffsets: offsets,
    };
  }, [position]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (outerCubeRef.current) {
      outerCubeRef.current.position.lerp(targetVec, Math.min(1, delta * 4));
      const pulse = 1 + Math.sin(t * 5.5) * 0.2;
      outerCubeRef.current.scale.set(pulse, pulse, pulse);
      outerCubeRef.current.rotation.y += delta * 1.1;
      outerCubeRef.current.rotation.x = Math.sin(t * 2) * 0.15;
    }

    if (innerCoreRef.current) {
      innerCoreRef.current.position.lerp(targetVec, Math.min(1, delta * 4));
      innerCoreRef.current.rotation.y -= delta * 2.2;
      innerCoreRef.current.rotation.z += delta * 1.5;
    }

    if (ringRef.current) {
      ringRef.current.position.set(targetVec.x, 0.25, targetVec.z);
      const ringScale = 1 + ((t * 2.0) % 2.2);
      ringRef.current.scale.set(ringScale, ringScale, 1);
    }

    if (particlesRef.current) {
      const attr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleSpeeds.length; i++) {
        const baseOx = particleOffsets[i * 3];
        const baseOy = particleOffsets[i * 3 + 1];
        const baseOz = particleOffsets[i * 3 + 2];
        const risenY = (baseOy + t * particleSpeeds[i]) % 4.6;
        const shimmerX = Math.sin(t * 3.0 + i) * 0.22;
        const shimmerZ = Math.cos(t * 2.7 + i) * 0.22;

        attr.setXYZ(
          i,
          targetVec.x + baseOx + shimmerX,
          risenY + 0.2,
          targetVec.z + baseOz + shimmerZ
        );
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh ref={outerCubeRef} position={position}>
        <boxGeometry args={[2.7, 2.7, 2.7]} />
        <meshStandardMaterial
          color="#ff2a5f"
          emissive="#ff0044"
          emissiveIntensity={2.8}
          wireframe
        />
        <Html position={[0, 2.1, 0]} center distanceFactor={25}>
          <div className="px-2.5 py-0.5 rounded bg-rose-600/95 text-white font-mono font-bold text-[10px] tracking-wider whitespace-nowrap border border-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.95)] animate-pulse">
            ⚠ CRITICAL HAZARD [{position[0]}, {position[1]}, {position[2]}]
          </div>
        </Html>
      </mesh>

      <mesh ref={innerCoreRef} position={position}>
        <octahedronGeometry args={[1.05, 0]} />
        <meshStandardMaterial
          color="#ff0055"
          emissive="#ff1744"
          emissiveIntensity={3.2}
          wireframe
          transparent
          opacity={0.85}
        />
      </mesh>

      <mesh
        ref={ringRef}
        position={[position[0], 0.25, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.4, 1.9, 36]} />
        <meshBasicMaterial color="#ff2a5f" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlePositions.length / 3}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ff4d6d"
          size={0.2}
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

/**
 * 3. 대피선 (TubeGeometry + texture.offset.x 고속 스크롤 동적 네온 튜브):
 * - 텍스처의 offset.x를 계속 변화시켜 화살표 불빛이 탈출구 방향으로 빠르게 흘러가는 동적 네온 튜브 구현
 */
function DynamicEvacuationPath({
  points,
  color,
  label,
  isBlinking = false,
}: {
  points: Vec3[];
  color: string;
  label: string;
  isBlinking?: boolean;
}) {
  const arrowTexture = useMemo(() => createFlowingArrowTexture(color), [color]);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const curve = useMemo(() => {
    const validPoints =
      points && points.length >= 2
        ? points.map((p) => new THREE.Vector3(p[0], p[1] + 0.35, p[2]))
        : [new THREE.Vector3(0, 0.8, 0), new THREE.Vector3(5, 1.8, 5)];
    return new THREE.CatmullRomCurve3(validPoints, false, "catmullrom", 0.35);
  }, [points]);

  // 내부 화살표 코어 TubeGeometry
  const innerTubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 80, 0.22, 16, false);
  }, [curve]);

  // 외곽 발광 네온 후광(Halo) TubeGeometry
  const outerHaloGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 80, 0.38, 16, false);
  }, [curve]);

  const midPoint = useMemo(() => curve.getPointAt(0.5), [curve]);

  useFrame((state, delta) => {
    // 텍스처의 offset.x를 지속 변화시켜 화살표 불빛이 탈출구 방향으로 빠르게 흘러가게 함
    arrowTexture.offset.x -= delta * 2.8;

    if (glowMatRef.current) {
      const t = state.clock.getElapsedTime();
      if (isBlinking) {
        glowMatRef.current.opacity = 0.28 + Math.abs(Math.sin(t * 6.5)) * 0.42;
      } else {
        glowMatRef.current.opacity = 0.32 + Math.sin(t * 3.0) * 0.12;
      }
    }
  });

  return (
    <group>
      {/* 내부 화살표 텍스처가 빠르게 흐르는 코어 3D 튜브 */}
      <mesh geometry={innerTubeGeometry}>
        <meshStandardMaterial
          map={arrowTexture}
          emissiveMap={arrowTexture}
          emissive={color}
          emissiveIntensity={2.6}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>

      {/* 외곽 홀로그램 글로우 튜브 (Additive Blending) */}
      <mesh geometry={outerHaloGeometry}>
        <meshBasicMaterial
          ref={glowMatRef}
          color={color}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <Html position={[midPoint.x, midPoint.y + 0.9, midPoint.z]} center distanceFactor={26}>
        <div
          className="px-2.5 py-0.5 rounded bg-slate-950/95 text-[10px] font-mono font-bold whitespace-nowrap border shadow-lg"
          style={{
            color,
            borderColor: color,
            boxShadow: `0 0 14px ${color}88`,
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

/**
 * 4. 드론 서치라이트:
 * - 드론 기체 바로 밑에 바닥과 어두운 물 위를 원형으로 강력하게 비추는 SpotLight
 *   (angle: 0.4, penumbra: 0.8, color: '#ffffff') 장착
 * - 수면 위 원형 서치라이트 타겟 프로젝션 링 & 볼류메트릭 광선 콘
 */
function AutonomousRescueDrone({
  target,
  waterLevel,
}: {
  target: Vec3;
  waterLevel: number;
}) {
  const droneGroupRef = useRef<THREE.Group>(null);
  const rotorRefs = useRef<(THREE.Mesh | null)[]>([]);
  const redLedMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const blueLedMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const redLightRef = useRef<THREE.PointLight>(null);
  const blueLightRef = useRef<THREE.PointLight>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const searchRingRef = useRef<THREE.Group>(null);
  const dustPointsRef = useRef<THREE.Points>(null);

  const targetVector = useMemo(() => new THREE.Vector3(...target), [target]);
  const spotTargetObj = useMemo(() => new THREE.Object3D(), []);

  // 드론 서치라이트 빔 내부 빛 파편 파티클
  const dustOffsets = useMemo(() => {
    const count = 72;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (((i * 23) % 100) / 100 - 0.5) * 3.2;
      arr[i * 3 + 1] = -(((i * 41) % 100) / 100) * 4.5;
      arr[i * 3 + 2] = (((i * 67) % 100) / 100 - 0.5) * 3.2;
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (droneGroupRef.current) {
      // 드론이 물 위를 수색하듯 선회 + 호버링
      const patrolOffsetX = Math.sin(t * 1.4) * 1.6;
      const patrolOffsetZ = Math.cos(t * 1.1) * 1.6;
      const hoverY = Math.sin(t * 3.6) * 0.18;

      const desired = new THREE.Vector3(
        targetVector.x + patrolOffsetX,
        Math.max(4.6, targetVector.y + 1.2) + hoverY,
        targetVector.z + patrolOffsetZ
      );

      droneGroupRef.current.position.lerp(desired, Math.min(1, delta * 3.5));
      droneGroupRef.current.rotation.z = Math.sin(t * 2.2) * 0.06;
      droneGroupRef.current.rotation.x = Math.cos(t * 1.8) * 0.06;

      // 드론 바로 아래(수면/바닥)를 비추는 SpotLight 타겟 동기화
      const curPos = droneGroupRef.current.position;
      const sweepX = curPos.x + Math.sin(t * 2.5) * 0.6;
      const sweepZ = curPos.z + Math.cos(t * 2.5) * 0.6;
      const surfaceY = Math.max(0.15, waterLevel + 0.08);

      spotTargetObj.position.set(sweepX, surfaceY, sweepZ);

      if (spotLightRef.current) {
        spotLightRef.current.target = spotTargetObj;
      }

      if (searchRingRef.current) {
        searchRingRef.current.position.set(sweepX, surfaceY + 0.04, sweepZ);
        searchRingRef.current.rotation.z = t * 1.8;
      }
    }

    rotorRefs.current.forEach((rotor) => {
      if (rotor) rotor.rotation.y += delta * 36;
    });

    const strobe = Math.sin(t * 18) > 0;
    if (redLedMatRef.current) {
      redLedMatRef.current.emissiveIntensity = strobe ? 4.5 : 0.2;
    }
    if (blueLedMatRef.current) {
      blueLedMatRef.current.emissiveIntensity = !strobe ? 4.5 : 0.2;
    }
    if (redLightRef.current) {
      redLightRef.current.intensity = strobe ? 4.5 : 0.1;
    }
    if (blueLightRef.current) {
      blueLightRef.current.intensity = !strobe ? 4.5 : 0.1;
    }

    if (dustPointsRef.current) {
      dustPointsRef.current.rotation.y += delta * 0.45;
    }
  });

  const armOffsets: [number, number][] = [
    [-0.8, -0.8],
    [0.8, -0.8],
    [-0.8, 0.8],
    [0.8, 0.8],
  ];

  return (
    <>
      <primitive object={spotTargetObj} />

      {/* 드론 서치라이트가 물 위를 비추는 원형 홀로그램 타겟 링 */}
      <group ref={searchRingRef} position={[target[0], 1.0, target[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[0.1, 1.85, 36]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.38}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <ringGeometry args={[1.8, 2.05, 36]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      <group ref={droneGroupRef} position={[0, 4.8, 0]}>
        {/* 드론 기체 코어 */}
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.28, 0.9]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.15} />
        </mesh>

        {/* 하단 서치라이트 짐벌 렌즈 코어 */}
        <mesh position={[0, -0.18, 0]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* 좌/우 적색·청색 스트로브 LED */}
        <mesh position={[-0.45, 0.16, 0]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial
            ref={redLedMatRef}
            color="#ff1744"
            emissive="#ff1744"
            emissiveIntensity={4.0}
          />
        </mesh>
        <pointLight ref={redLightRef} position={[-0.5, 0.2, 0]} color="#ff1744" distance={10} />

        <mesh position={[0.45, 0.16, 0]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial
            ref={blueLedMatRef}
            color="#00e5ff"
            emissive="#00e5ff"
            emissiveIntensity={4.0}
          />
        </mesh>
        <pointLight ref={blueLightRef} position={[0.5, 0.2, 0]} color="#00e5ff" distance={10} />

        {/* 4축 로터 암 */}
        {armOffsets.map(([ax, az], idx) => (
          <group key={`rotor-arm-${idx}`} position={[ax, 0.05, az]}>
            <mesh>
              <cylinderGeometry args={[0.07, 0.07, 0.22, 12]} />
              <meshStandardMaterial color="#38bdf8" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh
              ref={(el) => {
                rotorRefs.current[idx] = el;
              }}
              position={[0, 0.14, 0]}
            >
              <boxGeometry args={[0.68, 0.025, 0.1]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.88} />
            </mesh>
          </group>
        ))}

        {/* 드론 기체 바로 밑에 바닥/수면을 원형으로 비추는 강력한 SpotLight (angle: 0.4, penumbra: 0.8, color: '#ffffff') */}
        <spotLight
          ref={spotLightRef}
          position={[0, -0.2, 0]}
          color="#ffffff"
          angle={0.4}
          penumbra={0.8}
          intensity={110}
          distance={32}
          decay={1.1}
          castShadow
        />

        {/* 드론 바로 아래로 뻗어나가는 볼류메트릭 백색 서치라이트 원추 광선 */}
        <mesh position={[0, -2.3, 0]}>
          <coneGeometry args={[1.95, 4.6, 32, 1, true]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* 드론 주변 빛 파편 파티클 */}
        <points ref={dustPointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={dustOffsets.length / 3}
              array={dustOffsets}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#e0f2fe"
            size={0.12}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        <Html position={[0, 1.0, 0]} center distanceFactor={24}>
          <div className="px-2.5 py-0.5 rounded bg-slate-950/95 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.9)] whitespace-nowrap flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>🚁 INTERCEPTOR DRONE-A1 [{target[0]}, {target[1]}, {target[2]}]</span>
          </div>
        </Html>
      </group>
    </>
  );
}

export default function ThreeViewer({ simulation, scenarioTrigger = 0 }: ThreeViewerProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [manualSweepCounter, setManualSweepCounter] = useState(0);

  return (
    <div className="relative w-full h-full bg-[#020617] overflow-hidden select-none">
      {/* 상단 3D 뷰포트 시네마틱 HUD 오버레이 */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/90 backdrop-blur-xl border border-cyan-500/50 text-xs font-mono text-slate-100 flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>CAM-04 // 여의도역 B2-B3 환승대합실 (LIVE DIGITAL TWIN)</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/90 backdrop-blur-xl border border-sky-500/50 text-xs font-mono text-sky-300 shadow-[0_0_15px_rgba(14,165,233,0.25)]">
            FLOOD DEPTH: {simulation.waterLevel.toFixed(2)}m / 5.00m
          </div>
          <div className="hidden xl:flex px-3 py-1.5 rounded-lg bg-emerald-950/90 backdrop-blur-xl border border-emerald-500/50 text-xs font-mono text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
            TARGET: 골든타임 6분 내 120명 전원 안전 대피
          </div>
        </div>

        <button
          type="button"
          onClick={() => setManualSweepCounter((c) => c + 1)}
          className="pointer-events-auto px-3 py-1.5 rounded-lg bg-slate-950/90 hover:bg-cyan-950/80 border border-cyan-400/60 text-[11px] font-mono text-cyan-300 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        >
          🎥 CINEMATIC ORBIT SWEEP
        </button>
      </div>

      {/* 하단 3D 홀로그램 범례 오버레이 */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-slate-700/80 text-[11px] font-mono text-slate-200 pointer-events-none shadow-2xl">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_10px_#00ff9d]" />
          일반 대피선 (Flowing Green Tube)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-[#fbbf24] shadow-[0_0_10px_#fbbf24] animate-pulse" />
          교통약자/엘리베이터 우회선 (Flashing Yellow Tube)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border border-[#ff2a5f] bg-[#ff2a5f]/40 animate-ping" />
          홀로그램 위험 구역 (Hazard Particles)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_#38bdf8]" />
          드론 수직 서치라이트 (SpotLight)
        </span>
      </div>

      <Canvas
        shadows
        camera={{ position: [26, 18, 26], fov: 40, near: 0.1, far: 180 }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* 1. THREE.FogExp2('#020617', 0.02) 지수 안개 적용 */}
        <ExponentialSceneFog />

        {/* 시네마틱 재난 조명 + 메탈 타일과 수면 반사광을 살리는 입체 라이팅 */}
        <ambientLight intensity={0.42} />
        <hemisphereLight args={["#38bdf8", "#020617", 0.65]} />
        <directionalLight
          position={[16, 28, 14]}
          intensity={1.25}
          color="#bae6fd"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-12, 5.2, -6]} intensity={2.2} color="#0ea5e9" distance={26} />
        <pointLight position={[12, 5.2, 6]} intensity={2.2} color="#38bdf8" distance={26} />

        {/* 1. 메탈 타일 바닥 & 벽면 + 기둥 젖은 질감 */}
        <SubwayStationArchitecture waterLevel={simulation.waterLevel} />

        {/* 2. 물(Water) 물리 표현 (roughness: 0.1, metalness: 0.1, transmission: 0.6 + sin 파도) */}
        <RisingWaterAndFoam targetWaterLevel={simulation.waterLevel} />

        {/* 위험 구역 홀로그램 */}
        <DangerZoneHologram position={simulation.dangerZone} />

        {/* 3. 대피선 TubeGeometry (texture.offset.x가 고속 스크롤되는 네온 화살표 튜브) */}
        <DynamicEvacuationPath
          points={simulation.evacuationPath}
          color="#00ff9d"
          label="일반 대피 경로 (Standard Flow)"
          isBlinking={false}
        />

        <DynamicEvacuationPath
          points={simulation.vulnerablePath}
          color="#fbbf24"
          label="♿ 교통약자 엘리베이터 우회선 (Priority Pulse)"
          isBlinking={true}
        />

        {/* 4. 드론 서치라이트 (기체 바로 밑 SpotLight angle: 0.4, penumbra: 0.8, color: '#ffffff') */}
        <AutonomousRescueDrone
          target={simulation.droneTarget}
          waterLevel={simulation.waterLevel}
        />

        {/* 시네마틱 카메라 오빗 */}
        <CinematicCameraRig
          simulation={simulation}
          scenarioTrigger={scenarioTrigger + manualSweepCounter}
          controlsRef={controlsRef}
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[0, 1.2, 0]}
          minPolarAngle={0.18}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={9}
          maxDistance={52}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
}
