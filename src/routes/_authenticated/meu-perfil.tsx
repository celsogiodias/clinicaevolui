import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Stamp, Upload, Trash2, UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meu-perfil")({
  component: MeuPerfilPage,
});

interface Prof {
  user_id: string;
  council_type: string | null;
  council_number: string | null;
  stamp_path: string | null;
  signature_path: string | null;
}

async function signed(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("professional-assets").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function MeuPerfilPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [prof, setProf] = useState<Prof | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const stampInput = useRef<HTMLInputElement>(null);
  const sigInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [{ data: profileRow }, { data: row }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("professional_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setFullName(profileRow?.full_name ?? "");
    const p = (row as Prof | null) ?? {
      user_id: user.id, council_type: "", council_number: "", stamp_path: null, signature_path: null,
    };
    setProf(p);
    setStampUrl(await signed(p.stamp_path));
    setSigUrl(await signed(p.signature_path));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upsert = async (patch: Partial<Prof>) => {
    if (!userId) return;
    const payload = { ...prof, ...patch, user_id: userId } as Prof;
    const { error } = await supabase
      .from("professional_profiles")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
    setProf(payload);
  };

  const save = async () => {
    setSaving(true);
    try {
      await upsert({ council_type: prof?.council_type ?? null, council_number: prof?.council_number ?? null });
      toast.success("Dados salvos");
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  const uploadAsset = async (kind: "stamp" | "signature", file: File) => {
    if (!userId) return;
    if (file.size > 2_000_000) return toast.error("Arquivo grande demais (máx 2MB)");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${userId}/${kind}.${ext}`;
    const { error } = await supabase.storage.from("professional-assets").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    try {
      await upsert(kind === "stamp" ? { stamp_path: path } : { signature_path: path });
      const url = await signed(path);
      if (kind === "stamp") setStampUrl(url); else setSigUrl(url);
      toast.success(kind === "stamp" ? "Carimbo atualizado" : "Assinatura atualizada");
    } catch (e: any) { toast.error(e.message); }
  };

  const removeAsset = async (kind: "stamp" | "signature") => {
    if (!userId || !prof) return;
    const path = kind === "stamp" ? prof.stamp_path : prof.signature_path;
    if (!path) return;
    await supabase.storage.from("professional-assets").remove([path]);
    try {
      await upsert(kind === "stamp" ? { stamp_path: null } : { signature_path: null });
      if (kind === "stamp") setStampUrl(null); else setSigUrl(null);
      toast.success("Removido");
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserCog className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Meu perfil profissional</h1>
          <p className="text-sm text-muted-foreground">Carimbo e assinatura aparecem automaticamente nos documentos que você gerar em PDF.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label>Nome completo</Label>
            <Input value={fullName} disabled />
            <p className="text-xs text-muted-foreground mt-1">Editar nome — peça ao administrador</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Conselho (ex.: CRP, CREFITO, CREFONO)</Label>
              <Input
                value={prof?.council_type ?? ""}
                onChange={(e) => setProf((p) => p ? { ...p, council_type: e.target.value } : p)}
                placeholder="CRP"
              />
            </div>
            <div>
              <Label>Número do conselho</Label>
              <Input
                value={prof?.council_number ?? ""}
                onChange={(e) => setProf((p) => p ? { ...p, council_number: e.target.value } : p)}
                placeholder="06/12345"
              />
            </div>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar dados"}</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Stamp className="w-4 h-4" /> Carimbo digital</h3>
            <p className="text-xs text-muted-foreground">Imagem PNG transparente, até 2MB. Aparece no rodapé dos documentos.</p>
            {stampUrl ? (
              <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-32">
                <img src={stampUrl} alt="Carimbo" className="max-h-32 object-contain" />
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-6 text-center text-sm text-muted-foreground">Nenhum carimbo enviado</div>
            )}
            <div className="flex gap-2">
              <input ref={stampInput} type="file" accept="image/png,image/jpeg" className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadAsset("stamp", e.target.files[0])} />
              <Button variant="outline" size="sm" onClick={() => stampInput.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Enviar
              </Button>
              {stampUrl && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeAsset("stamp")}>
                  <Trash2 className="w-4 h-4 mr-1" /> Remover
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold">Assinatura digital</h3>
            <p className="text-xs text-muted-foreground">Imagem PNG transparente da sua assinatura, até 2MB.</p>
            {sigUrl ? (
              <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-32">
                <img src={sigUrl} alt="Assinatura" className="max-h-32 object-contain" />
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-6 text-center text-sm text-muted-foreground">Nenhuma assinatura enviada</div>
            )}
            <div className="flex gap-2">
              <input ref={sigInput} type="file" accept="image/png,image/jpeg" className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadAsset("signature", e.target.files[0])} />
              <Button variant="outline" size="sm" onClick={() => sigInput.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Enviar
              </Button>
              {sigUrl && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeAsset("signature")}>
                  <Trash2 className="w-4 h-4 mr-1" /> Remover
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
