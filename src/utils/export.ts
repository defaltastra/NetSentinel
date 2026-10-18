/**
 * Utility functions for exporting data to CSV and PDF formats.
 */

export function exportToCsv(
  filename: string,
  rows: (string | number)[][],
  headers?: string[]
) {
  const content = [];
  if (headers && headers.length > 0) {
    content.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));
  }

  for (const row of rows) {
    content.push(
      row
        .map((val) => {
          const str = String(val ?? "");
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
  }

  const csvString = content.join("\r\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPdf(title: string, subtitle?: string) {
  // Trigger standard browser print with optimized media styles
  const prevTitle = document.title;
  document.title = `${title} - NetSentinel Security Report`;
  window.print();
  document.title = prevTitle;
}
