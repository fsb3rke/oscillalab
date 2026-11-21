export interface ExperimentParameter {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface HotspotItem {
  id: number;
  title: string;
  description: string;
  xPercent: number;
  yPercent: number;
}

export interface ExperimentModule {
  readonly id: string;
  readonly title: string;
  readonly courseCode: string;
  readonly summary: string;
  readonly setupImageUrl?: string;
  readonly parameters: readonly ExperimentParameter[];
  readonly hotspots: readonly HotspotItem[];
  computeDerivatives(state: readonly number[], t: number, params: Record<string, number>): number[];
  getInitialState(params: Record<string, number>): number[];
}
