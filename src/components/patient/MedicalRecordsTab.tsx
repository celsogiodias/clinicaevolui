import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Loader2, Pencil, FileDown, Trash2 } from "lucide-react";
import { RecordEditor, type RecordDraft } from "./RecordEditor";
import { recordTypeLabels, type RecordType } from "@/lib/recordTemplates";
import { exportRecordToPDF } from "@/lib/pdfExport";
import { Badge } from "@/components/ui/badge";

type Scope = "individual_psicologia" | "multidisciplinar";

interface Record {
  id: string;
  record_type: RecordType;
  title: string;
  content: { body?: string } | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
}

interface Props {
  patientId: string;
  patientName: string;
  scope: Scope;
  isAdmin: boolean;
}

export function MedicalRecordsTab({ patientId, patientName, scope, isAdmin }: Props) {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RecordDraft | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const allowedTypes: RecordType[] = scope === "individual_psicologia"
    ? ["anamnese", "diagnostico", "evolucao", "documento_cfp"]
    : ["evolucao", "documento_cfp"];

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("medical_records")
      .select("id, record_type, title, content, created_by, created_at, updated_at")
      .eq("patient_id", patientId)
      .eq("scope", scope)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar: " + error.message);
      setLoading(false);
      return;
    }

    const items = (data ?? []) as Record[];
    // buscar nomes dos autores
    const userIds = Array.from(new Set(items.map((r) => r.created_by)));
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, email").in("id", userIds);
      const map = new Map((profs ?? []).map((p) => [p.id, p.full_name || p.email || "—"]));
      items.forEach((r) => { r.author_name = map.get(r.created_by) ?? "—"; });
    }
    setRecords(items);
    setLoading(false);
  };

  useEffect(() => { load(); }, [patientId, scope]);

  const handleNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (r: Record) => {
    setEditing({
      id: r.id,
      record_type: r.record_type,
      title: r.title,
      body: r.content?.body ?? "",
    });
    setEditorOpen(true);
  };

  const handleSave = async (draft: RecordDraft) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (draft.id) {
      const { error } = await supabase.from("medical_records").update({
        title: draft.title,
        content: { body: draft.body },
        updated_by: user.id,
      }).eq("id", draft.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Registro atualizado!");
    } else {
      const { error } = await supabase.from("medical_records").insert({
        patient_id: patientId,
        scope,
        record_type: draft.record_type,
        title: draft.title,
        content: { body: draft.body },
        created_by: user.id,
      });
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Registro criado!");
    }
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("medical_records").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Excluído");
    load();
  };

  const handleExport = (r: Record) => {
    exportRecordToPDF({
      title: r.title,
      patientName,
      body: r.content?.body ?? "",
      author: r.author_name,
      date: new Date(r.created_at).toLocaleString("pt-BR"),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {records.length} registro{records.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={handleNew}><Plus className="w-4 h-4 mr-2" />Novo registro</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Nenhum registro ainda. Clique em "Novo registro" para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 bg-card">
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="secondary">{recordTypeLabels[r.record_type]}</Badge>
                  </div>
                  <h4 className="font-semibold truncate">{r.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.author_name} · {new Date(r.created_at).toLocaleString("pt-BR")}
                    {r.updated_at !== r.created_at && " · editado"}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleExport(r)} title="Exportar PDF">
                    <FileDown className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(r)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} title="Excluir">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              {r.content?.body && (
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap mt-2">
                  {r.content.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <RecordEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        initial={editing}
        allowedTypes={allowedTypes}
      />
    </div>
  );
}
