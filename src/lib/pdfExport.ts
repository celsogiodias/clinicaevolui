import { jsPDF } from "jspdf";
import letterhead from "@/assets/papel-timbrado.jpg";

interface ExportOptions {
  title: string;
  patientName: string;
  body: string;
  author?: string | null;
  date?: string;
}

export async function exportRecordToPDF(opts: ExportOptions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  // Margens generosas para não invadir a logo (canto sup. dir.) e a barra colorida (rodapé)
  const marginX = 56;
  const marginTop = 150;
  const marginBottom = 70;

  const img = await loadImage(letterhead);

  const drawLetterhead = () => {
    doc.addImage(img.src, "JPEG", 0, 0, pageWidth, pageHeight);
  };

  drawLetterhead();
  let y = marginTop;

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(12, 35, 64);
  doc.text(opts.title, marginX, y);
  y += 22;

  // Metadados
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Paciente: ${opts.patientName}`, marginX, y);
  y += 14;
  if (opts.author) {
    doc.text(`Profissional: ${opts.author}`, marginX, y);
    y += 14;
  }
  doc.text(`Data: ${opts.date ?? new Date().toLocaleString("pt-BR")}`, marginX, y);
  y += 20;

  // Linha divisória
  doc.setDrawColor(45, 138, 158);
  doc.setLineWidth(1);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  // Corpo
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const lines = doc.splitTextToSize(opts.body || "", pageWidth - marginX * 2);
  for (const line of lines) {
    if (y > pageHeight - marginBottom) {
      doc.addPage();
      drawLetterhead();
      y = marginTop;
    }
    doc.text(line, marginX, y);
    y += 15;
  }

  // Numeração de páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Página ${i} de ${total}`,
      pageWidth - marginX,
      pageHeight - 50,
      { align: "right" },
    );
  }

  const safeName = opts.title.replace(/[^a-z0-9\-_]+/gi, "_").slice(0, 60);
  doc.save(`${safeName}.pdf`);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
