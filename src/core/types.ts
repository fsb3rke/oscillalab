import type { LocalizedText } from './i18n';

export interface ExperimentParameter {
  id: string;
  label: LocalizedText;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface HotspotItem {
  id: number;
  title: LocalizedText;
  description: LocalizedText;
  xPercent: number;
  yPercent: number;
}

export interface TheoryBlock {
  heading: LocalizedText;
  body: LocalizedText;
  equations?: readonly string[];
}

export interface ExperimentModule {
  readonly id: string;
  readonly title: LocalizedText;
  readonly courseCode: string;
  readonly summary: LocalizedText;
  readonly setupImageUrl?: string;
  readonly parameters: readonly ExperimentParameter[];
  readonly hotspots: readonly HotspotItem[];
  readonly theory?: readonly TheoryBlock[];
  computeDerivatives(state: readonly number[], t: number, params: Record<string, number>): number[];
  getInitialState(params: Record<string, number>): number[];
}
