import { jsPDF } from "jspdf";
import letterhead from "@/assets/papel-timbrado.jpg";
import { supabase } from "@/integrations/supabase/client";

interface ExportOptions {
  title: string;
  patientName: string;
  body: string;
  author?: string | null;
  date?: string;
  authorId?: string | null; // se passado, busca carimbo/assinatura do autor
}

interface SignatureBlock {
  stampDataUrl?: string;
  signatureDataUrl?: string;
  councilType?: string | null;
  councilNumber?: string | null;
}

async function fetchSignatureBlock(authorId: string): Promise<SignatureBlock> {
  const { data: prof } = await supabase
    .from("professional_profiles")
    .select("stamp_path, signature_path, council_type, council_number")
    .eq("user_id", authorId)
    .maybeSingle();
  if (!prof) return {};
  const result: SignatureBlock = {
    councilType: prof.council_type,
    councilNumber: prof.council_number,
  };
  const fetchAsDataUrl = async (path: string | null): Promise<string | undefined> => {
    if (!path) return undefined;
    const { data, error } = await supabase.storage.from("professional-assets").download(path);
    if (error || !data) return undefined;
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(data);
    });
  };
  result.stampDataUrl = await fetchAsDataUrl(prof.stamp_path);
  result.signatureDataUrl = await fetchAsDataUrl(prof.signature_path);
  return result;
}

export async function exportRecordToPDF(opts: ExportOptions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const marginTop = 150;
  const marginBottom = 180; // mais espaço para assinatura

  const img = await loadImage(letterhead);
  const sig = opts.authorId ? await fetchSignatureBlock(opts.authorId) : ({} as SignatureBlock);

  const drawLetterhead = () => {
    doc.addImage(img.src, "JPEG", 0, 0, pageWidth, pageHeight);
  };

  drawLetterhead();
  let y = marginTop;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(12, 35, 64);
  doc.text(opts.title, marginX, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Paciente: ${opts.patientName}`, marginX, y); y += 14;
  if (opts.author) { doc.text(`Profissional: ${opts.author}`, marginX, y); y += 14; }
  doc.text(`Data: ${opts.date ?? new Date().toLocaleString("pt-BR")}`, marginX, y); y += 20;

  doc.setDrawColor(45, 138, 158);
  doc.setLineWidth(1);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const lines = doc.splitTextToSize(opts.body || "", pageWidth - marginX * 2);
  for (const line of lines) {
    if (y > pageHeight - marginBottom) {
      doc.addPage(); drawLetterhead(); y = marginTop;
    }
    doc.text(line, marginX, y); y += 15;
  }

  // Bloco de assinatura/carimbo (apenas na última página)
  if (sig.signatureDataUrl || sig.stampDataUrl || sig.councilNumber) {
    const blockY = Math.max(y + 30, pageHeight - 170);
    if (sig.signatureDataUrl) {
      try { doc.addImage(sig.signatureDataUrl, "PNG", marginX, blockY, 160, 50); } catch { /* noop */ }
    }
    if (sig.stampDataUrl) {
      try { doc.addImage(sig.stampDataUrl, "PNG", pageWidth - marginX - 140, blockY, 140, 70); } catch { /* noop */ }
    }
    const lineY = blockY + 60;
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.5);
    doc.line(marginX, lineY, marginX + 220, lineY);
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    if (opts.author) doc.text(opts.author, marginX, lineY + 12);
    if (sig.councilNumber) {
      doc.text(`${sig.councilType ?? "Conselho"} ${sig.councilNumber}`, marginX, lineY + 24);
    }
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${total}`, pageWidth - marginX, pageHeight - 50, { align: "right" });
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
