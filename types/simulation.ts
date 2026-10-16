export type SimulationStatus = 'DANGER' | 'WARNING' | 'CLEAR';

export type Vec3 = [number, number, number];

export interface AIReport {
  summary: string;
  actionItems: string[];
  vulnerableNotice: string;
}

export interface VerificationCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface VerificationLoopData {
  primaryModel: string;
  companionVerifier: string;
  iterations: number;
  confidenceScore: number;
  checks: VerificationCheck[];
}

export interface SimulationData {
  status: SimulationStatus;
  scenario: string;
  waterLevel: number;
  dangerZone: Vec3;
  evacuationPath: Vec3[];
  vulnerablePath: Vec3[];
  droneTarget: Vec3;
  aiReport: AIReport;
  verificationLoop?: VerificationLoopData;
  goldenTimeSeconds?: number;
  totalEvacuees?: number;
  vulnerableEvacuees?: number;
  voiceBroadcast?: string;
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  stage: 'SENSOR_SYNC' | 'ARGON_CORE' | 'VERIFIER' | 'ROUTE_GEN' | 'VERIFIED';
  message: string;
}
