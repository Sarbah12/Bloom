import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Renders the report to a PDF on this phone and opens the share sheet (Mail,
 * Messages, Files, AirDrop, print). Nothing is uploaded by Bloom, and the
 * temporary PDF is deleted afterwards.
 */
export async function shareReportPdf(html: string): Promise<boolean> {
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const file = new File(uri);
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share your cycle summary' });
    return true;
  } finally {
    if (file.exists) file.delete();
  }
}
