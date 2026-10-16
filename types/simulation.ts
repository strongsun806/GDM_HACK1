export type DisasterStatus = 'DANGER' | 'WARNING' | 'CLEAR';

export type Vec3 = [number, number, number];

export interface AIReport {
  summary: string;
  casualties: string;
  actionRequired: string;
}

export interface SimulationData {
  status: DisasterStatus;
  scenario: string;
  waterLevel: number; // 0.0 ~ 5.0 (meters)
  dangerZone: Vec3; // [x, y, z]
  evacuationPath: Vec3[]; // [[x, y, z], ...]
  vulnerablePath: Vec3[]; // [[x, y, z], ...]
  droneTarget: Vec3; // [x, y, z]
  aiReport: AIReport;
  goldenTime?: string;
  modelUsed?: string;
  reasoningLogs?: string[];
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  stage: 'SENSE' | 'ARGON-CORE' | 'PATHFIND' | 'DRONE-OPS' | 'SYSTEM';
  message: string;
  level: 'info' | 'warn' | 'critical' | 'success';
}
