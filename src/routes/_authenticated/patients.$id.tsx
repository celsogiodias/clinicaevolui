import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PatientForm, type PatientFormData } from "@/components/PatientForm";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  component: EditPatient,
});

function EditPatient() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<PatientFormData | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("patients").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        toast.error("Paciente não encontrado");
        navigate({ to: "/patients" });
        return;
      }
      setInitial({
        full_name: data.full_name,
        phone: data.phone ?? "",
        email: data.email ?? "",
        birth_date: data.birth_date ?? "",
        notes: data.notes ?? "",
      });
    })();
  }, [id, navigate]);

  const handleSubmit = async (data: PatientFormData) => {
    const { error } = await supabase.from("patients").update({
      full_name: data.full_name,
      phone: data.phone || null,
      email: data.email || null,
      birth_date: data.birth_date || null,
      notes: data.notes || null,
    }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
      return;
    }
    toast.success("Paciente atualizado!");
    navigate({ to: "/patients" });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link to="/patients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Editar paciente</h1>
        <p className="text-muted-foreground mt-1">Atualize as informações abaixo.</p>
      </div>
      {initial ? (
        <PatientForm
          initial={initial}
          onSubmit={handleSubmit}
          submitLabel="Salvar alterações"
          onCancel={() => navigate({ to: "/patients" })}
        />
      ) : (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      )}
    </div>
  );
}
