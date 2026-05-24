import { jsPDF } from "jspdf";
import letterhead from "@/assets/papel-timbrado.jpg";

export type Status = "pendente" | "pago" | "cancelado";
export type Method = "dinheiro" | "pix" | "cartao" | "transferencia" | "convenio" | "outro";

export interface ExportEntry {
  entry_date: string;
  patient_name: string;
  professional_name: string;
  description: string;
  amount: number;
  method: Method | null;
  status: Status;
  paid_at: string | null;
}

const methodLabels: Record<Method, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao: "Cartão",
  transferencia: "Transferência", convenio: "Convênio", outro: "Outro",
};
const statusLabels: Record<Status, string> = {
  pendente: "Pendente", pago: "Pago", cancelado: "Cancelado",
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("pt-BR");

function csvCell(v: string | number | null | undefined) {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportEntriesToCSV(entries: ExportEntry[], filename = "financeiro.csv") {
  const header = ["Data", "Paciente", "Profissional", "Descrição", "Valor", "Método", "Status", "Pago em"];
  const rows = entries.map((e) => [
    fmtDate(e.entry_date),
    e.patient_name,
    e.professional_name,
    e.description,
    Number(e.amount).toFixed(2).replace(".", ","),
    e.method ? methodLabels[e.method] : "",
    statusLabels[e.status],
    e.paid_at ? new Date(e.paid_at).toLocaleString("pt-BR") : "",
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
  // BOM for Excel
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img); img.onerror = reject; img.src = src;
  });
}

export async function exportEntriesToPDF(
  entries: ExportEntry[],
  meta: { periodFrom: string; periodTo: string; totals: { total: number; pago: number; pendente: number; cancelado: number } },
  filename = "financeiro.pdf",
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const marginTop = 130;
  const marginBottom = 60;

  const img = await loadImage(letterhead);
  const drawLetterhead = () => doc.addImage(img.src, "JPEG", 0, 0, pageWidth, pageHeight);

  drawLetterhead();
  let y = marginTop;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(12, 35, 64);
  doc.text("Relatório Financeiro", marginX, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Período: ${fmtDate(meta.periodFrom)} a ${fmtDate(meta.periodTo)}`, marginX, y);
  y += 13;
  doc.text(
    `Total: ${fmtBRL(meta.totals.total)}  |  Recebido: ${fmtBRL(meta.totals.pago)}  |  A receber: ${fmtBRL(meta.totals.pendente)}  |  Cancelados: ${fmtBRL(meta.totals.cancelado)}`,
    marginX, y,
  );
  y += 16;

  // Table header
  const cols = [
    { key: "date",  label: "Data",         w: 60 },
    { key: "pat",   label: "Paciente",     w: 150 },
    { key: "prof",  label: "Profissional", w: 130 },
    { key: "desc",  label: "Descrição",    w: 200 },
    { key: "val",   label: "Valor",        w: 70,  align: "right" as const },
    { key: "met",   label: "Método",       w: 70 },
    { key: "st",    label: "Status",       w: 60 },
  ];
  const drawHeader = () => {
    doc.setFillColor(12, 35, 64);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    let x = marginX;
    doc.rect(marginX, y - 11, cols.reduce((s, c) => s + c.w, 0), 16, "F");
    cols.forEach((c) => {
      doc.text(c.label, c.align === "right" ? x + c.w - 4 : x + 4, y, { align: c.align ?? "left" });
      x += c.w;
    });
    y += 10;
  };
  drawHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);

  entries.forEach((e, i) => {
    if (y > pageHeight - marginBottom) {
      doc.addPage(); drawLetterhead(); y = marginTop; drawHeader();
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
    }
    if (i % 2 === 0) {
      doc.setFillColor(245, 248, 250);
      doc.rect(marginX, y - 9, cols.reduce((s, c) => s + c.w, 0), 14, "F");
    }
    let x = marginX;
    const values = [
      fmtDate(e.entry_date),
      e.patient_name, e.professional_name, e.description,
      fmtBRL(Number(e.amount)),
      e.method ? methodLabels[e.method] : "—",
      statusLabels[e.status],
    ];
    cols.forEach((c, idx) => {
      const txt = doc.splitTextToSize(values[idx], c.w - 8)[0] ?? "";
      doc.text(txt, c.align === "right" ? x + c.w - 4 : x + 4, y, { align: c.align ?? "left" });
      x += c.w;
    });
    y += 14;
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${total}`, pageWidth - marginX, pageHeight - 40, { align: "right" });
  }
  doc.save(filename);
}

export interface ReceiptData {
  patientName: string;
  professionalName: string;
  description: string;
  amount: number;
  method: Method | null;
  paidAt: Date;
  entryDate: string;
  receiptNumber: string;
}

export async function generateReceiptPDF(r: ReceiptData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 56;

  const img = await loadImage(letterhead);
  doc.addImage(img.src, "JPEG", 0, 0, pageWidth, pageHeight);

  let y = 160;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(12, 35, 64);
  doc.text("RECIBO DE PAGAMENTO", pageWidth / 2, y, { align: "center" });
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Nº ${r.receiptNumber}`, pageWidth / 2, y, { align: "center" });
  y += 30;

  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  const amountStr = r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const intro =
    `Recebemos de ${r.patientName} a importância de ${amountStr}, ` +
    `referente a "${r.description}", ` +
    `pago em ${r.paidAt.toLocaleDateString("pt-BR")} ` +
    `${r.method ? `via ${methodLabels[r.method]}` : ""}.`;
  const lines = doc.splitTextToSize(intro, pageWidth - marginX * 2);
  lines.forEach((ln: string) => { doc.text(ln, marginX, y); y += 18; });

  y += 16;
  doc.setDrawColor(45, 138, 158);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 20;

  const detail = (label: string, value: string) => {
    doc.setFont("helvetica", "bold"); doc.setTextColor(12, 35, 64);
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
    doc.text(value, marginX + 130, y);
    y += 18;
  };
  detail("Paciente:", r.patientName);
  detail("Profissional:", r.professionalName);
  detail("Descrição:", r.description);
  detail("Valor:", amountStr);
  detail("Método:", r.method ? methodLabels[r.method] : "—");
  detail("Data do atendimento:", new Date(r.entryDate + "T00:00:00").toLocaleDateString("pt-BR"));
  detail("Data do pagamento:", r.paidAt.toLocaleString("pt-BR"));

  y = pageHeight - 200;
  doc.setDrawColor(180, 180, 180);
  doc.line(pageWidth / 2 - 120, y, pageWidth / 2 + 120, y);
  doc.setFontSize(10); doc.setTextColor(80, 80, 80);
  doc.text(r.professionalName, pageWidth / 2, y + 14, { align: "center" });
  doc.text("Profissional responsável", pageWidth / 2, y + 28, { align: "center" });

  doc.save(`recibo_${r.receiptNumber}.pdf`);
}
