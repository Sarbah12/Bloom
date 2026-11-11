import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/**
 * Asks for a backup file and returns its text, or null if the picker was
 * dismissed. Files arriving via Drive or Mail are often mislabelled, so any
 * type can be chosen and parseBackup decides. The cached copy the picker makes
 * is deleted straight after reading, so no readable copy lingers.
 */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const file = new File(result.assets[0].uri);
  try {
    return await file.text();
  } finally {
    if (file.exists) file.delete();
  }
}
