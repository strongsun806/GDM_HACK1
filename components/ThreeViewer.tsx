'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SimulationData } from '@/types/simulation';
import { Camera, Video, ShieldAlert, Accessibility, Cpu, Eye } from 'lucide-react';

interface ThreeViewerProps {
  simulationData: SimulationData;
}

type CameraPreset = 'OVERVIEW' | 'FLOOD_STAIRS' | 'ELEVATOR_ADA' | 'DRONE_CAM';

/**
 * Procedural scrolling neon chevron texture for evacuation tubes
 */
function useFlowingArrowTexture(primaryColor: string, accentColor: string) {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, 256, 64);

      const grad = ctx.createLinearGradient(0, 0, 256, 0);
      grad.addColorStop(0.0, 'rgba(0,0,0,0.15)');
      grad.addColorStop(0.45, primaryColor);
      grad.addColorStop(0.75, accentColor);
      grad.addColorStop(1.0, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 8, 256, 48);

      // Draw crisp directional chevrons
      ctx.fillStyle = '#ffffff';
      for (let offset = 28; offset < 240; offset += 64) {
        ctx.beginPath();
        ctx.moveTo(offset, 12);
        ctx.lineTo(offset + 28, 32);
        ctx.lineTo(offset, 52);
        ctx.lineTo(offset + 12, 52);
        ctx.lineTo(offset + 40, 32);
        ctx.lineTo(offset + 12, 12);
        ctx.closePath();
        ctx.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(14, 1);
    return texture;
  }, [primaryColor, accentColor]);
}

/**
 * Procedural granite tile floor texture for realistic underground station
 */
function useSubwayTileTexture() {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 512, 512);

      // Subtle stone tile blocks
      const step = 64;
      for (let y = 0; y < 512; y += step) {
        for (let x = 0; x < 512; x += step) {
          const shade = 26 + ((x * 7 + y * 13) % 10);
          ctx.fillStyle = `rgb(${shade}, ${shade + 8}, ${shade + 20})`;
          ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
        }
      }

      // Grout lines
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 512; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 12);
    return texture;
  }, []);
}

/**
 * Camera Rig that smoothly transitions when user clicks a camera preset button,
 * while yielding back to OrbitControls for manual inspection.
 */
