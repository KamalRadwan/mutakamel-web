import type EChartsReact from "echarts-for-react";

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;

  // Extract headers
  const headers = Object.keys(data[0]);
  
  // Format rows
  const csvRows = [];
  csvRows.push(headers.join(",")); // Header row
  
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val || "");
      // Escape commas and quotes
      return `"${stringVal.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }
  
  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
