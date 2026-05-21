import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Download, Trash2, Paperclip } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { recordTypeLabels } from "@/lib/recordTemplates";

interface Attachment {
  id: string;
  record_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  created_at: string;
  record_title?: string;
  record_type?: string;
}

interface RecordOption {
  id: string;
  title: string;
  record_type: string;
}

interface Props {
  patientId: string;
  isAdmin: boolean;
  canSeeIndividual: boolean;
  canSeeMulti: boolean;
}

export function AttachmentsTab({ patientId, isAdmin, canSeeIndividual, canSeeMulti }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [records, setRecords] = useState<RecordOption[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    // pega registros visíveis (RLS filtra)
    const { data: recs } = await supabase
      .from("medical_records")
      .select("id, title, record_type")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    setRecords((recs as RecordOption[] | null) ?? []);

    const recIds = (recs ?? []).map((r) => r.id);
    if (recIds.length === 0) {
      setAttachments([]);
      setLoading(false);
      return;
    }

    const { data: atts } = await supabase
      .from("record_attachments")
      .select("*")
      .in("record_id", recIds)
      .order("created_at", { ascending: false });

    const map = new Map((recs ?? []).map((r) => [r.id, r]));
    const items = ((atts as Attachment[] | null) ?? []).map((a) => ({
      ...a,
      record_title: map.get(a.record_id)?.title,
      record_type: map.get(a.record_id)?.record_type,
    }));
    setAttachments(items);
    setLoading(false);
  };

  useEffect(() => { load(); }, [patientId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedRecord) {
      toast.error("Selecione primeiro um registro");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 20 MB)");
      return;
    }
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${patientId}/${selectedRecord}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from("patient-documents").upload(path, file, { contentType: file.type });
    if (upErr) {
      toast.error("Erro no upload: " + upErr.message);
      setUploading(false);
      return;
    }

    const { error: insErr } = await supabase.from("record_attachments").insert({
      record_id: selectedRecord,
      file_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
    });
    if (insErr) {
      toast.error("Erro ao registrar: " + insErr.message);
      await supabase.storage.from("patient-documents").remove([path]);
    } else {
      toast.success("Arquivo enviado!");
      load();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownload = async (a: Attachment) => {
    const { data, error } = await supabase.storage
      .from("patient-documents")
      .createSignedUrl(a.file_path, 60);
    if (error || !data) { toast.error("Erro ao baixar"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (a: Attachment) => {
    if (!confirm(`Excluir ${a.file_name}?`)) return;
    await supabase.storage.from("patient-documents").remove([a.file_path]);
    const { error } = await supabase.from("record_attachments").delete().eq("id", a.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Excluído");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 bg-card">
        <h3 className="font-semibold mb-3">Enviar novo documento</h3>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Crie ao menos um registro no prontuário antes de anexar documentos.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Anexar ao registro</Label>
              <Select value={selectedRecord} onValueChange={setSelectedRecord}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {records.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      [{recordTypeLabels[r.record_type as keyof typeof recordTypeLabels] ?? r.record_type}] {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                onChange={handleUpload}
                disabled={uploading || !selectedRecord}
                className="hidden"
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !selectedRecord}
              >
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Escolher arquivo (máx. 20 MB)
              </Button>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold mb-3">Documentos anexados ({attachments.length})</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Paperclip className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhum anexo ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-card gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.file_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Vinculado a: {a.record_title} · {(a.size_bytes ? (a.size_bytes / 1024).toFixed(0) + " KB" : "")} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(a)} title="Baixar">
                    <Download className="w-4 h-4" />
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a)} title="Excluir">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