function CameraController({
  preset,
  simulationData,
  controlsRef,
}: {
  preset: CameraPreset;
  simulationData: SimulationData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();
  const transitionFrames = useRef(0);
  const lastPreset = useRef<CameraPreset>(preset);

  useEffect(() => {
    if (lastPreset.current !== preset) {
      lastPreset.current = preset;
      transitionFrames.current = 75;
    }
  }, [preset]);

  useFrame((_, delta) => {
    if (preset === 'DRONE_CAM') {
      const [dx, dy, dz] = simulationData.droneTarget;
      const desiredPos = new THREE.Vector3(dx - 5.5, dy + 3.2, dz + 6.5);
      const desiredTarget = new THREE.Vector3(
        simulationData.dangerZone[0],
        Math.max(0.5, simulationData.waterLevel * 0.6),
        simulationData.dangerZone[2]
      );
      camera.position.lerp(desiredPos, Math.min(1, delta * 3.5));
      if (controlsRef.current) {
        controlsRef.current.target.lerp(desiredTarget, Math.min(1, delta * 4));
        controlsRef.current.update();
      }
      return;
    }

    if (transitionFrames.current > 0) {
      transitionFrames.current -= 1;
      let targetPos = new THREE.Vector3(0, 17, 25);
      let lookAtTarget = new THREE.Vector3(0, 1.2, 0);

      if (preset === 'FLOOD_STAIRS') {
        targetPos = new THREE.Vector3(-6, 7.5, 18.5);
        lookAtTarget = new THREE.Vector3(-15, 1.8, 10.5);
      } else if (preset === 'ELEVATOR_ADA') {
        targetPos = new THREE.Vector3(4.5, 6.8, 9.5);
        lookAtTarget = new THREE.Vector3(13, 2.4, -2);
      }

      camera.position.lerp(targetPos, Math.min(1, delta * 4.5));
      if (controlsRef.current) {
        controlsRef.current.target.lerp(lookAtTarget, Math.min(1, delta * 5.0));
        controlsRef.current.update();
      }
    }
  });

  return null;
}

/**
 * 3D Subway Train Car parked behind the North Platform Screen Doors (Z = -13.6)
 */
function SubwayTrainCar({ status }: { status: SimulationData['status'] }) {
  const headlightRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (headlightRef.current) {
      const pulse = status === 'DANGER' ? 2.2 + Math.sin(clock.getElapsedTime() * 8) * 0.8 : 2.0;
      headlightRef.current.emissiveIntensity = pulse;
    }
  });

  return (
    <group position={[0, 0.2, -13.7]}>
      {/* Train Track Bed */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[42, 0.2, 3.2]} />
        <meshStandardMaterial color="#090d16" roughness={0.9} />
      </mesh>

      {/* Main Stainless Steel Car Body */}
      <mesh position={[0, 1.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[36, 3.3, 2.7]} />
        <meshPhysicalMaterial
          color="#cbd5e1"
          metalness={0.85}
          roughness={0.22}
          clearcoat={0.6}
        />
      </mesh>

      {/* Metro Line Signature Blue & Cyan Stripe */}
      <mesh position={[0, 1.75, 1.36]}>
        <boxGeometry args={[36.05, 0.38, 0.04]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0ea5e9"
          emissiveIntensity={0.75}
        />
      </mesh>

      {/* Illuminated Passenger Cabin Windows */}
      {[-14, -10.5, -7, -3.5, 0, 3.5, 7, 10.5, 14].map((x, idx) => (
        <mesh key={idx} position={[x, 2.25, 1.36]}>
          <boxGeometry args={[2.3, 1.05, 0.05]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive={status === 'DANGER' ? '#38bdf8' : '#fde047'}
            emissiveIntensity={1.35}
          />
        </mesh>
      ))}

      {/* Train Destination LED Signboard */}
      <mesh position={[0, 3.25, 1.36]}>
        <boxGeometry args={[6.5, 0.36, 0.06]} />
        <meshStandardMaterial
          color={status === 'DANGER' ? '#ef4444' : '#10b981'}
          emissive={status === 'DANGER' ? '#ef4444' : '#10b981'}
          emissiveIntensity={2.2}
        />
      </mesh>

      {/* Front & Rear Headlights */}
      <mesh position={[17.95, 1.4, 0.8]}>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial
          ref={headlightRef}
          color="#ffffff"
          emissive="#38bdf8"
          emissiveIntensity={2.5}
        />
      </mesh>
    </group>
  );
}

/**
 * Underground Station Architecture: Reflective Granite Platform, Tactile Paving,
 * Platform Screen Doors, Pillars with Water Level Gauges, Stairs & Waterproof Elevator #3
 */
function SubwayStationArchitecture({
  waterLevel,
  status,
}: {
  waterLevel: number;
  status: SimulationData['status'];
}) {
  const tileTexture = useSubwayTileTexture();

  const pillarPositions: [number, number, number][] = useMemo(
    () => [
      [-12, 3.2, -5.5],
      [-4, 3.2, -5.5],
      [4, 3.2, -5.5],
      [12, 3.2, -5.5],
      [-12, 3.2, 5.5],
      [-4, 3.2, 5.5],
      [4, 3.2, 5.5],
      [12, 3.2, 5.5],
    ],
    []
  );

  const isWet = waterLevel > 0.1;
  const beaconRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const floodgateRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    beaconRefs.current.forEach((mat, idx) => {
      if (!mat) return;
      if (status === 'DANGER') {
        const flash = Math.sin(t * 10 + idx * 1.1) > 0 ? 3.8 : 0.3;
        mat.emissiveIntensity = flash;
        mat.color.set('#ef4444');
        mat.emissive.set('#ef4444');
      } else if (status === 'WARNING') {
        const flash = Math.sin(t * 5 + idx) > 0 ? 2.4 : 0.4;
        mat.emissiveIntensity = flash;
        mat.color.set('#f59e0b');
        mat.emissive.set('#f59e0b');
      } else {
        mat.emissiveIntensity = 1.0;
        mat.color.set('#10b981');
        mat.emissive.set('#10b981');
      }
    });

    // Smoothly raise the automated floodgate barrier at West Stairwell when water rises
    if (floodgateRef.current) {
      const targetGateY = waterLevel > 0.5 ? 0.95 : -0.8;
      floodgateRef.current.position.y = THREE.MathUtils.lerp(
        floodgateRef.current.position.y,
        targetGateY,
        0.08
      );
    }
  });

  return (
    <group>
      {/* Main Concourse & Platform Floor */}
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[42, 0.5, 28]} />
        <meshPhysicalMaterial
          map={tileTexture ?? undefined}
          color={isWet ? '#1e293b' : '#334155'}
          roughness={isWet ? 0.08 : 0.35}
          metalness={isWet ? 0.65 : 0.25}
          clearcoat={1.0}
          clearcoatRoughness={isWet ? 0.05 : 0.25}
        />
      </mesh>

      {/* High-Visibility Yellow Tactile Paving (점자블록) along Platform Edge & ADA Corridor */}
      <mesh position={[0, 0.02, -10.8]} receiveShadow>
        <boxGeometry args={[38, 0.03, 0.45]} />
        <meshStandardMaterial
          color="#facc15"
          emissive="#ca8a04"
          emissiveIntensity={0.45}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[3, 0.02, -2]} receiveShadow>
        <boxGeometry args={[20, 0.03, 0.38]} />
        <meshStandardMaterial
          color="#facc15"
          emissive="#ca8a04"
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>

      {/* Subway Train Parked Behind PSD */}
      <SubwayTrainCar status={status} />

      {/* North Platform Screen Doors (PSD) along Z = -11.8 */}
      <group position={[0, 2.2, -11.8]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[42, 4.4, 0.28]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            transparent
            opacity={0.28}
            roughness={0.08}
            metalness={0.5}
            transmission={0.55}
          />
        </mesh>
        {/* Top Metallic Header Beam */}
        <mesh position={[0, 2.0, 0.06]}>
          <boxGeometry args={[42, 0.5, 0.42]} />
          <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* PSD Emergency LED Strip */}
        <mesh position={[0, 1.72, 0.28]}>
          <boxGeometry args={[40, 0.1, 0.05]} />
          <meshStandardMaterial
            color={status === 'DANGER' ? '#ef4444' : '#38bdf8'}
            emissive={status === 'DANGER' ? '#ef4444' : '#38bdf8'}
            emissiveIntensity={2.2}
          />
        </mesh>
        {/* Vertical PSD Door Pillars & Station Name Signs */}
        {[-16, -12, -8, -4, 0, 4, 8, 12, 16].map((x) => (
          <group key={x} position={[x, 0, 0.05]}>
            <mesh>
              <boxGeometry args={[0.38, 4.4, 0.38]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
            </mesh>
            {x % 8 === 0 && (
              <mesh position={[0, 1.2, 0.21]}>
                <boxGeometry args={[1.6, 0.32, 0.04]} />
                <meshStandardMaterial
                  color="#0284c7"
                  emissive="#0284c7"
                  emissiveIntensity={1.1}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* Central Automated Fare Gates (개찰구 - Emergency Free-Pass Open Mode) */}
      <group position={[0, 0.55, 1.5]}>
        {[-5, -3, -1, 1, 3, 5].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.45, 1.1, 1.65]} />
              <meshPhysicalMaterial
                color="#475569"
                metalness={0.85}
                roughness={0.18}
                clearcoat={0.8}
              />
            </mesh>
            {/* Top Scanner LED Indicator (Green Free-Pass) */}
            <mesh position={[0, 0.57, 0]}>
              <boxGeometry args={[0.38, 0.05, 1.5]} />
              <meshStandardMaterial
                color="#10b981"
                emissive="#10b981"
                emissiveIntensity={2.4}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* 8 Structural Columns with Wet Specular Bases, Water Depth Markers & Emergency Strobes */}
      {pillarPositions.map(([x, y, z], idx) => (
        <group key={idx} position={[x, y, z]}>
          {/* Upper Column Body */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.35, 6.4, 1.35]} />
            <meshPhysicalMaterial
              color="#334155"
              roughness={0.28}
              metalness={0.55}
              clearcoat={0.7}
            />
          </mesh>

          {/* Wet Glossy Lower Sleeve */}
          <mesh position={[0, -1.6, 0]}>
            <boxGeometry args={[1.39, 3.2, 1.39]} />
            <meshPhysicalMaterial
              color="#0f172a"
              roughness={0.03}
              metalness={0.9}
              clearcoat={1.0}
              clearcoatRoughness={0.02}
            />
          </mesh>

          {/* Glowing Cyan Safety Band */}
          <mesh position={[0, -0.3, 0]}>
            <boxGeometry args={[1.42, 0.16, 1.42]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={1.6}
            />
          </mesh>

          {/* Emergency Strobe Beacon */}
          <mesh position={[0, 2.75, 0]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              ref={(el) => {
                beaconRefs.current[idx] = el;
              }}
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={2.5}
            />
          </mesh>
        </group>
      ))}

      {/* Overhead Industrial Ceiling Trusses & High-Output Fluorescent Strips */}
      {[-9, -3, 3, 9].map((z, idx) => (
        <group key={idx} position={[0, 6.35, z]}>
          <mesh>
            <boxGeometry args={[40, 0.22, 0.35]} />
            <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <boxGeometry args={[36, 0.06, 0.16]} />
            <meshStandardMaterial
              color="#e0f2fe"
              emissive={status === 'DANGER' ? '#7dd3fc' : '#f8fafc'}
              emissiveIntensity={1.8}
            />
          </mesh>
        </group>
      ))}

      {/* WEST STAIRWELL (Exit #1 - Flooded Low-Ground Hazard Zone) */}
      <group position={[-15, 0, 11]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh
            key={i}
            position={[-i * 0.42, i * 0.3 + 0.15, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.48, 0.3, 3.6]} />
            <meshPhysicalMaterial
              color={waterLevel > i * 0.3 ? '#1e3a8a' : '#475569'}
              roughness={0.12}
              metalness={0.65}
              clearcoat={1.0}
            />
          </mesh>
        ))}

        {/* Automated Rising Floodgate Barrier (차수판) at Base of West Stairs */}
        <mesh ref={floodgateRef} position={[0.45, 0.8, 0]} castShadow>
          <boxGeometry args={[0.18, 1.7, 3.8]} />
          <meshPhysicalMaterial
            color="#dc2626"
            emissive="#991b1b"
            emissiveIntensity={0.8}
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>

        <Html position={[-2.2, 4.5, 0]} center distanceFactor={22}>
          <div className="px-2.5 py-1 rounded-md bg-red-950/90 border border-red-500/80 text-[11px] font-mono text-red-200 whitespace-nowrap shadow-[0_0_20px_rgba(239,68,68,0.6)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            1번 출구 계단 (폭우 폭포수 유입 · 차수판 가동)
          </div>
        </Html>
      </group>

      {/* EAST STAIRWELL (Exit #4 - High-Ground Safe Evacuation Route) */}
      <group position={[15, 0, -10]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh
            key={i}
            position={[i * 0.42, i * 0.3 + 0.15, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.48, 0.3, 3.6]} />
            <meshStandardMaterial
              color="#065f46"
              emissive="#059669"
              emissiveIntensity={0.65}
              roughness={0.25}
              metalness={0.4}
            />
          </mesh>
        ))}
        {/* Illuminated Green Exit Portal Arch */}
        <mesh position={[4.8, 4.6, 0]}>
          <boxGeometry args={[0.3, 2.2, 3.8]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#10b981"
            emissiveIntensity={1.8}
            transparent
            opacity={0.45}
          />
        </mesh>
        <Html position={[2.6, 4.6, 0]} center distanceFactor={22}>
          <div className="px-2.5 py-1 rounded-md bg-emerald-950/90 border border-emerald-400/80 text-[11px] font-mono text-emerald-200 whitespace-nowrap shadow-[0_0_20px_rgba(16,185,129,0.6)]">
            ✓ 4번 출구 고지대 비상계단 (일반 승객 106명 대피)
          </div>
        </Html>
      </group>

      {/* WATERPROOF ELEVATOR #3 SHAFT (East Concourse [13, 0, -2]) */}
      <group position={[13, 3.2, -2]}>
        {/* Reinforced Waterproof Glass Shaft */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.7, 6.4, 2.7]} />
          <meshPhysicalMaterial
            color="#fef08a"
            emissive="#eab308"
            emissiveIntensity={0.25}
            transparent
            opacity={0.24}
            roughness={0.08}
            metalness={0.6}
            transmission={0.6}
          />
        </mesh>
        {/* Corner Steel Structural Frame */}
        {[
          [-1.32, -1.32],
          [1.32, -1.32],
          [-1.32, 1.32],
          [1.32, 1.32],
        ].map(([cx, cz], i) => (
          <mesh key={i} position={[cx, 0, cz]}>
            <boxGeometry args={[0.14, 6.4, 0.14]} />
            <meshStandardMaterial
              color="#facc15"
              emissive="#ca8a04"
              emissiveIntensity={0.9}
              metalness={0.8}
            />
          </mesh>
        ))}
        <Html position={[0, 3.8, 0]} center distanceFactor={22}>
          <div className="px-2.5 py-1 rounded-md bg-yellow-950/95 border border-yellow-400 text-[11px] font-mono text-yellow-200 whitespace-nowrap shadow-[0_0_20px_rgba(250,204,21,0.6)]">
            ♿ 방수 엘리베이터 #3 (IP68 수밀 · 교통약자 14명 전용)
          </div>
        </Html>
      </group>
    </group>
  );
}

