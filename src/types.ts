export type Period = "day" | "week" | "month" | "lifetime";

export interface ImpactRange {
  energy: number;
  carbon: number;
  water: number;
}

export interface ModelUsage {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  energy: number;
  carbon: number;
  water: number;
  confidence: "low" | "medium" | "high";
}

export interface Project {
  id: string;
  name: string;
  pinned: boolean;
  rank: number;
  roots: string[];
  cwd?: string | null;
  models: ModelUsage[];
  lastUsed: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  energy: number;
  carbon: number;
  water: number;
  low: ImpactRange;
  high: ImpactRange;
}

export interface Dashboard {
  projects: Project[];
  total: { energyKWh: number; carbonKg: number; waterLitres: number };
  period: Period;
  health: { status: string; files: number; processed: number; errors: number; codexHome: string };
}

declare global {
  interface Window {
    imprint: {
      getDashboard(filters: { period: Period }): Promise<Dashboard>;
      getHealth(): Promise<Dashboard["health"]>;
      onUpdate(callback: (dashboard: Dashboard) => void): () => void;
    };
  }
}
