import type { TaskManagerSetupContract } from '@kbn/task-manager-plugin/server';
import type {
  ApmDataAccessPluginSetup,
  ApmDataAccessPluginStart,
} from '@kbn/apm-data-access-plugin/server';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InstScorePluginSetup { }
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InstScorePluginStart { }

export interface InstScorePluginSetupDependencies {
  taskManager: TaskManagerSetupContract;
  apmDataAccess: ApmDataAccessPluginSetup;
}

export interface InstScorePluginStartDependencies {
  apmDataAccess: ApmDataAccessPluginStart;
}

export class ImpactLevel {
  constructor(name: string, weight: number) {
    this.name = name;
    this.weight = weight;
  }

  name: string;
  weight: number;
}

export const IL_CRITICAL = new ImpactLevel('critical', 40);
export const IL_IMPORTANT = new ImpactLevel('important', 30);
export const IL_NORMAL = new ImpactLevel('normal', 20);
export const IL_LOW = new ImpactLevel('low', 10);
export const IMPACT_LEVELS = [IL_CRITICAL, IL_IMPORTANT, IL_NORMAL, IL_LOW];

export enum EvalResultValues {
  PASSED = "passed",
  FAILED = "failed",
  NOT_APPLICABLE = "n/a",
}

export interface InstScoreRuleEvaluationResult {
  result: EvalResultValues;
  example: {
    field: string;
    value: string;
  } | undefined;
  extent: {
    count: number;
    total: number;
  } | undefined;
}

export interface InstScoreResult {
  overallScore: number;
  scorePerService: Map<string, number>;
}

export enum SignalType {
  SPANS = "spans",
  METRICS = "metrics",
  LOGS = "logs",
  RESOURCE = "resource"
}


