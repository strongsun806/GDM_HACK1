'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SimulationData, Vec3 } from '@/types/simulation';
import {
  Camera,
  Eye,
  Radio,
  Accessibility,
  AlertTriangle,
  Crosshair,
  Compass,
  Maximize2,
  Play,
  Square,
} from 'lucide-react';

export type CameraPreset =
  | 'OVERVIEW'
  | 'DRONE_CAM'
  | 'ELEVATOR_CAM'
  | 'HAZARD_CAM'
  | 'AUTO_TOUR';

interface ThreeViewerProps {
  simulationData: SimulationData;
  cameraPreset: CameraPreset;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  thermalOptic: boolean;
  onToggleThermalOptic: () => void;
  isAutoDemo: boolean;
  onToggleAutoDemo: () => void;
  demoBanner?: {
    step: string;
    title: string;
    progressPercent: number;
  } | null;
}

/**
 * Exact interior eye-level camera angle matching the user's preferred screenshot
 */
const INITIAL_CAMERA_POS: [number, number, number] = [-3.2, 5.1, 16.8];
const INITIAL_CAMERA_TARGET: [number, number, number] = [0.8, 1.8, -1.2];

/**
 * 1. Photorealistic Underground Metro Architecture (Yeouido Station B2 Twin)
 */