/**
 * Cascading Stairwell Waterfall Particles pouring down the flooded West Exit #1 Stairs
 */
function StairwellWaterfall({ waterLevel }: { waterLevel: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 360;

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const progress = Math.random(); // 0 = top of stairs, 1 = bottom splash
      pos[i * 3] = -19.8 + progress * 5.2;
      pos[i * 3 + 1] = (1 - progress) * 3.8 + Math.random() * 0.25;
      pos[i * 3 + 2] = 11 + (Math.random() - 0.5) * 3.1;
      spd[i] = 0.45 + Math.random() * 0.35;
    }
    return { positions: pos, speeds: spd };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      // Move down the stairs (+X, -Y)
      arr[i * 3] += speeds[i] * delta * 6.5;
      arr[i * 3 + 1] -= speeds[i] * delta * 4.6;

      // Reset to top of stairwell when hitting water or bottom
      if (arr[i * 3] > -14.2 || arr[i * 3 + 1] < Math.max(0.15, waterLevel)) {
        arr[i * 3] = -19.8 + Math.random() * 0.6;
        arr[i * 3 + 1] = 3.6 + Math.random() * 0.35;
        arr[i * 3 + 2] = 11 + (Math.random() - 0.5) * 3.1;
      }
    }
    attr.needsUpdate = true;
  });

  if (waterLevel <= 0.15) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#bae6fd"
        size={0.22}
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Realistic Floodwater System: Zero Z-fighting volumetric water body,
 * vertex-displaced wave surface, and swirling white foam rings around pillars.
 */
