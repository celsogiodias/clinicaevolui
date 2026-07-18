import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PatientForm, type PatientFormData } from "@/components/PatientForm";
import { safeError } from "@/lib/safe-errors"

export const Route = createFileRoute("/_authenticated/patients/new")({
  component: NewPatient,
});

function NewPatient() {
  const navigate = useNavigate();

  const handleSubmit = async (data: PatientFormData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada");
      return;
    }
    const { error } = await supabase.from("patients").insert({
      full_name: data.full_name,
      phone: data.phone || null,
      email: data.email || null,
      birth_date: data.birth_date || null,
      notes: data.notes || null,
      created_by: user.id,
    });
    if (error) {
      toast.error(safeError(error, "Erro ao cadastrar paciente."));
      return;
    }
    toast.success("Paciente cadastrado!");
    navigate({ to: "/patients" });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link to="/patients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Novo paciente</h1>
        <p className="text-muted-foreground mt-1">Preencha os dados do paciente abaixo.</p>
      </div>
      <PatientForm
        onSubmit={handleSubmit}
        submitLabel="Cadastrar paciente"
        onCancel={() => navigate({ to: "/patients" })}
      />
    </div>
  );
}
