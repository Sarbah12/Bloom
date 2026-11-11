import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Hands the export to the share sheet ("Save to Files", Drive, AirDrop, Mail).
 * The temporary copy is deleted afterwards so a readable file doesn't linger
 * in the app's cache.
 */
export async function shareExport(name: string, json: string): Promise<boolean> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export your Bloom data' });
    return true;
  } finally {
    if (file.exists) file.delete();
  }
}
