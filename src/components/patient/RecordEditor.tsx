import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { templates, recordTypeLabels, type RecordType } from "@/lib/recordTemplates";

export interface RecordDraft {
  id?: string;
  record_type: RecordType;
  title: string;
  body: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (draft: RecordDraft) => Promise<void>;
  initial?: RecordDraft | null;
  allowedTypes: RecordType[];
}

export function RecordEditor({ open, onClose, onSave, initial, allowedTypes }: Props) {
  const [type, setType] = useState<RecordType>(initial?.record_type ?? allowedTypes[0]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType(initial?.record_type ?? allowedTypes[0]);
      setTitle(initial?.title ?? templates[initial?.record_type ?? allowedTypes[0]].title);
      setBody(initial?.body ?? templates[initial?.record_type ?? allowedTypes[0]].body);
    }
  }, [open]);

  const applyTemplate = (t: RecordType) => {
    setType(t);
    if (!initial) {
      setTitle(templates[t].title);
      setBody(templates[t].body);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: initial?.id, record_type: type, title: title.trim(), body });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar registro" : "Novo registro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!initial?.id && (
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => applyTemplate(v as RecordType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedTypes.map((t) => (
                    <SelectItem key={t} value={t}>{recordTypeLabels[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Conteúdo</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={20}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Todo o conteúdo é editável. Use o botão "Exportar PDF" depois de salvar para imprimir.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
