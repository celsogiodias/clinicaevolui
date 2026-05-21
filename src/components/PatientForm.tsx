import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type PatientFormData = {
  full_name: string;
  phone: string;
  email: string;
  birth_date: string;
  notes: string;
};

export function PatientForm({
  initial,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  initial?: Partial<PatientFormData>;
  onSubmit: (data: PatientFormData) => Promise<void>;
  submitLabel: string;
  onCancel: () => void;
}) {
  const [data, setData] = useState<PatientFormData>({
    full_name: initial?.full_name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    birth_date: initial?.birth_date ?? "",
    notes: initial?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(data);
    } finally {
      setLoading(false);
    }
  };

  const update = <K extends keyof PatientFormData>(key: K, val: PatientFormData[K]) =>
    setData((d) => ({ ...d, [key]: val }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-card border rounded-xl p-6">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nome completo *</Label>
        <Input
          id="full_name"
          value={data.full_name}
          onChange={(e) => update("full_name", e.target.value)}
          required
          placeholder="Nome do paciente"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={data.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="(11) 99999-9999"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="paciente@email.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="birth_date">Data de nascimento</Label>
        <Input
          id="birth_date"
          type="date"
          value={data.birth_date}
          onChange={(e) => update("birth_date", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={data.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Informações relevantes sobre o paciente..."
          rows={5}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="flex-1 sm:flex-initial">
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