function StationArchitecture({
  waterLevel,
  status,
  hideLabels,
}: {
  waterLevel: number;
  status: SimulationData['status'];
  hideLabels: boolean;
}) {
  const pillarPositions: [number, number][] = useMemo(
    () => [
      [-14, -7],
      [-5, -7],
      [5, -7],
      [14, -7],
      [-14, 7],
      [-5, 7],
      [5, 7],
      [14, 7],
    ],
    []
  );

  const ceilingLightX = useMemo(() => [-16, -8, 0, 8, 16], []);
  const isPowerCut = waterLevel >= 1.5;
  const submergenceRatio = Math.min(1, waterLevel / 4.5);

  return (
    <group>
      {/* Main Concourse Polished Granite Floor */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[48, 0.3, 32]} />
        <meshStandardMaterial
          color="#090f1d"
          roughness={Math.max(0.08, 0.32 - submergenceRatio * 0.22)}
          metalness={0.65 + submergenceRatio * 0.25}
        />
      </mesh>

      {/* Architectural Sub-Grid & Tactile Paving Guide Strips */}
      <Grid
        position={[0, 0.01, 0]}
        args={[48, 32]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={5}
        sectionThickness={1.1}
        sectionColor="#0284c7"
        fadeDistance={46}
        fadeStrength={1.3}
      />

      {/* Yellow Tactile Safety Line along North & South Track Edges */}
      {[-10.1, 10.1].map((zPos, i) => (
        <mesh key={i} position={[0, 0.03, zPos]}>
          <boxGeometry args={[44, 0.02, 0.28]} />
          <meshStandardMaterial
            color="#eab308"
            emissive="#ca8a04"
            emissiveIntensity={0.45}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* Upper Structural Ceiling & Steel Space-Frame Trusses */}
      <group position={[0, 8.2, 0]}>
        {/* One-way architectural ceiling plane: visible from inside looking up, never blocks camera from above */}
        <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[48, 32]} />
          <meshStandardMaterial
            color="#050914"
            roughness={0.85}
            metalness={0.5}
            side={THREE.FrontSide}
          />
        </mesh>

        {/* Cross Longitudinal Steel I-Beams */}
        {[-10, -5, 0, 5, 10].map((zBeam, idx) => (
          <mesh key={idx} position={[0, -0.05, zBeam]}>
            <boxGeometry args={[46, 0.28, 0.35]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} />
          </mesh>
        ))}

        {/* Transverse Rib Trusses & Recessed Linear LED Coves */}
        {ceilingLightX.map((lx, idx) => (
          <group key={idx} position={[lx, -0.15, 0]}>
            <mesh>
              <boxGeometry args={[0.45, 0.24, 28]} />
              <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, -0.14, 0]}>
              <boxGeometry args={[0.18, 0.04, 24]} />
              <meshStandardMaterial
                color={isPowerCut ? '#f97316' : '#bae6fd'}
                emissive={isPowerCut ? '#ea580c' : '#38bdf8'}
                emissiveIntensity={isPowerCut ? 1.1 : 1.6}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Depressed Dual Railway Track Bed (North & South) */}
      {[-12.8, 12.8].map((zPos, idx) => (
        <group key={idx} position={[0, -0.7, zPos]}>
          <mesh receiveShadow>
            <boxGeometry args={[48, 0.4, 4.2]} />
            <meshStandardMaterial color="#030712" roughness={0.9} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.24, -0.75]}>
            <boxGeometry args={[48, 0.08, 0.1]} />
            <meshStandardMaterial color="#64748b" metalness={0.95} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.24, 0.75]}>
            <boxGeometry args={[48, 0.08, 0.1]} />
            <meshStandardMaterial color="#64748b" metalness={0.95} roughness={0.15} />
          </mesh>
        </group>
      ))}

      {/* Realistic Subway Train Stopped at North Track */}
      <group position={[-2, 1.35, -12.7]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[36, 3.1, 3.1]} />
          <meshPhysicalMaterial
            color="#1e293b"
            metalness={0.88}
            roughness={0.18}
            clearcoat={0.8}
          />
        </mesh>
        {[-12, -4, 4, 12].map((rx, i) => (
          <mesh key={i} position={[rx, 1.65, 0]}>
            <boxGeometry args={[4.2, 0.22, 2.1]} />
            <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, -0.25, 1.56]}>
          <boxGeometry args={[36.05, 0.24, 0.03]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={1.1}
          />
        </mesh>
        {[-14, -10.5, -7, -3.5, 0, 3.5, 7, 10.5, 14].map((wx, i) => (
          <mesh key={i} position={[wx, 0.35, 1.56]}>
            <boxGeometry args={[2.3, 1.05, 0.03]} />
            <meshStandardMaterial
              color="#fef3c7"
              emissive="#f59e0b"
              emissiveIntensity={0.75}
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
      </group>

      {/* Glass Platform Screen Doors (PSD) along North Platform Edge */}
      <group position={[0, 1.55, -10.45]}>
        <mesh>
          <boxGeometry args={[44, 3.1, 0.14]} />
          <meshPhysicalMaterial
            color="#0f172a"
            transparent
            opacity={0.38}
            roughness={0.08}
            metalness={0.9}
            transmission={0.55}
          />
        </mesh>
        <mesh position={[0, 1.48, 0]}>
          <boxGeometry args={[44, 0.26, 0.22]} />
          <meshStandardMaterial color="#020617" metalness={0.85} roughness={0.2} />
        </mesh>
        {[-15, -9, -3, 3, 9, 15].map((dx, i) => (
          <mesh key={i} position={[dx, 1.48, 0.12]}>
            <boxGeometry args={[2.2, 0.08, 0.02]} />
            <meshStandardMaterial
              color={status === 'DANGER' ? '#ef4444' : '#10b981'}
              emissive={status === 'DANGER' ? '#ef4444' : '#10b981'}
              emissiveIntensity={1.8}
            />
          </mesh>
        ))}
      </group>

      {/* 8 Octagonal Brushed-Steel Structural Columns */}
      {pillarPositions.map(([x, z], idx) => {
        const isSubmerged = waterLevel > 0.2;
        return (
          <group key={idx} position={[x, 0, z]}>
            <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.92, 1.05, 0.7, 8]} />
              <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.75} />
            </mesh>
            <mesh position={[0, 4.1, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.72, 0.78, 8.2, 12]} />
              <meshStandardMaterial
                color={isSubmerged ? '#0f172a' : '#1e293b'}
                roughness={isSubmerged ? 0.1 : 0.28}
                metalness={isSubmerged ? 0.92 : 0.75}
              />
            </mesh>
            <mesh position={[0, 7.75, 0]}>
              <cylinderGeometry args={[1.35, 0.72, 0.7, 8]} />
              <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, 3.2, 0]}>
              <cylinderGeometry args={[0.76, 0.76, 0.16, 16]} />
              <meshStandardMaterial
                color={
                  status === 'DANGER'
                    ? '#ef4444'
                    : status === 'WARNING'
                    ? '#f59e0b'
                    : '#38bdf8'
                }
                emissive={
                  status === 'DANGER'
                    ? '#ef4444'
                    : status === 'WARNING'
                    ? '#f59e0b'
                    : '#38bdf8'
                }
                emissiveIntensity={status === 'DANGER' ? 2.4 : 1.1}
              />
            </mesh>
          </group>
        );
      })}

      {/* Central Automated Fare Turnstile Array */}
      {[-3.6, -1.8, 0, 1.8, 3.6].map((zOffset, idx) => (
        <group key={idx} position={[3.5, 0.55, zOffset]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.5, 1.1, 0.32]} />
            <meshStandardMaterial color="#334155" metalness={0.88} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.57, 0]}>
            <boxGeometry args={[1.45, 0.06, 0.26]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#10b981"
              emissiveIntensity={2.0}
            />
          </mesh>
        </group>
      ))}

      {/* WEST EXIT 1 STAIRWELL (Hazard Inflow / Automatic Floodgate Barrier) */}
      <group position={[-17.2, 0, 10]} rotation={[0, Math.PI, 0]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} position={[i * 0.62, i * 0.34 + 0.17, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.66, 0.34, 4.4]} />
            <meshStandardMaterial color="#1e293b" roughness={0.25} metalness={0.7} />
          </mesh>
        ))}
        {waterLevel >= 1.0 && (
          <mesh position={[-0.3, 0.85, 0]}>
            <boxGeometry args={[0.22, 1.7, 4.5]} />
            <meshStandardMaterial
              color="#dc2626"
              emissive="#991b1b"
              emissiveIntensity={1.2}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        )}
        {!hideLabels && (
          <Html
            position={[3.2, 4.8, 0]}
            center
            zIndexRange={[1, 3]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="pointer-events-none select-none px-2 py-0.5 rounded bg-red-950/85 border border-red-500/70 text-[10px] font-mono text-red-200 whitespace-nowrap shadow-md">
              ⛔ 서쪽 1번 출구 (폭우 유입 · 차수판 작동)
            </div>
          </Html>
        )}
      </group>

      {/* EAST EXIT 4 HIGH-GROUND STAIRWELL */}
      <group position={[15.5, 0, -10]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} position={[i * 0.62, i * 0.34 + 0.17, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.66, 0.34, 4.4]} />
            <meshStandardMaterial
              color="#064e3b"
              emissive="#10b981"
              emissiveIntensity={0.45}
              roughness={0.3}
            />
          </mesh>
        ))}
        <mesh position={[7.2, 5.2, 0]}>
          <boxGeometry args={[0.3, 2.4, 4.6]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#10b981"
            emissiveIntensity={1.6}
            transparent
            opacity={0.45}
          />
        </mesh>
        {!hideLabels && (
          <Html
            position={[5.0, 5.4, 0]}
            center
            zIndexRange={[1, 3]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="pointer-events-none select-none px-2 py-0.5 rounded bg-emerald-950/85 border border-emerald-400/80 text-[10px] font-mono text-emerald-200 whitespace-nowrap shadow-md">
              🏃 동쪽 4번 고지대 출구 (여의도공원 대피소 240m)
            </div>
          </Html>
        )}
      </group>

      {/* WATERPROOF ELEVATOR #3 SHAFT */}
      <group position={[13, 3.6, -2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.9, 7.2, 2.9]} />
          <meshPhysicalMaterial
            color="#fde047"
            emissive="#eab308"
            emissiveIntensity={0.32}
            transparent
            opacity={0.28}
            roughness={0.1}
            metalness={0.85}
            transmission={0.5}
          />
        </mesh>
        {[
          [-1.42, -1.42],
          [1.42, -1.42],
          [-1.42, 1.42],
          [1.42, 1.42],
        ].map(([cx, cz], i) => (
          <mesh key={i} position={[cx, 0, cz]}>
            <boxGeometry args={[0.14, 7.2, 0.14]} />
            <meshStandardMaterial
              color="#eab308"
              emissive="#ca8a04"
              emissiveIntensity={0.9}
              metalness={0.9}
            />
          </mesh>
        ))}
        <ElevatorCabin />
        {!hideLabels && (
          <Html
            position={[0, 4.3, 0]}
            center
            zIndexRange={[1, 3]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="pointer-events-none select-none px-2 py-0.5 rounded bg-amber-950/90 border border-amber-400 text-[10px] font-mono text-amber-200 whitespace-nowrap shadow-md">
              ♿ 방수 엘리베이터 #3 (IP68 · 교통약자 전용)
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

function ElevatorCabin() {
  const cabinRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!cabinRef.current) return;
    const t = clock.getElapsedTime();
    cabinRef.current.position.y = Math.sin(t * 0.9) * 2.1;
  });
  return (
    <mesh ref={cabinRef} position={[0, -1.5, 0]}>
      <boxGeometry args={[2.45, 2.3, 2.45]} />
      <meshStandardMaterial
        color="#fef08a"
        emissive="#eab308"
        emissiveIntensity={0.85}
        transparent
        opacity={0.65}
      />
    </mesh>
  );
}

/**
 * 2. Surreal Hydrodynamic Flood Water Surface + Pillar Foam Rings + Stairwell Cascade
 */
function RisingFloodWater({
  targetWaterLevel,
  dangerZone,
}: {
  targetWaterLevel: number;
  dangerZone: Vec3;
}) {
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const subSurfaceRef = useRef<THREE.Mesh>(null);
  const foamGroupRef = useRef<THREE.Group>(null);
  const waterfallRef = useRef<THREE.Points>(null);
  const currentLevelRef = useRef<number>(targetWaterLevel);

  const pillarCoords: [number, number][] = useMemo(
    () => [
      [-14, -7],
      [-5, -7],
      [5, -7],
      [14, -7],
      [-14, 7],
      [-5, 7],
      [5, 7],
      [14, 7],
    ],
    []
  );

  const cascadeCount = 160;
  const cascadePositions = useMemo(() => {
    const arr = new Float32Array(cascadeCount * 3);
    for (let i = 0; i < cascadeCount; i++) {
      const progress = Math.random();
      arr[i * 3] = -23 + progress * 8;
      arr[i * 3 + 1] = (1 - progress) * 4.2 + Math.random() * 0.35;
      arr[i * 3 + 2] = 10 + (Math.random() - 0.5) * 3.8;
    }
    return arr;
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    currentLevelRef.current = THREE.MathUtils.lerp(
      currentLevelRef.current,
      targetWaterLevel,
      Math.min(1, delta * 3.2)
    );

    const waveOffset = Math.sin(t * 2.4) * 0.04 + Math.cos(t * 1.7) * 0.025;
    const effectiveY = Math.max(0.02, currentLevelRef.current + waveOffset);

    if (waterMeshRef.current) {
      waterMeshRef.current.position.y = effectiveY / 2;
      waterMeshRef.current.scale.y = Math.max(0.01, effectiveY);
      waterMeshRef.current.rotation.z = Math.sin(t * 1.1) * 0.0025;
      waterMeshRef.current.rotation.x = Math.cos(t * 0.9) * 0.0025;
      waterMeshRef.current.visible = currentLevelRef.current > 0.03;
    }

    if (subSurfaceRef.current) {
      subSurfaceRef.current.position.y = effectiveY + 0.02;
      subSurfaceRef.current.visible = currentLevelRef.current > 0.05;
    }

    if (foamGroupRef.current) {
      foamGroupRef.current.position.y = effectiveY + 0.03;
      foamGroupRef.current.visible = currentLevelRef.current > 0.1;
      foamGroupRef.current.children.forEach((child, idx) => {
        const s = 1 + Math.sin(t * 3.5 + idx) * 0.12;
        child.scale.set(s, s, 1);
      });
    }

    if (waterfallRef.current) {
      waterfallRef.current.visible = targetWaterLevel > 0.25;
      const posAttr = waterfallRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < cascadeCount; i++) {
        let x = posAttr.getX(i) + delta * 5.8;
        let y = posAttr.getY(i) - delta * 2.9;
        if (x > dangerZone[0] + 2.5 || y < effectiveY) {
          x = -23.5 + Math.random() * 1.8;
          y = 4.3 + Math.random() * 0.4;
        }
        posAttr.setXYZ(i, x, y, posAttr.getZ(i));
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh ref={waterMeshRef} position={[0, 0.01, 0]}>
        <boxGeometry args={[47.6, 1, 31.6]} />
        <meshPhysicalMaterial
          color="#0369a1"
          emissive="#082f49"
          emissiveIntensity={0.45}
          transparent
          opacity={0.62}
          roughness={0.07}
          metalness={0.25}
          transmission={0.55}
          ior={1.333}
          reflectivity={0.92}
          clearcoat={1}
          clearcoatRoughness={0.06}
        />
      </mesh>

      <mesh ref={subSurfaceRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[47.5, 31.5, 24, 24]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.35}
          transparent
          opacity={0.22}
          wireframe
        />
      </mesh>

      <group ref={foamGroupRef}>
        {pillarCoords.map(([x, z], idx) => (
          <mesh key={idx} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.78, 1.18, 24]} />
            <meshBasicMaterial
              color="#e0f2fe"
              transparent
              opacity={0.65}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        <mesh
          position={[dangerZone[0], 0, dangerZone[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[1.8, 3.6, 36]} />
          <meshBasicMaterial
            color="#bae6fd"
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <points ref={waterfallRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={cascadeCount}
            array={cascadePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#bae6fd"
          size={0.22}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/**
 * 3. Glowing 3D Evacuation Corridor + Animated Passenger Flow Cones
 */
function EvacuationCorridor({
  points,
  color,
  secondaryColor,
  pulseSpeed = 3.0,
}: {
  points: Vec3[];
  color: string;
  secondaryColor: string;
  pulseSpeed?: number;
}) {
  const flowGroupRef = useRef<THREE.Group>(null);

  const curve = useMemo(() => {
    if (!points || points.length < 2) return null;
    const vectors = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.25);
  }, [points]);

  const tubeGeometry = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, 72, 0.16, 16, false);
  }, [curve]);

  const outerGlowGeometry = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, 72, 0.34, 16, false);
  }, [curve]);

  const beaconCount = 14;

  useFrame(({ clock }) => {
    if (!curve || !flowGroupRef.current) return;
    const t = clock.getElapsedTime();
    flowGroupRef.current.children.forEach((child, idx) => {
      const u = (t * 0.26 * (pulseSpeed / 3) + idx / beaconCount) % 1;
      const pos = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u);
      child.position.copy(pos);
      child.lookAt(pos.clone().add(tangent));
    });
  });

  if (!points || points.length < 2 || !tubeGeometry || !outerGlowGeometry) return null;

  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.5}
          roughness={0.15}
        />
      </mesh>

      <mesh geometry={outerGlowGeometry}>
        <meshBasicMaterial color={secondaryColor} transparent opacity={0.22} />
      </mesh>

      <group ref={flowGroupRef}>
        {Array.from({ length: beaconCount }).map((_, idx) => (
          <mesh key={idx}>
            <coneGeometry args={[0.26, 0.65, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>

      {points.map((pt, idx) => (
        <mesh key={idx} position={[pt[0], pt[1] + 0.05, pt[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.58, 24]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * 4. Compact Pulsing Hazard Zone
 */
function HazardZoneMarker({
  position,
  status,
  hideLabels,
}: {
  position: Vec3;
  status: SimulationData['status'];
  hideLabels: boolean;
}) {
  const cageRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (cageRef.current) {
      const s = 1 + Math.sin(t * 4.5) * 0.12;
      cageRef.current.scale.set(s, s, s);
      cageRef.current.rotation.y = t * 0.7;
    }
    if (ringRef.current) {
      const rs = 1 + ((t * 1.4) % 1.6);
      ringRef.current.scale.set(rs, rs, 1);
    }
  });

  if (status === 'CLEAR') return null;

  const mainColor = status === 'DANGER' ? '#ef4444' : '#f59e0b';

  return (
    <group position={position}>
      <mesh ref={cageRef} position={[0, 1.2, 0]}>
        <octahedronGeometry args={[1.35, 0]} />
        <meshStandardMaterial
          color={mainColor}
          emissive={mainColor}
          emissiveIntensity={2.4}
          wireframe
        />
      </mesh>

      <mesh ref={ringRef} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.85, 32]} />
        <meshBasicMaterial
          color={mainColor}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {!hideLabels && (
        <Html
          position={[0, 3.1, 0]}
          center
          zIndexRange={[1, 3]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="pointer-events-none select-none px-2 py-0.5 rounded bg-red-950/90 border border-red-500 text-[10px] font-mono font-bold text-red-200 whitespace-nowrap shadow-md">
            ⚠️ 침수 위험원 [{position[0]}, {position[2]}]
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * 5. Autonomous Rescue Scout Drone (UAV-01)
 */
function AutonomousScoutDrone({
  target,
  status,
  isDroneFpv,
}: {
  target: Vec3;
  status: SimulationData['status'];
  isDroneFpv: boolean;
}) {
  const droneGroupRef = useRef<THREE.Group>(null);
  const rotorRefs = useRef<(THREE.Mesh | null)[]>([]);
  const currentPos = useRef<THREE.Vector3>(new THREE.Vector3(target[0], target[1], target[2]));

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const desired = new THREE.Vector3(
      target[0] + Math.sin(t * 1.2) * 1.1,
      Math.max(3.6, target[1]) + Math.sin(t * 2.2) * 0.22,
      target[2] + Math.cos(t * 1.2) * 1.1
    );
    currentPos.current.lerp(desired, Math.min(1, delta * 3.0));

    if (droneGroupRef.current) {
      droneGroupRef.current.position.copy(currentPos.current);
      droneGroupRef.current.rotation.z = Math.sin(t * 1.8) * 0.05;
      droneGroupRef.current.rotation.x = Math.cos(t * 1.5) * 0.05;
    }

    rotorRefs.current.forEach((rotor) => {
      if (rotor) rotor.rotation.y += delta * 32;
    });
  });

  const beamColor =
    status === 'DANGER' ? '#ef4444' : status === 'WARNING' ? '#f59e0b' : '#38bdf8';

  const armOffsets: [number, number][] = [
    [-0.75, -0.75],
    [0.75, -0.75],
    [-0.75, 0.75],
    [0.75, 0.75],
  ];

  return (
    <group ref={droneGroupRef} position={target}>
      {!isDroneFpv && (
        <>
          <mesh castShadow>
            <boxGeometry args={[0.9, 0.24, 0.9]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>

          <mesh position={[0, -0.18, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={2.5}
            />
          </mesh>

          {armOffsets.map(([ax, az], idx) => (
            <group key={idx} position={[ax, 0.05, az]}>
              <mesh>
                <cylinderGeometry args={[0.06, 0.06, 0.16, 10]} />
                <meshStandardMaterial color="#334155" metalness={0.8} />
              </mesh>
              <mesh
                ref={(el) => {
                  rotorRefs.current[idx] = el;
                }}
                position={[0, 0.1, 0]}
              >
                <boxGeometry args={[0.68, 0.02, 0.09]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
            </group>
          ))}

          <mesh position={[0, -2.1, 0]}>
            <coneGeometry args={[2.1, 4.0, 24, 1, true]} />
            <meshBasicMaterial
              color={beamColor}
              transparent
              opacity={0.14}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          <Html
            position={[0, 0.85, 0]}
            center
            zIndexRange={[1, 3]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="pointer-events-none select-none px-1.5 py-0.5 rounded bg-slate-950/90 border border-cyan-400/70 text-[9px] font-mono text-cyan-300 whitespace-nowrap">
              🚁 UAV-01 정찰 드론
            </div>
          </Html>
        </>
      )}

      <pointLight position={[0, -0.35, 0]} intensity={4.5} distance={18} color={beamColor} />
    </group>
  );
}

/**
 * 6. Buttery-Smooth Camera Rig:
 *    - Never snaps abruptly; uses smooth exponential damping across ALL presets
 *    - During OVERVIEW in Auto-Demo, adds a subtle cinematic dolly motion
 */
function CameraController({
  preset,
  droneTarget,
  dangerZone,
  isAutoDemo,
}: {
  preset: CameraPreset;
  droneTarget: Vec3;
  dangerZone: Vec3;
  isAutoDemo: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && controlsRef.current) {
      camera.position.set(...INITIAL_CAMERA_POS);
      controlsRef.current.target.set(...INITIAL_CAMERA_TARGET);
      controlsRef.current.update();
      initializedRef.current = true;
    }
  }, [camera]);

  useFrame(({ clock }, delta) => {
    if (!controlsRef.current) return;
    const t = clock.getElapsedTime();
    const smoothSpeed = Math.min(1, delta * 2.4);

    if (preset === 'DRONE_CAM') {
      const gimbalX = droneTarget[0] + Math.sin(t * 0.9) * 1.5;
      const gimbalY = Math.max(4.6, droneTarget[1] + 1.0) + Math.sin(t * 1.6) * 0.14;
      const gimbalZ = droneTarget[2] + Math.cos(t * 0.9) * 1.5;

      const lookX = dangerZone[0] * 0.55 + Math.sin(t * 0.5) * 1.6;
      const lookY = 0.3;
      const lookZ = dangerZone[2] * 0.55 + Math.cos(t * 0.5) * 1.6;

      camera.position.lerp(new THREE.Vector3(gimbalX, gimbalY, gimbalZ), smoothSpeed * 1.4);
      controlsRef.current.target.lerp(new THREE.Vector3(lookX, lookY, lookZ), smoothSpeed * 1.4);
      controlsRef.current.update();
    } else if (preset === 'ELEVATOR_CAM') {
      const swayX = Math.sin(t * 0.5) * 0.8;
      camera.position.lerp(new THREE.Vector3(5.2 + swayX, 4.3, 6.4), smoothSpeed);
      controlsRef.current.target.lerp(new THREE.Vector3(13, 2.3, -2), smoothSpeed);
      controlsRef.current.update();
    } else if (preset === 'HAZARD_CAM') {
      const swayZ = Math.cos(t * 0.5) * 0.8;
      camera.position.lerp(
        new THREE.Vector3(dangerZone[0] + 7.8, 4.6, dangerZone[2] - 6.2 + swayZ),
        smoothSpeed
      );
      controlsRef.current.target.lerp(
        new THREE.Vector3(dangerZone[0], 1.2, dangerZone[2]),
        smoothSpeed
      );
      controlsRef.current.update();
    } else if (preset === 'AUTO_TOUR') {
      const camX = Math.sin(t * 0.35) * 9.5 - 1.0;
      const camY = 4.9 + Math.sin(t * 0.45) * 0.5;
      const camZ = Math.cos(t * 0.35) * 13.5 + 3.0;
      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), smoothSpeed);
      controlsRef.current.target.lerp(new THREE.Vector3(1.5, 1.7, -1.5), smoothSpeed);
      controlsRef.current.update();
    } else if (preset === 'OVERVIEW' && isAutoDemo) {
      // Smoothly glide back to the signature interior overview angle with subtle breathing motion
      const breatheX = INITIAL_CAMERA_POS[0] + Math.sin(t * 0.4) * 1.1;
      const breatheZ = INITIAL_CAMERA_POS[2] + Math.cos(t * 0.4) * 0.8;
      camera.position.lerp(
        new THREE.Vector3(breatheX, INITIAL_CAMERA_POS[1], breatheZ),
        smoothSpeed
      );
      controlsRef.current.target.lerp(
        new THREE.Vector3(...INITIAL_CAMERA_TARGET),
        smoothSpeed
      );
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={INITIAL_CAMERA_TARGET}
      enableDamping
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2 - 0.03}
      minDistance={3}
      maxDistance={28}
    />
  );
}

/**
 * Main Exported Client Component: ThreeViewer
 */
export default function ThreeViewer({
  simulationData,
  cameraPreset,
  onSelectCameraPreset,
  thermalOptic,
  onToggleThermalOptic,
  isAutoDemo,
  onToggleAutoDemo,
  demoBanner,
}: ThreeViewerProps) {
  const isDanger = simulationData.status === 'DANGER';
  const isPowerCut = simulationData.waterLevel >= 1.5;
  const isDroneFpv = cameraPreset === 'DRONE_CAM';

  const surfaceExitBridge: Vec3[] = useMemo(() => {
    const lastNode =
      simulationData.evacuationPath[simulationData.evacuationPath.length - 1] || [15, 0.5, -10];
    return [lastNode, [19.5, 4.2, -10]];
  }, [simulationData.evacuationPath]);

  return (
    <div className="relative w-full h-screen bg-[#020617] select-none overflow-hidden">
      <Canvas
        shadows
        camera={{ position: INITIAL_CAMERA_POS, fov: 46, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[isDroneFpv && thermalOptic ? '#041019' : '#020617']} />
        <fog
          attach="fog"
          args={[isDroneFpv && thermalOptic ? '#041019' : '#020617', 22, 68]}
        />

        <ambientLight intensity={isPowerCut ? 0.48 : 0.75} color="#e2e8f0" />
        <hemisphereLight
          color="#38bdf8"
          groundColor="#0f172a"
          intensity={isDroneFpv ? 0.95 : 0.7}
        />
        <directionalLight
          castShadow
          position={[16, 28, 18]}
          intensity={isPowerCut ? 0.85 : 1.35}
          color={isDanger ? '#fecaca' : '#f8fafc'}
          shadow-mapSize={[1024, 1024]}
        />

        <pointLight
          position={[-14, 6.2, 9]}
          intensity={isDanger ? 5.0 : 1.5}
          distance={26}
          color={isDanger ? '#ef4444' : '#38bdf8'}
        />
        <pointLight
          position={[15, 5.8, -9]}
          intensity={3.5}
          distance={24}
          color="#10b981"
        />
        <pointLight
          position={[13, 6.0, -2]}
          intensity={3.5}
          distance={20}
          color="#eab308"
        />

        <StationArchitecture
          waterLevel={simulationData.waterLevel}
          status={simulationData.status}
          hideLabels={isDroneFpv}
        />

        <RisingFloodWater
          targetWaterLevel={simulationData.waterLevel}
          dangerZone={simulationData.dangerZone}
        />

        <EvacuationCorridor
          points={simulationData.evacuationPath}
          color="#10b981"
          secondaryColor="#34d399"
          pulseSpeed={3.2}
        />
        <Line points={surfaceExitBridge} color="#10b981" lineWidth={3} dashed={false} />

        <EvacuationCorridor
          points={simulationData.vulnerablePath}
          color="#facc15"
          secondaryColor="#fde047"
          pulseSpeed={4.0}
        />

        <HazardZoneMarker
          position={simulationData.dangerZone}
          status={simulationData.status}
          hideLabels={isDroneFpv}
        />

        <AutonomousScoutDrone
          target={simulationData.droneTarget}
          status={simulationData.status}
          isDroneFpv={isDroneFpv}
        />

        <CameraController
          preset={cameraPreset}
          droneTarget={simulationData.droneTarget}
          dangerZone={simulationData.dangerZone}
          isAutoDemo={isAutoDemo}
        />
      </Canvas>

      {/* =====================================================================
          CINEMATIC AUTO-DEMO DIRECTOR BANNER & PROGRESS BAR
      ===================================================================== */}
      {demoBanner && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-xl rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-cyan-400/80 shadow-2xl px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
              <span className="px-2 py-0.5 rounded bg-cyan-500/25 border border-cyan-400/60 text-[10px] font-mono font-extrabold text-cyan-300">
                {demoBanner.step}
              </span>
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {demoBanner.title}
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-300 shrink-0">
              {demoBanner.progressPercent}%
            </span>
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 transition-all duration-300"
              style={{ width: `${demoBanner.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* TRUE FIRST-PERSON DRONE GIMBAL HUD OVERLAY */}
      {isDroneFpv && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center overflow-hidden"
        >
          {thermalOptic && (
            <div className="absolute inset-0 bg-cyan-500/12 mix-blend-screen" />
          )}

          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, transparent 50%, rgba(6, 182, 212, 0.25) 50%)',
              backgroundSize: '100% 4px',
            }}
          />

          <div className="absolute top-28 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-1.5 rounded-full bg-slate-950/85 border border-cyan-500/50 text-[11px] font-mono text-cyan-300 shadow-lg">
            <span className="flex items-center gap-1.5 text-red-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              REC · UAV-01 FPV GIMBAL
            </span>
            <span>ALT: {(simulationData.droneTarget[1] + 1.0).toFixed(1)}m</span>
            <span>OPTIC: {thermalOptic ? 'THERMAL IR' : 'DAYLIGHT HD'}</span>
            <span>WATER: {simulationData.waterLevel.toFixed(1)}m</span>
            <span className="hidden sm:inline text-emerald-300">
              GPS: 37.5216°N 126.9242°E
            </span>
          </div>

          <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400/80" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/80" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/80" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400/80" />

            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 text-[9px] font-mono text-cyan-400/80">
              <span>+15° ──</span>
              <span className="text-cyan-200 font-bold">00° ───</span>
              <span>-15° ──</span>
              <span>-30° ──</span>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 text-[9px] font-mono text-cyan-400/80 text-right">
              <span>── RNG 6.8m</span>
              <span className="text-red-300 font-bold">─── LOCK</span>
              <span>── FLOW 2.7m/s</span>
              <span>── EVAC 120P</span>
            </div>

            <div className="w-20 h-20 rounded-full border border-cyan-400/60 flex items-center justify-center">
              <Crosshair className="w-6 h-6 text-red-400/90 animate-pulse" />
            </div>

            <div className="absolute -bottom-7 px-2.5 py-0.5 rounded bg-slate-950/90 border border-red-500/60 text-[10px] font-mono text-red-300">
              TARGET LOCK: [{simulationData.dangerZone.join(', ')}] · 침수 유입원 실시간 감시 중
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM-LEFT CAMERA SWITCHER + 1-CLICK DEMO TOUR DIRECTOR */}
      <div className="fixed bottom-4 left-4 z-30 flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl">
        <span className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Camera className="w-3.5 h-3.5 text-cyan-400" />
          시점 전환
        </span>
        <button
          type="button"
          onClick={() => onSelectCameraPreset('OVERVIEW')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            cameraPreset === 'OVERVIEW'
              ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400 ring-2 ring-cyan-400/30 shadow-sm'
              : 'text-slate-300 hover:bg-slate-800/90 border border-transparent'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          전체 조감도
        </button>
        <button
          type="button"
          onClick={() => onSelectCameraPreset('DRONE_CAM')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            cameraPreset === 'DRONE_CAM'
              ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400 ring-2 ring-cyan-400/30 shadow-sm'
              : 'text-slate-300 hover:bg-slate-800/90 border border-transparent'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          드론 1인칭(FPV)
        </button>
        <button
          type="button"
          onClick={() => onSelectCameraPreset('ELEVATOR_CAM')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            cameraPreset === 'ELEVATOR_CAM'
              ? 'bg-amber-500/30 text-amber-200 border border-amber-400 ring-2 ring-amber-400/30 shadow-sm'
              : 'text-slate-300 hover:bg-slate-800/90 border border-transparent'
          }`}
        >
          <Accessibility className="w-3.5 h-3.5 text-amber-400" />
          방수 엘리베이터
        </button>
        <button
          type="button"
          onClick={() => onSelectCameraPreset('HAZARD_CAM')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            cameraPreset === 'HAZARD_CAM'
              ? 'bg-red-500/30 text-red-200 border border-red-400 ring-2 ring-red-400/30 shadow-sm'
              : 'text-slate-300 hover:bg-slate-800/90 border border-transparent'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          침수 구역
        </button>

        {/* 1-Click Auto Demo Tour Button */}
        <button
          type="button"
          onClick={onToggleAutoDemo}
          className={`ml-1 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
            isAutoDemo
              ? 'bg-red-500/30 border-red-400 text-red-200 ring-2 ring-red-400/40 animate-pulse'
              : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/70 text-emerald-200'
          }`}
          title="음성 안내방송·탭 전환·카메라 시점이 모두 자동으로 클릭되는 완벽 데모 시연"
        >
          {isAutoDemo ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              자동투어 중지
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              🎬 데모 자동투어
            </>
          )}
        </button>

        {isDroneFpv && (
          <button
            type="button"
            onClick={onToggleThermalOptic}
            className={`ml-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 border transition-all ${
              thermalOptic
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            {thermalOptic ? '열화상 ON' : '열화상 OFF'}
          </button>
        )}

        {cameraPreset !== 'OVERVIEW' && !isAutoDemo && (
          <button
            type="button"
            onClick={() => onSelectCameraPreset('OVERVIEW')}
            className="ml-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 flex items-center gap-1 border border-slate-600"
            title="전체 뷰로 복귀"
          >
            <Maximize2 className="w-3 h-3" />
            복귀
          </button>
        )}
      </div>
    </div>
  );
}
