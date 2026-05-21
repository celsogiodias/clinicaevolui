import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "psicologo" | "profissional" | "administrativo";

export interface PatientAccess {
  loading: boolean;
  userId: string | null;
  role: Role | null;
  isAdmin: boolean;
  isTeamMember: boolean;
  canSeeIndividual: boolean;   // psicologia
  canSeeMulti: boolean;
  canSeeProntuario: boolean;   // ao menos um
  canManageTeam: boolean;      // admin
}

export function usePatientAccess(patientId: string): PatientAccess {
  const [state, setState] = useState<PatientAccess>({
    loading: true,
    userId: null,
    role: null,
    isAdmin: false,
    isTeamMember: false,
    canSeeIndividual: false,
    canSeeMulti: false,
    canSeeProntuario: false,
    canManageTeam: false,
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const [{ data: roleRow }, { data: teamRow }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).order("role").limit(1).maybeSingle(),
        supabase.from("patient_team").select("id").eq("patient_id", patientId).eq("user_id", user.id).maybeSingle(),
      ]);
      const role = (roleRow?.role as Role | undefined) ?? "administrativo";
      const isAdmin = role === "admin";
      const isTeamMember = !!teamRow;
      const canSeeIndividual = isAdmin || (role === "psicologo" && isTeamMember);
      const canSeeMulti = isAdmin || ((role === "psicologo" || role === "profissional") && isTeamMember);
      setState({
        loading: false,
        userId: user.id,
        role,
        isAdmin,
        isTeamMember,
        canSeeIndividual,
        canSeeMulti,
        canSeeProntuario: canSeeIndividual || canSeeMulti,
        canManageTeam: isAdmin,
      });
    })();
  }, [patientId]);

  return state;
}
