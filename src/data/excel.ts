import type { ExportSheet } from '../domain/excelExport';

/**
 * Writes one sheet to an .xlsx and hands it to the browser as a download.
 * The writer library is loaded on first use only, so the app's own bundle
 * doesn't grow for a button pressed a few times a month.
 */
export async function downloadXlsx(sheet: ExportSheet, fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const head = sheet.header.map((h) => ({
    value: h,
    fontWeight: 'bold' as const,
    backgroundColor: '#E7F2EC',
    color: '#0F3D2E',
  }));
  const body = sheet.rows.map((row) =>
    row.map((v) => (v === null || v === '' ? null : { value: v })),
  );
  await writeXlsxFile([head, ...body], {
    // Excel rejects these characters in a sheet name and caps it at 31.
    sheet: sheet.title.replace(/[[\]:*?/\\]/g, '-').slice(0, 31),
    rightToLeft: true,
    stickyRowsCount: 1,
    columns: sheet.widths.map((width) => ({ width })),
  }).toFile(fileName);
}
