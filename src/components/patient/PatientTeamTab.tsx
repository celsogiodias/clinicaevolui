import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TeamMember {
  team_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

interface User {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  psicologo: "Psicólogo(a)",
  profissional: "Profissional",
  administrativo: "Administrativo",
};

export function PatientTeamTab({ patientId }: { patientId: string }) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: teamData }, { data: usersData }] = await Promise.all([
      supabase.rpc("get_patient_team", { _patient_id: patientId }),
      supabase.rpc("get_users_with_roles"),
    ]);
    setTeam((teamData as TeamMember[] | null) ?? []);
    setAllUsers((usersData as User[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [patientId]);

  const eligibleUsers = allUsers.filter(
    (u) => (u.role === "psicologo" || u.role === "profissional")
      && !team.some((t) => t.user_id === u.user_id),
  );

  const handleAdd = async () => {
    if (!selected) return;
    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("patient_team").insert({
      patient_id: patientId,
      user_id: selected,
      added_by: user?.id,
    });
    setAdding(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Profissional vinculado!");
    setSelected("");
    load();
  };

  const handleRemove = async (teamId: string, name: string | null) => {
    if (!confirm(`Remover ${name ?? "este profissional"} da equipe?`)) return;
    const { error } = await supabase.from("patient_team").delete().eq("id", teamId);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Removido da equipe");
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 bg-card">
        <h3 className="font-semibold mb-1">Vincular profissional ao paciente</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Apenas profissionais vinculados podem acessar o prontuário deste paciente.
          Psicólogos veem o prontuário individual e o multidisciplinar.
          Profissionais (saúde/educação) veem apenas o multidisciplinar.
        </p>
        <div className="flex gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um profissional..." /></SelectTrigger>
            <SelectContent>
              {eligibleUsers.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">Nenhum profissional disponível</div>
              ) : eligibleUsers.map((u) => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.full_name || u.email} — {roleLabels[u.role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={!selected || adding}>
            <UserPlus className="w-4 h-4 mr-2" />Adicionar
          </Button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Equipe atual ({team.length})</h3>
        {team.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum profissional vinculado ainda.</p>
        ) : (
          <div className="space-y-2">
            {team.map((m) => (
              <div key={m.team_id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <p className="font-medium">{m.full_name || m.email}</p>
                  <p className="text-sm text-muted-foreground">{m.email} · {roleLabels[m.role] ?? m.role}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(m.team_id, m.full_name)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
