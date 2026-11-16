import { requireOptionalNativeModule } from 'expo';

/** One sample Bloom wants in Apple Health; see lib/health/plan.ts. */
export interface HealthSample {
  /** Full HealthKit identifier, e.g. HKCategoryTypeIdentifierMenstrualFlow. */
  type: string;
  /** Stable for the same day, type and value; a new value is a new key. */
  key: string;
  date: string;
  value?: number;
  amount?: number;
  unit?: 'kg' | 'degC' | 'mL';
  cycleStart?: boolean;
}

export interface HealthStatus {
  /** Whether Bloom may write period days. */
  flow: 'unavailable' | 'notDetermined' | 'denied' | 'authorized';
  /** How many of the types Bloom writes are allowed. */
  allowed: number;
  total: number;
}

export interface SyncResult {
  added: number;
  removed: number;
  kept: number;
  skipped: number;
}

interface NativeModule {
  isAvailable(): boolean;
  status(): HealthStatus;
  requestAuthorization(): Promise<void>;
  sync(samples: HealthSample[]): Promise<SyncResult>;
  readPeriodDays(from: string): Promise<{ date: string; value: number }[]>;
}

/** Missing on Android, the web and builds made before the module existed. */
const native = requireOptionalNativeModule<NativeModule>('BloomHealth');

export function healthAvailable(): boolean {
  try {
    return native?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

export function healthStatus(): HealthStatus {
  try {
    return native?.status() ?? { flow: 'unavailable', allowed: 0, total: 0 };
  } catch {
    return { flow: 'unavailable', allowed: 0, total: 0 };
  }
}

function need(): NativeModule {
  if (!native) throw Object.assign(new Error('Apple Health isn’t available on this device.'), { code: 'ERR_UNAVAILABLE' });
  return native;
}

export const requestHealthAccess = () => need().requestAuthorization();
export const syncHealth = (samples: HealthSample[]) => need().sync(samples);
export const readHealthPeriodDays = (from: string) => need().readPeriodDays(from);
