export interface ThresholdProblem {
  metric: string;
  rule: string;
  observed: string | null;
}

export interface CheckProblem {
  name: string;
  passes: number;
  fails: number;
}

export interface Explanation {
  thresholds: ThresholdProblem[];
  checks: CheckProblem[];
}

export function explain(summary: unknown): Explanation;
export function describe(explanation: Explanation): string[];
export function explainFile(file: string): Explanation | null;
