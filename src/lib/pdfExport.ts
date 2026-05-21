import { jsPDF } from "jspdf";
import logo from "@/assets/logo.png";

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
  const margin = 48;
  let y = margin;

  // Cabeçalho com logo
  try {
    const img = await loadImage(logo);
    const ratio = img.width / img.height;
    const h = 50;
    const w = h * ratio;
    doc.addImage(img.src, "PNG", margin, y, w, h);
  } catch {
    /* ignore */
  }
  y += 60;

  // Linha
  doc.setDrawColor(45, 138, 158);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(12, 35, 64);
  doc.text(opts.title, margin, y);
  y += 22;

  // Metadados
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Paciente: ${opts.patientName}`, margin, y);
  y += 14;
  if (opts.author) {
    doc.text(`Profissional: ${opts.author}`, margin, y);
    y += 14;
  }
  doc.text(`Data: ${opts.date ?? new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 22;

  // Corpo
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const lines = doc.splitTextToSize(opts.body || "", pageWidth - margin * 2);
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 15;
  }

  // Rodapé
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Página ${i} de ${total}`,
      pageWidth - margin,
      pageHeight - 20,
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
