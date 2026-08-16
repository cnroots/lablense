import { useEffect, useState } from "react";
import type {
  Analyte,
  InterpretationStatus,
  Observation,
  PatientContext,
  Unit
} from "@lablens/core";
import { useBackend } from "../store/backend-context";

export interface AnalyteSummary {
  analyte: Analyte;
  observations: Observation[];
  latest: Observation | null;
  status: InterpretationStatus;
  refMin?: number;
  refMax?: number;
  unitDisplay?: string;
}

export interface AppData {
  analytes: Analyte[];
  unitsById: Map<string, Unit>;
  summaries: Map<string, AnalyteSummary>;
}

function sortByDate(list: Observation[]): void {
  list.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
}

/**
 * Loads analytes, units and all observations for the active user, then builds
 * per-analyte summaries (latest value, interpretation status, reference
 * bounds). Re-runs whenever the active user changes or `refresh()` is called.
 */
export function useAppData(): AppData | null {
  const { backend, activeUser, version } = useBackend();
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    if (!activeUser) return;
    const user = activeUser;
    let cancelled = false;

    async function load(): Promise<void> {
      const [analytes, units, observations] = await Promise.all([
        backend.analytes.list(),
        backend.repositories.units.list(),
        backend.observations.list(user.id, {})
      ]);

      if (cancelled) return;

      const unitsById = new Map(units.map((u) => [u.id, u]));

      const byAnalyte = new Map<string, Observation[]>();
      for (const obs of observations) {
        const list = byAnalyte.get(obs.analyteId) ?? [];
        list.push(obs);
        byAnalyte.set(obs.analyteId, list);
      }
      for (const list of byAnalyte.values()) sortByDate(list);

      const context: PatientContext = {
        ageYears: user.ageYears,
        sex: user.sex
      };

      const summaries = new Map<string, AnalyteSummary>();
      for (const analyte of analytes) {
        const obs = byAnalyte.get(analyte.id) ?? [];
        const latest = obs[obs.length - 1] ?? null;

        let status: InterpretationStatus = "unknown";
        let refMin: number | undefined;
        let refMax: number | undefined;
        if (latest) {
          const interp = await backend.interpretation.interpret(latest, context);
          status = interp.status;
          refMin = interp.referenceRange?.lower?.value;
          refMax = interp.referenceRange?.upper?.value;
        }

        const unitDisplay = latest?.unitId
          ? unitsById.get(latest.unitId)?.displayName
          : undefined;

        summaries.set(analyte.id, {
          analyte,
          observations: obs,
          latest,
          status,
          refMin,
          refMax,
          unitDisplay
        });
      }

      if (!cancelled) setData({ analytes, unitsById, summaries });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [backend, activeUser, version]);

  return data;
}
