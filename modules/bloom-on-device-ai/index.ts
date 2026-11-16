import { requireOptionalNativeModule } from 'expo';

type EventSubscription = { remove(): void };

export type OnDeviceAvailability =
  'available' | 'deviceNotEligible' | 'appleIntelligenceNotEnabled' | 'modelNotReady' | 'unavailable' | 'unsupportedOS';

interface NativeModule {
  availability(): OnDeviceAvailability;
  generate(requestId: string, instructions: string, prompt: string): Promise<string>;
  cancel(requestId: string): void;
  addListener(event: 'onChunk', listener: (e: { requestId: string; text: string }) => void): EventSubscription;
}

/** Missing on Android, the web and builds made before the module existed. */
const native = requireOptionalNativeModule<NativeModule>('BloomOnDeviceAI');

export function onDeviceAvailability(): OnDeviceAvailability {
  try {
    return native?.availability() ?? 'unsupportedOS';
  } catch {
    return 'unsupportedOS';
  }
}

let counter = 0;

/**
 * Streams a reply from Apple's on-device model. `onText` gets the reply so
 * far (not a delta). Rejects with a native error whose `code` is one of
 * ERR_TOO_LONG, ERR_DECLINED, ERR_LANGUAGE, ERR_BUSY, ERR_NOT_READY,
 * ERR_CANCELLED, ERR_GENERATION, ERR_UNAVAILABLE.
 */
export async function generateOnDevice(opts: {
  instructions: string;
  prompt: string;
  onText: (soFar: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  if (!native) throw Object.assign(new Error('On-device AI is not available.'), { code: 'ERR_UNAVAILABLE' });
  const requestId = `r${Date.now()}-${counter++}`;
  const sub = native.addListener('onChunk', (e) => {
    if (e.requestId === requestId) opts.onText(e.text);
  });
  const onAbort = () => native.cancel(requestId);
  opts.signal?.addEventListener('abort', onAbort);
  try {
    return await native.generate(requestId, opts.instructions, opts.prompt);
  } finally {
    sub.remove();
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
