import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users as UsersIcon, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Role = "admin" | "psicologo" | "profissional" | "administrativo";

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  psicologo: "Psicólogo(a)",
  profissional: "Profissional",
  administrativo: "Administrativo",
};

const roleDescriptions: Record<Role, string> = {
  admin: "Acesso total à plataforma",
  psicologo: "Acessa prontuários de psicologia dos seus pacientes",
  profissional: "Acessa prontuário multidisciplinar dos seus pacientes",
  administrativo: "Acessa agenda e financeiro dos pacientes",
};

type UserRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/users")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: UsersPage,
});

function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);
    const { data, error } = await supabase.rpc("get_users_with_roles");
    if (error) {
      toast.error("Erro ao carregar usuários: " + error.message);
    } else {
      setUsers((data ?? []) as UserRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdatingId(userId);
    // Remove papéis antigos e insere o novo (1 papel por usuário no momento)
    const { error: delError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (delError) {
      toast.error("Erro ao atualizar papel: " + delError.message);
      setUpdatingId(null);
      return;
    }
    const { error: insError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole });
    if (insError) {
      toast.error("Erro ao atualizar papel: " + insError.message);
    } else {
      toast.success("Papel atualizado com sucesso");
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
      );
    }
    setUpdatingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <UsersIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Defina o papel de cada profissional da equipe
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg mb-4">
          <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Administrador:</strong> acesso total à plataforma</p>
            <p><strong className="text-foreground">Psicólogo(a):</strong> acessa prontuários de psicologia</p>
            <p><strong className="text-foreground">Profissional:</strong> acessa prontuário multidisciplinar</p>
            <p><strong className="text-foreground">Administrativo:</strong> acessa agenda e financeiro</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground text-sm">
            Nenhum usuário encontrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[220px]">Papel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.user_id === currentUserId;
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">
                      {u.full_name ?? "—"}
                      {isSelf && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          você
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) => handleRoleChange(u.user_id, v as Role)}
                        disabled={updatingId === u.user_id || isSelf}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(roleLabels) as Role[]).map((r) => (
                            <SelectItem key={r} value={r}>
                              <div>
                                <div className="font-medium">{roleLabels[r]}</div>
                                <div className="text-xs text-muted-foreground">
                                  {roleDescriptions[r]}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Você não pode alterar o próprio papel para evitar perder acesso de administrador.
        Peça a outro administrador para fazer essa alteração.
      </p>
    </div>
  );
}
