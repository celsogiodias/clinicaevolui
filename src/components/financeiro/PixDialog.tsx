import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generatePixPayload } from "@/lib/pix";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  entry: {
    id: string;
    description: string;
    amount: number;
    status: "pendente" | "pago" | "cancelado";
    patient_name: string;
  } | null;
  onPaid: () => void;
}

const LS_KEY = "ativamente_pix_config";

export function PixDialog({ open, onClose, entry, onPaid }: Props) {
  const [cfg, setCfg] = useState({ key: "", name: "", city: "" });
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCfg(JSON.parse(raw));
    } catch { /* noop */ }
  }, [open]);

  const saveCfg = (next: typeof cfg) => {
    setCfg(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  };

  const payload = useMemo(() => {
    if (!entry || !cfg.key || !cfg.name || !cfg.city) return "";
    return generatePixPayload({
      key: cfg.key,
      merchantName: cfg.name,
      merchantCity: cfg.city,
      amount: entry.amount,
      txid: entry.id.replace(/-/g, "").slice(0, 25),
      description: entry.description,
    });
  }, [entry, cfg]);

  const copy = async () => {
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    toast.success("Código Pix copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const markPaid = async () => {
    if (!entry) return;
    setSaving(true);
    const { error } = await supabase
      .from("financial_entries")
      .update({ status: "pago", method: "pix" })
      .eq("id", entry.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento confirmado!");
    onPaid();
    onClose();
  };

  if (!entry) return null;

  const missingCfg = !cfg.key || !cfg.name || !cfg.city;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cobrança via Pix</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Paciente</span><span className="font-medium">{entry.patient_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Descrição</span><span className="font-medium">{entry.description}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-primary">{entry.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
              <span className={entry.status === "pago" ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                {entry.status === "pago" ? "Pago" : entry.status === "cancelado" ? "Cancelado" : "Aguardando pagamento"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="md:col-span-3">
              <Label className="text-xs">Sua chave Pix</Label>
              <Input placeholder="CPF, e-mail, telefone ou chave aleatória"
                value={cfg.key} onChange={(e) => saveCfg({ ...cfg, key: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Nome do recebedor</Label>
              <Input placeholder="Nome que aparece no Pix" value={cfg.name}
                onChange={(e) => saveCfg({ ...cfg, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input placeholder="SAO PAULO" value={cfg.city}
                onChange={(e) => saveCfg({ ...cfg, city: e.target.value })} />
            </div>
          </div>

          {missingCfg ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Preencha os dados acima para gerar o código Pix. Ficam salvos neste dispositivo.
            </p>
          ) : (
            <>
              <div className="flex justify-center bg-white p-4 rounded-lg border">
                <QRCodeSVG value={payload} size={200} level="M" />
              </div>

              <div>
                <Label className="text-xs">Código copia-e-cola</Label>
                <div className="flex gap-2">
                  <Input value={payload} readOnly className="font-mono text-xs" />
                  <Button variant="outline" onClick={copy}>
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {entry.status !== "pago" && (
            <Button onClick={markPaid} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Marcar como pago
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
