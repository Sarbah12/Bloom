import * as Print from 'expo-print';

/** In the browser preview, opens the print dialog (which can save as PDF). */
export async function shareReportPdf(html: string, _fileName: string): Promise<boolean> {
  await Print.printAsync({ html });
  return true;
}

export function clearSharedReports(): void {}
