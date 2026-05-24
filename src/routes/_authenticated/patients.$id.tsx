import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PatientForm, type PatientFormData } from "@/components/PatientForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatientAccess } from "@/lib/usePatientAccess";
import { PatientTeamTab } from "@/components/patient/PatientTeamTab";
import { MedicalRecordsTab } from "@/components/patient/MedicalRecordsTab";
import { AttachmentsTab } from "@/components/patient/AttachmentsTab";
import { FinancialTab } from "@/components/patient/FinancialTab";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  component: EditPatient,
});

function EditPatient() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<PatientFormData | null>(null);
  const [patientName, setPatientName] = useState<string>("");
  const access = usePatientAccess(id);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("patients").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        toast.error("Paciente não encontrado");
        navigate({ to: "/patients" });
        return;
      }
      setPatientName(data.full_name);
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
    setPatientName(data.full_name);
    toast.success("Paciente atualizado!");
  };

  if (!initial || access.loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/patients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{patientName}</h1>
        <p className="text-muted-foreground mt-1">Ficha completa do paciente</p>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          {access.canManageTeam && <TabsTrigger value="equipe">Equipe</TabsTrigger>}
          {access.canSeeIndividual && <TabsTrigger value="psico">Prontuário Psicologia</TabsTrigger>}
          {access.canSeeMulti && <TabsTrigger value="multi">Prontuário Multi</TabsTrigger>}
          {access.canSeeProntuario && <TabsTrigger value="docs">Documentos anexos</TabsTrigger>}
          <TabsTrigger value="financ">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-6 max-w-2xl">
          <PatientForm
            initial={initial}
            onSubmit={handleSubmit}
            submitLabel="Salvar alterações"
            onCancel={() => navigate({ to: "/patients" })}
          />
        </TabsContent>

        {access.canManageTeam && (
          <TabsContent value="equipe" className="mt-6">
            <PatientTeamTab patientId={id} />
          </TabsContent>
        )}

        {access.canSeeIndividual && (
          <TabsContent value="psico" className="mt-6">
            <MedicalRecordsTab
              patientId={id}
              patientName={patientName}
              scope="individual_psicologia"
              isAdmin={access.isAdmin}
            />
          </TabsContent>
        )}

        {access.canSeeMulti && (
          <TabsContent value="multi" className="mt-6">
            <MedicalRecordsTab
              patientId={id}
              patientName={patientName}
              scope="multidisciplinar"
              isAdmin={access.isAdmin}
            />
          </TabsContent>
        )}

        {access.canSeeProntuario && (
          <TabsContent value="docs" className="mt-6">
            <AttachmentsTab
              patientId={id}
              isAdmin={access.isAdmin}
              canSeeIndividual={access.canSeeIndividual}
              canSeeMulti={access.canSeeMulti}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
