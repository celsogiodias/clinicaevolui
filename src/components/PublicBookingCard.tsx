import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Share2, QrCode, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function PublicBookingCard() {
  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/agendar`;
  }, []);

  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Agende sua consulta — AtivaMente",
          text: "Escolha profissional, dia e horário:",
          url,
        });
      } catch {
        /* usuário cancelou */
      }
    } else {
      copy();
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById("public-booking-qr");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "agendamento-ativamente.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="w-4 h-4 text-accent" />
          Compartilhe o agendamento online
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-center">
          <div className="bg-white p-3 rounded-lg border shadow-sm mx-auto">
            <QRCodeSVG
              id="public-booking-qr"
              value={url || "https://ativamente.app/agendar"}
              size={140}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="space-y-3 min-w-0">
            <p className="text-sm text-muted-foreground">
              Envie este link ou QR code para seus pacientes agendarem consulta direto pela clínica.
            </p>
            <div className="flex gap-2">
              <Input value={url} readOnly className="text-xs font-mono" />
              <Button size="sm" variant="outline" onClick={copy} title="Copiar link">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={share} className="btn-gold btn-gold-hover">
                <Share2 className="w-4 h-4 mr-1.5" /> Compartilhar
              </Button>
              <Button size="sm" variant="outline" onClick={downloadQR}>
                <QrCode className="w-4 h-4 mr-1.5" /> Baixar QR
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
