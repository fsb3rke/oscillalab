import type { ExperimentModule } from './types';

const experiments = new Map<string, ExperimentModule>();

export function registerExperiment(exp: ExperimentModule): void {
  if (experiments.has(exp.id)) {
    throw new Error(`Çakışan deney kimliği: ${exp.id}`);
  }
  experiments.set(exp.id, exp);
}

export function getAllExperiments(): ExperimentModule[] {
  return Array.from(experiments.values());
}

export function getExperimentById(id: string): ExperimentModule | undefined {
  return experiments.get(id);
}
