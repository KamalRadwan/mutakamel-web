import type EChartsReact from "echarts-for-react";

const DANGEROUS_CSV_PREFIX = /^(?:\s*[=+\-@]|\s*[\t\r\n])/;

function escapeCsvCell(value: unknown): string {
  const text = value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  const safeText = typeof value === "string" && DANGEROUS_CSV_PREFIX.test(text)
    ? `'${text}`
    : text;

  return `"${safeText.replace(/"/g, '""')}"`;
}

export function serializeCsv(data: readonly object[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows = [headers.map(escapeCsvCell).join(",")];

  for (const row of data) {
    csvRows.push(
      headers
        .map((header) => escapeCsvCell(Reflect.get(row, header)))
        .join(","),
    );
  }

  return csvRows.join("\n");
}

export function exportToCSV(data: readonly object[], filename: string) {
  if (!data || data.length === 0) return;

  const csvString = serializeCsv(data);
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportChartToImage(chartRef: React.RefObject<EChartsReact | null>, filename: string) {
  const chartInstance = chartRef.current?.getEchartsInstance();
  if (!chartInstance) return;

  const dataUrl = chartInstance.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#ffffff'
  });

  const link = document.createElement("a");
  link.setAttribute("href", dataUrl);
  link.setAttribute("download", `${filename}.png`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
