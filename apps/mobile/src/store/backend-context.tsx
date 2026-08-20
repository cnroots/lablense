import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { User } from "@lablens/core";
import { AppDataImporter, UcumImporter } from "@lablens/data";
import { LoincJsonImporter } from "@lablens/data";
import { dataImport } from "@lablens/data";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@lablens/data";
import { createExpoDatabase } from "@lablens/data/expo";
import { createMobileBackend } from "../composition/backend";
import type { MobileBackend } from "../composition/backend";
import { PaddleMobileEngine } from "../ocr/paddle-mobile-engine";
import { loadBundledPaddleModel } from "../ocr/model-loader";
import { SettingsStore } from "./settings";
import type { AppSettings } from "./settings";
import appData from "../app-data.json";
import ucumData from "../ucum-data.json";
import loincBloodData from "../loinc-data.json";

interface BackendContextValue {
  backend: MobileBackend;
  ready: boolean;
  error: string | null;
  settings: AppSettings;
  setSettings: (patch: Partial<AppSettings>) => void;
  activeUser: User | null;
  setActiveUser: (userId: string) => void;
  version: number;
  refresh: () => void;
}

const BackendContext = createContext<BackendContextValue | null>(null);

function bootstrap(): {
  backend: MobileBackend;
  handle: DatabaseHandle;
  settings: SettingsStore;
} {
  const handle = createExpoDatabase();

  const backend = createMobileBackend({
    handle,
    ocrEngine: new PaddleMobileEngine(loadBundledPaddleModel)
  });

  const settings = new SettingsStore(handle.connection);

  return { backend, handle, settings };
}

export function BackendProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [settingsState, setSettingsState] = useState<AppSettings | null>(null);
  const [activeUser, setActiveUserState] = useState<User | null>(null);

  const { backend, handle, settings } = useMemo(() => {
    try {
      return bootstrap();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      try {
        // Seed the terminology database on first launch (idempotent upserts).
        const analytes = await backend.analytes.list();

        // Blood-value LOINC catalog: imported whenever it is missing so that
        // upgrades from a pre-LOINC build also pick it up. This runs before
        // the application seed so curated LOINC links can be established.
        const loincBlood = handle.db
          .select({ id: dataImport.id })
          .from(dataImport)
          .where(eq(dataImport.dataset, "LOINC.BLOOD"))
          .get();
        if (!loincBlood) {
          new LoincJsonImporter(handle.db, handle.transactions).import({
            data: loincBloodData
          });
        }

        if (analytes.length === 0) {
          new AppDataImporter(handle.db, handle.transactions).import({
            data: appData
          });
          new UcumImporter(handle.db, handle.transactions).import({
            data: ucumData
          });
        }

        const stored = settings.load();
        let userId = stored.activeUserId;
        let user: User | null = userId
          ? await backend.users.get(userId).catch(() => null)
          : null;
        if (!user) {
          user = await backend.users.create({ name: "Mein Profil" });
          userId = user.id;
          settings.save({ activeUserId: userId });
        }

        if (cancelled) return;
        setSettingsState(settings.load());
        setActiveUserState(user);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [backend, handle, settings]);

  const setSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettingsState(settings.save(patch));
      setVersion((v) => v + 1);
    },
    [settings]
  );

  const setActiveUser = useCallback(
    (userId: string) => {
      settings.save({ activeUserId: userId });
      setSettingsState(settings.load());
      setVersion((v) => v + 1);
      backend.users.get(userId).then((user) => setActiveUserState(user));
    },
    [backend, settings]
  );

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo<BackendContextValue | null>(() => {
    if (!settingsState) return null;
    return {
      backend,
      ready,
      error,
      settings: settingsState,
      setSettings,
      activeUser,
      setActiveUser,
      version,
      refresh
    };
  }, [
    backend,
    ready,
    error,
    settingsState,
    setSettings,
    activeUser,
    setActiveUser,
    version,
    refresh
  ]);

  if (!value) {
    return null;
  }

  return (
    <BackendContext.Provider value={value}>{children}</BackendContext.Provider>
  );
}

export function useBackend(): BackendContextValue {
  const ctx = useContext(BackendContext);
  if (!ctx) {
    throw new Error("useBackend must be used within BackendProvider");
  }
  return ctx;
}