function FloodWaterSystem({ targetWaterLevel }: { targetWaterLevel: number }) {
  const surfaceMeshRef = useRef<THREE.Mesh>(null);
  const volumeMeshRef = useRef<THREE.Mesh>(null);
  const foamGroupRef = useRef<THREE.Group>(null);
  const currentLevelRef = useRef(0.1);

  const surfaceGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(42, 28, 72, 52);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const basePositions = useMemo(() => {
    const pos = surfaceGeo.attributes.position.array as Float32Array;
    return new Float32Array(pos);
  }, [surfaceGeo]);

  const foamGeometry = useMemo(() => {
    const pillars: [number, number][] = [
      [-12, -5.5],
      [-4, -5.5],
      [4, -5.5],
      [12, -5.5],
      [-12, 5.5],
      [-4, 5.5],
      [4, 5.5],
      [12, 5.5],
    ];
    const pts: number[] = [];
    pillars.forEach(([px, pz]) => {
      for (let i = 0; i < 42; i++) {
        const angle = (i / 42) * Math.PI * 2;
        const r = 0.92 + Math.random() * 0.42;
        pts.push(px + Math.cos(angle) * r, (Math.random() - 0.5) * 0.05, pz + Math.sin(angle) * r);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    currentLevelRef.current = THREE.MathUtils.lerp(
      currentLevelRef.current,
      targetWaterLevel,
      Math.min(1, delta * 2.4)
    );
    const h = currentLevelRef.current;

    if (surfaceMeshRef.current) {
      surfaceMeshRef.current.position.y = h;
      surfaceMeshRef.current.visible = h > 0.03;

      const posAttr = surfaceGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < posAttr.count; i++) {
        const bx = basePositions[i * 3];
        const bz = basePositions[i * 3 + 2];
        const wave1 = Math.sin(bx * 0.5 + t * 2.8) * 0.055;
        const wave2 = Math.cos(bz * 0.65 + t * 2.3) * 0.055;
        const ripple = Math.sin((bx - bz) * 1.1 + t * 4.5) * 0.02;
        arr[i * 3 + 1] = wave1 + wave2 + ripple;
      }
      posAttr.needsUpdate = true;
      surfaceGeo.computeVertexNormals();
    }

    // Keep volume box strictly 0.24m below wave surface to completely prevent Z-fighting
    if (volumeMeshRef.current) {
      const safeVolHeight = Math.max(0.02, h - 0.24);
      volumeMeshRef.current.scale.y = safeVolHeight;
      volumeMeshRef.current.position.y = safeVolHeight / 2;
      volumeMeshRef.current.visible = h > 0.32;
    }

    if (foamGroupRef.current) {
      foamGroupRef.current.position.y = h + 0.07;
      foamGroupRef.current.visible = h > 0.12;
      foamGroupRef.current.position.x = Math.sin(t * 3.2) * 0.04;
      foamGroupRef.current.position.z = Math.cos(t * 2.7) * 0.04;
    }
  });

  return (
    <group>
      {/* Top Animated Wave Surface */}
      <mesh ref={surfaceMeshRef} geometry={surfaceGeo} receiveShadow>
        <meshPhysicalMaterial
          color="#0284c7"
          emissive="#0369a1"
          emissiveIntensity={0.28}
          transparent
          opacity={0.78}
          roughness={0.06}
          metalness={0.15}
          transmission={0.74}
          thickness={2.4}
          ior={1.333}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          depthWrite={false}
        />
      </mesh>

      {/* Lower Submerged Water Volume */}
      <mesh ref={volumeMeshRef} position={[0, 0.05, 0]}>
        <boxGeometry args={[41.8, 1, 27.8]} />
        <meshStandardMaterial
          color="#082f49"
          emissive="#0c4a6e"
          emissiveIntensity={0.2}
          transparent
          opacity={0.48}
          depthWrite={false}
        />
      </mesh>

      {/* Swirling White Foam Particles Around Pillars */}
      <group ref={foamGroupRef}>
        <points geometry={foamGeometry}>
          <pointsMaterial
            color="#f0f9ff"
            size={0.17}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      </group>
    </group>
  );
}

/**
 * Animated 3D Evacuating Commuters, Wheelchair Agent, and Moving Glass Elevator Cab
 */
function EvacuationAgentsAndElevator({
  evacuationPath,
  vulnerablePath,
  waterLevel,
}: {
  evacuationPath: [number, number, number][];
  vulnerablePath: [number, number, number][];
  waterLevel: number;
}) {
  const generalAgentsRef = useRef<THREE.Group>(null);
  const wheelchairAgentsRef = useRef<THREE.Group>(null);
  const elevatorCabRef = useRef<THREE.Group>(null);

  const generalCurve = useMemo(() => {
    const pts = (evacuationPath.length >= 2
      ? evacuationPath
      : [
          [-9, 0.4, 6],
          [15, 0.5, -10],
          [19.2, 3.8, -10],
        ]
    ).map(([x, y, z]) => new THREE.Vector3(x, Math.max(y, waterLevel * 0.25 + 0.2), z));
    return new THREE.CatmullRomCurve3(pts);
  }, [evacuationPath, waterLevel]);

  const vulnerableCurve = useMemo(() => {
    // Ground segment leading into Waterproof Elevator #3 ([13, 0.4, -2])
    const groundPts = (vulnerablePath.length >= 2
      ? vulnerablePath.slice(0, -1)
      : [
          [-7, 0.4, 4],
          [13, 0.4, -2],
        ]
    ).map(([x, y, z]) => new THREE.Vector3(x, Math.max(y, 0.25), z));
    if (groundPts.length < 2) {
      groundPts.push(new THREE.Vector3(13, 0.4, -2));
    }
    return new THREE.CatmullRomCurve3(groundPts);
  }, [vulnerablePath]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Animate 8 general evacuees walking/running along Neon Green path
    if (generalAgentsRef.current) {
      generalAgentsRef.current.children.forEach((child, idx) => {
        const u = (t * 0.14 + idx / 8) % 1;
        const pos = generalCurve.getPointAt(u);
        const tangent = generalCurve.getTangentAt(u);
        child.position.set(pos.x, pos.y + Math.abs(Math.sin(t * 9 + idx)) * 0.08, pos.z);
        child.rotation.y = Math.atan2(tangent.x, tangent.z);
      });
    }

    // Animate 3 wheelchair/assisted evacuees moving along Neon Yellow path
    if (wheelchairAgentsRef.current) {
      wheelchairAgentsRef.current.children.forEach((child, idx) => {
        const u = (t * 0.11 + idx / 3) % 1;
        const pos = vulnerableCurve.getPointAt(u);
        const tangent = vulnerableCurve.getTangentAt(u);
        child.position.set(pos.x, pos.y, pos.z);
        child.rotation.y = Math.atan2(tangent.x, tangent.z);
      });
    }

    // Animate Waterproof Elevator #3 Cab ascending from platform (Y=0.8) to surface exit (Y=5.4)
    if (elevatorCabRef.current) {
      const cycle = (Math.sin(t * 1.1) + 1) * 0.5; // 0..1 smooth elevator cycle
      elevatorCabRef.current.position.y = 0.9 + cycle * 4.4;
    }
  });

  return (
    <group>
      {/* 8 General Evacuee Commuter Avatars */}
      <group ref={generalAgentsRef}>
        {Array.from({ length: 8 }).map((_, idx) => (
          <group key={idx}>
            {/* Torso with High-Vis Green Rescue Aura */}
            <mesh position={[0, 0.55, 0]} castShadow>
              <cylinderGeometry args={[0.18, 0.22, 0.75, 12]} />
              <meshStandardMaterial
                color="#10b981"
                emissive="#059669"
                emissiveIntensity={1.5}
              />
            </mesh>
            {/* Head */}
            <mesh position={[0, 1.12, 0]}>
              <sphereGeometry args={[0.16, 12, 12]} />
              <meshStandardMaterial
                color="#ecfdf5"
                emissive="#34d399"
                emissiveIntensity={1.2}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* 3 Wheelchair / Vulnerable Passenger Avatars */}
      <group ref={wheelchairAgentsRef}>
        {Array.from({ length: 3 }).map((_, idx) => (
          <group key={idx}>
            {/* Seated Passenger & Frame */}
            <mesh position={[0, 0.48, 0]}>
              <boxGeometry args={[0.42, 0.52, 0.45]} />
              <meshStandardMaterial
                color="#facc15"
                emissive="#eab308"
                emissiveIntensity={1.8}
              />
            </mesh>
            {/* Head */}
            <mesh position={[0, 0.92, 0]}>
              <sphereGeometry args={[0.16, 12, 12]} />
              <meshStandardMaterial
                color="#fef9c3"
                emissive="#facc15"
                emissiveIntensity={1.4}
              />
            </mesh>
            {/* Left & Right Wheelchair Wheels */}
            <mesh position={[-0.26, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.26, 0.26, 0.06, 16]} />
              <meshStandardMaterial color="#0f172a" emissive="#ca8a04" emissiveIntensity={1.2} />
            </mesh>
            <mesh position={[0.26, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.26, 0.26, 0.06, 16]} />
              <meshStandardMaterial color="#0f172a" emissive="#ca8a04" emissiveIntensity={1.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Moving 3D Waterproof Glass Elevator Cab inside Shaft [13, y, -2] */}
      <group ref={elevatorCabRef} position={[13, 1.2, -2]}>
        <mesh>
          <boxGeometry args={[2.2, 1.8, 2.2]} />
          <meshPhysicalMaterial
            color="#fef08a"
            emissive="#eab308"
            emissiveIntensity={0.85}
            transparent
            opacity={0.55}
            roughness={0.1}
            metalness={0.5}
          />
        </mesh>
        {/* Elevator Cab Floor Platform */}
        <mesh position={[0, -0.85, 0]}>
          <boxGeometry args={[2.25, 0.14, 2.25]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#ca8a04"
            emissiveIntensity={1.6}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Flowing Neon Evacuation Tubes (Green for General, Amber/Yellow for Vulnerable/ADA)
 */
function EvacuationPaths({
  evacuationPath,
  vulnerablePath,
  waterLevel,
}: {
  evacuationPath: [number, number, number][];
  vulnerablePath: [number, number, number][];
  waterLevel: number;
}) {
  const greenTex = useFlowingArrowTexture('#10b981', '#6ee7b7');
  const yellowTex = useFlowingArrowTexture('#eab308', '#fef08a');

  const greenCurve = useMemo(() => {
    const pts = (evacuationPath.length >= 2
      ? evacuationPath
      : [
          [-9, 0.4, 6],
          [15, 0.5, -10],
          [19.2, 3.8, -10],
        ]
    ).map(([x, y, z]) => new THREE.Vector3(x, Math.max(y, waterLevel * 0.3 + 0.32), z));
    return new THREE.CatmullRomCurve3(pts);
  }, [evacuationPath, waterLevel]);

  const yellowCurve = useMemo(() => {
    const pts = (vulnerablePath.length >= 2
      ? vulnerablePath
      : [
          [-7, 0.4, 4],
          [13, 0.4, -2],
          [13, 6.2, -2],
        ]
    ).map(([x, y, z]) => new THREE.Vector3(x, Math.max(y, waterLevel * 0.3 + 0.36), z));
    return new THREE.CatmullRomCurve3(pts);
  }, [vulnerablePath, waterLevel]);

  const greenTubeGeo = useMemo(
    () => new THREE.TubeGeometry(greenCurve, 72, 0.2, 16, false),
    [greenCurve]
  );
  const yellowTubeGeo = useMemo(
    () => new THREE.TubeGeometry(yellowCurve, 72, 0.2, 16, false),
    [yellowCurve]
  );

  const yellowMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }, delta) => {
    if (greenTex) greenTex.offset.x -= delta * 2.4;
    if (yellowTex) yellowTex.offset.x -= delta * 1.9;
    if (yellowMatRef.current) {
      yellowMatRef.current.emissiveIntensity =
        1.7 + Math.sin(clock.getElapsedTime() * 6.5) * 0.55;
    }
  });

  return (
    <group>
      <mesh geometry={greenTubeGeo}>
        <meshStandardMaterial
          map={greenTex ?? undefined}
          emissiveMap={greenTex ?? undefined}
          color="#10b981"
          emissive="#34d399"
          emissiveIntensity={1.9}
          roughness={0.15}
          transparent
          opacity={0.95}
        />
      </mesh>
      <Line
        points={greenCurve.getPoints(50)}
        color="#a7f3d0"
        lineWidth={2.5}
        transparent
        opacity={0.85}
      />

      <mesh geometry={yellowTubeGeo}>
        <meshStandardMaterial
          ref={yellowMatRef}
          map={yellowTex ?? undefined}
          emissiveMap={yellowTex ?? undefined}
          color="#facc15"
          emissive="#fde047"
          emissiveIntensity={2.0}
          roughness={0.15}
          transparent
          opacity={0.96}
        />
      </mesh>
      <Line
        points={yellowCurve.getPoints(50)}
        color="#fef9c3"
        lineWidth={2.5}
        dashed
        dashSize={0.5}
        gapSize={0.25}
      />
    </group>
  );
}

/**
 * Pulsing Red Wireframe Hazard Zone + Rising Thermal Plume Particles
 */
function DangerZoneHologram({
  position,
  status,
  waterLevel,
}: {
  position: [number, number, number];
  status: SimulationData['status'];
  waterLevel: number;
}) {
  const cubeRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const particleCount = 130;
  const particleData = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 3.8;
      arr[i * 3 + 1] = Math.random() * 4.2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 3.8;
    }
    return arr;
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (cubeRef.current) {
      const pulse = 1 + Math.sin(t * 5) * 0.14;
      cubeRef.current.scale.set(pulse, pulse, pulse);
      cubeRef.current.rotation.y += delta * 0.9;
    }
    if (ringRef.current) {
      const s = 1 + ((t * 1.6) % 1.8);
      ringRef.current.scale.set(s, s, 1);
    }
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        arr[i * 3 + 1] += delta * (1.2 + (i % 5) * 0.35);
        arr[i * 3] += Math.sin(t * 3 + i) * 0.01;
        if (arr[i * 3 + 1] > 4.6) {
          arr[i * 3 + 1] = 0;
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  if (status === 'CLEAR') return null;

  const baseY = Math.max(position[1], waterLevel + 0.25);

  return (
    <group position={[position[0], baseY, position[2]]}>
      <mesh ref={cubeRef} position={[0, 1.2, 0]}>
        <boxGeometry args={[2.8, 2.8, 2.8]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={2.5}
          wireframe
        />
      </mesh>

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.5, 2.0, 36]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={particleData}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#f87171"
          size={0.18}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <Html position={[0, 3.2, 0]} center distanceFactor={20}>
        <div className="px-3 py-1 rounded bg-red-600/95 border border-red-300 text-xs font-mono font-bold text-white shadow-[0_0_24px_rgba(239,68,68,0.95)] animate-pulse whitespace-nowrap">
          ⚠ CRITICAL HAZARD [{position[0]}, {position[2]}]
        </div>
      </Html>
    </group>
  );
}

/**
 * Autonomous Rescue Drone (UAV-01) with Downward Volumetric Searchlight
 */
function RescueDrone({
  target,
  dangerZone,
  status,
}: {
  target: [number, number, number];
  dangerZone: [number, number, number];
  status: SimulationData['status'];
}) {
  const droneRef = useRef<THREE.Group>(null);
  const rotorsRef = useRef<(THREE.Mesh | null)[]>([]);
  const redLedRef = useRef<THREE.MeshStandardMaterial>(null);
  const blueLedRef = useRef<THREE.MeshStandardMaterial>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const spotTarget = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (droneRef.current) {
      const desired = new THREE.Vector3(
        target[0] + Math.sin(t * 1.4) * 1.1,
        Math.max(3.6, target[1]) + Math.sin(t * 3.0) * 0.22,
        target[2] + Math.cos(t * 1.4) * 1.1
      );
      droneRef.current.position.lerp(desired, Math.min(1, delta * 3.2));
      droneRef.current.rotation.z = Math.sin(t * 2.2) * 0.08;
      droneRef.current.rotation.x = Math.cos(t * 1.8) * 0.08;
    }

    const aimPos =
      status === 'CLEAR'
        ? new THREE.Vector3(target[0], 0, target[2])
        : new THREE.Vector3(dangerZone[0], 0.2, dangerZone[2]);
    spotTarget.position.lerp(aimPos, Math.min(1, delta * 5));

    if (spotLightRef.current) {
      spotLightRef.current.target = spotTarget;
    }

    rotorsRef.current.forEach((r) => {
      if (r) r.rotation.y += delta * 38;
    });

    const flash = Math.sin(t * 16) > 0;
    if (redLedRef.current) redLedRef.current.emissiveIntensity = flash ? 4.2 : 0.2;
    if (blueLedRef.current) blueLedRef.current.emissiveIntensity = !flash ? 4.2 : 0.2;
  });

  return (
    <>
      <primitive object={spotTarget} />
      <group ref={droneRef} position={[0, 4.2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.95, 0.26, 0.95]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
        </mesh>

        {[
          [-0.68, 0.12, -0.68],
          [0.68, 0.12, -0.68],
          [-0.68, 0.12, 0.68],
          [0.68, 0.12, 0.68],
        ].map(([rx, ry, rz], idx) => (
          <group key={idx} position={[rx, ry, rz]}>
            <mesh>
              <cylinderGeometry args={[0.07, 0.07, 0.18, 12]} />
              <meshStandardMaterial color="#38bdf8" metalness={0.8} />
            </mesh>
            <mesh
              ref={(el) => {
                rotorsRef.current[idx] = el;
              }}
              position={[0, 0.11, 0]}
            >
              <boxGeometry args={[0.78, 0.02, 0.09]} />
              <meshBasicMaterial color="#e0f2fe" transparent opacity={0.85} />
            </mesh>
          </group>
        ))}

        {/* Strobe LEDs */}
        <mesh position={[-0.45, 0.18, 0.45]}>
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshStandardMaterial
            ref={redLedRef}
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={3}
          />
        </mesh>
        <mesh position={[0.45, 0.18, 0.45]}>
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshStandardMaterial
            ref={blueLedRef}
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={3}
          />
        </mesh>

        {/* Downward Searchlight Cone */}
        <mesh position={[0, -2.0, 0]}>
          <coneGeometry args={[1.95, 4.0, 28, 1, true]} />
          <meshBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={0.13}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        <spotLight
          ref={spotLightRef}
          position={[0, -0.15, 0]}
          angle={0.58}
          penumbra={0.5}
          intensity={55}
          distance={26}
          color="#f0f9ff"
          castShadow
        />

        <Html position={[0, 0.85, 0]} center distanceFactor={20}>
          <div className="px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/80 text-[10px] font-mono text-cyan-200 whitespace-nowrap shadow-[0_0_14px_rgba(34,211,238,0.6)]">
            🚁 UAV-01 ARGON SCOUT (THERMAL LOCK)
          </div>
        </Html>
      </group>
    </>
  );
}

export default function ThreeViewer({ simulationData }: ThreeViewerProps) {
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('OVERVIEW');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  return (
    <div className="relative w-full h-full bg-[#020617] select-none">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 17, 25], fov: 46, near: 0.1, far: 160 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
        }}
      >
        <color attach="background" args={['#020617']} />
        <fogExp2 attach="fog" args={['#020617', 0.016]} />

        {/* Balanced Cinema-Grade Underground Lighting */}
        <ambientLight intensity={0.75} color="#cbd5e1" />
        <hemisphereLight args={['#38bdf8', '#0f172a', 0.95]} />
        <directionalLight
          position={[14, 24, 16]}
          intensity={1.55}
          color="#f8fafc"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        {/* Emergency Hazard & Safe Exit Accent Lights */}
        <pointLight
          position={[-14, 4.5, 10]}
          intensity={simulationData.status === 'DANGER' ? 24 : 8}
          distance={24}
          color={simulationData.status === 'DANGER' ? '#ef4444' : '#38bdf8'}
        />
        <pointLight position={[15, 4.5, -10]} intensity={16} distance={22} color="#10b981" />
        <pointLight position={[13, 4.5, -2]} intensity={16} distance={20} color="#facc15" />

        {/* 1. Station Architecture + Subway Train Car + Rising Floodgate */}
        <SubwayStationArchitecture
          waterLevel={simulationData.waterLevel}
          status={simulationData.status}
        />

        {/* 2. Cascading Stairwell Waterfall on West Exit #1 */}
        <StairwellWaterfall waterLevel={simulationData.waterLevel} />

        {/* 3. Volumetric Floodwater + Wave Surface + Pillar Foam */}
        <FloodWaterSystem targetWaterLevel={simulationData.waterLevel} />

        {/* 4. Scrolling Neon Evacuation Tubes */}
        <EvacuationPaths
          evacuationPath={simulationData.evacuationPath}
          vulnerablePath={simulationData.vulnerablePath}
          waterLevel={simulationData.waterLevel}
        />

        {/* 5. Animated 3D Commuters, Wheelchair Passenger & Moving Elevator Cab */}
        <EvacuationAgentsAndElevator
          evacuationPath={simulationData.evacuationPath}
          vulnerablePath={simulationData.vulnerablePath}
          waterLevel={simulationData.waterLevel}
        />

        {/* 6. Pulsing Red Wireframe Hazard Zone */}
        <DangerZoneHologram
          position={simulationData.dangerZone}
          status={simulationData.status}
          waterLevel={simulationData.waterLevel}
        />

        {/* 7. Autonomous Rescue Drone with Volumetric Searchlight */}
        <RescueDrone
          target={simulationData.droneTarget}
          dangerZone={simulationData.dangerZone}
          status={simulationData.status}
        />

        <CameraController
          preset={cameraPreset}
          simulationData={simulationData}
          controlsRef={controlsRef}
        />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={6}
          maxDistance={46}
          target={[0, 1.2, 0]}
        />
      </Canvas>

      {/* Interactive 4-Angle Tactical Camera Switcher (Bottom-Center / Left HUD) */}
      <div className="pointer-events-auto absolute bottom-5 left-5 z-20 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-950/85 backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_25px_rgba(0,0,0,0.8)]">
          <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-cyan-400 px-1.5">
            <Camera className="w-3.5 h-3.5" />
            3D CAM:
          </span>
          {(
            [
              { id: 'OVERVIEW', label: '전체 관제 뷰', icon: Eye },
              { id: 'FLOOD_STAIRS', label: '1번 계단 폭우 유입', icon: ShieldAlert },
              { id: 'ELEVATOR_ADA', label: '교통약자 엘리베이터 #3', icon: Accessibility },
              { id: 'DRONE_CAM', label: '드론(UAV-01) 추적 뷰', icon: Video },
            ] as const
          ).map((cam) => {
            const Icon = cam.icon;
            const active = cameraPreset === cam.id;
            return (
              <button
                key={cam.id}
                type="button"
                onClick={() => setCameraPreset(cam.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  active
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)] font-semibold'
                    : 'bg-slate-900/70 text-slate-300 border border-slate-700/70 hover:border-cyan-500/40 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cam.label}
              </button>
            );
          })}
        </div>

        {/* 3D Legend Bar */}
        <div className="pointer-events-none flex flex-wrap items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800/90 text-[11px] font-mono text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            일반 대피로 (4번 고지대 계단 · 106명)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_#facc15]" />
            교통약자 우회로 (방수 엘리베이터 #3 · 14명)
          </span>
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            드래그: 360° 회전 / 휠: 줌
          </span>
        </div>
      </div>
    </div>
  );
}
