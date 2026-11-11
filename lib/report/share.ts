import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Reports live in their own cache folder, cleared each time a new one is made. */
const folder = () => new Directory(Paths.cache, 'reports');

/** Called when Bloom starts, so a shared report never lingers on the phone. */
export function clearSharedReports(): void {
  try {
    const dir = folder();
    if (dir.exists) dir.delete();
  } catch (e) {
    console.warn('Bloom: could not clear old reports', e);
  }
}

function clearOldReports() {
  const dir = folder();
  if (dir.exists) dir.delete();
  dir.create();
  return dir;
}

/**
 * Renders the report to a PDF on this phone and opens the share sheet (Mail,
 * Messages, Files, AirDrop, print). Nothing is uploaded by Bloom. The PDF is
 * kept in the app's private cache until the next report is made — deleting it
 * straight away would break apps that read it after the sheet closes.
 */
export async function shareReportPdf(html: string, fileName: string): Promise<boolean> {
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const printed = new File(uri);
  const dest = new File(clearOldReports(), fileName);
  printed.move(dest);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(dest.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share your cycle summary' });
  return true;
}
