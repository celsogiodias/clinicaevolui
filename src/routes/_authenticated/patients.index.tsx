import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Search, Phone, Mail, Calendar, Pencil, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { safeError } from "@/lib/safe-errors"

export const Route = createFileRoute("/_authenticated/patients/")({
  component: PatientsList,
});

type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: string;
};

function PatientsList() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("patients").select("*").order("full_name");
    if (error) toast.error(safeError(error, "Erro ao carregar pacientes"));
    setPatients(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("patients").delete().eq("id", deleteId);
    if (error) toast.error(safeError(error, "Erro ao excluir paciente"));
    else {
      toast.success("Paciente excluído");
      setPatients(patients.filter((p) => p.id !== deleteId));
    }
    setDeleteId(null);
  };

  const filtered = patients.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.email?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    (p.phone?.includes(search) ?? false)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground mt-1">
            {patients.length} {patients.length === 1 ? "paciente cadastrado" : "pacientes cadastrados"}
          </p>
        </div>
        <Link to="/patients/new">
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" /> Novo paciente
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed rounded-xl">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg">
            {search ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Tente uma busca diferente" : "Comece cadastrando o primeiro paciente."}
          </p>
          {!search && (
            <Link to="/patients/new">
              <Button className="mt-4">
                <Plus className="w-4 h-4 mr-2" /> Cadastrar paciente
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-card border rounded-xl p-5 hover:border-accent/50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{p.full_name}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {p.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> {p.phone}
                      </span>
                    )}
                    {p.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> {p.email}
                      </span>
                    )}
                    {p.birth_date && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> {formatDate(p.birth_date)}
                      </span>
                    )}
                  </div>
                  {p.notes && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link to="/patients/$id" params={{ id: p.id }}>
                    <Button variant="outline" size="sm">
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(p.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados deste paciente serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
