import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Briefcase } from "lucide-react";

type Role = "admin" | "psicologo" | "profissional" | "administrativo";
const roleLabels: Record<Role, string> = {
  admin: "Administrador (acesso total)",
  psicologo: "Psicólogo (vê prontuário individual + multi)",
  profissional: "Profissional (vê só multidisciplinar)",
  administrativo: "Administrativo (sem prontuário)",
};

interface Specialty {
  id: string;
  name: string;
  default_role: Role;
  is_system: boolean;
}

export const Route = createFileRoute("/_authenticated/especialidades")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: EspecialidadesPage,
});

function EspecialidadesPage() {
  const [items, setItems] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("profissional");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("professional_specialties")
      .select("*")
      .order("name");
    if (error) toast.error(error.message);
    setItems((data as Specialty[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("professional_specialties").insert({
      name: newName.trim(),
      default_role: newRole,
      is_system: false,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Especialidade adicionada");
      setNewName(""); setNewRole("profissional"); load();
    }
    setSaving(false);
  };

  const remove = async (s: Specialty) => {
    if (s.is_system) return toast.error("Especialidade padrão não pode ser excluída");
    if (!confirm(`Excluir "${s.name}"? Usuários vinculados perderão essa especialidade.`)) return;
    const { error } = await supabase.from("professional_specialties").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Excluída"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Especialidades</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie as especialidades dos profissionais da clínica</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <h2 className="font-semibold">Nova especialidade</h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6">
              <Label>Nome (ex.: Nutricionista, Pediatra)</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Digite o nome" />
            </div>
            <div className="md:col-span-4">
              <Label>Tipo de acesso padrão</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="md:col-span-2" onClick={add} disabled={saving || !newName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Especialidade</th>
                  <th className="text-left p-3">Tipo de acesso padrão</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3 font-medium">
                      {s.name}
                      {s.is_system && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">padrão</span>}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{roleLabels[s.default_role]}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={s.is_system} onClick={() => remove(s)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        O <strong>tipo de acesso</strong> determina o que o profissional consegue ver no sistema. Especialidades servem para identificar a função
        (ex.: TO, Fonoaudióloga, Psicopedagoga) e ficam visíveis nos cadastros e na agenda.
      </p>
    </div>
  );
}
