export type SimulationStatus = 'DANGER' | 'WARNING' | 'CLEAR';

export type SupportedLang = 'ko' | 'en' | 'ja' | 'zh';

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
  edgeFallbackModel: string;
  iterations: number;
  confidenceScore: number;
  selfCorrectedNodes: number;
  checks: VerificationCheck[];
}

export interface ContextTelemetry {
  usedTokens: number;
  maxTokens: number;
  modalities: string[];
}

export interface MultilingualBroadcast {
  ko: string;
  en: string;
  ja: string;
  zh: string;
}

export interface SurfaceShelter {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  elevationMeters: number;
  etaMinutes: number;
  wheelchairAccessible: boolean;
  occupancyPercent: number;
  connectedExit: string;
  bearing: string;
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
  contextTelemetry?: ContextTelemetry;
  goldenTimeSeconds?: number;
  totalEvacuees?: number;
  vulnerableEvacuees?: number;
  voiceBroadcast?: string;
  translations?: MultilingualBroadcast;
  shelters?: SurfaceShelter[];
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  stage: 'SENSOR_SYNC' | 'ARGON_CORE' | 'VERIFIER' | 'ROUTE_GEN' | 'VERIFIED' | 'HITL_GATE';
  message: string;
}
