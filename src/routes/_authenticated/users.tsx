import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, UserIcon } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
});

type PapelDb = 'admin' | 'psicologo' | 'profissional' | 'administrativo';

interface Profissional {
  id: string;
  nome: string;
  email: string;
  papel: PapelDb;
}

const PAPEL_OPTIONS: { value: PapelDb; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'psicologo', label: 'Psicólogo(a)' },
  { value: 'profissional', label: 'Profissional' },
  { value: 'administrativo', label: 'Administrativo' },
];

async function listarProfissionais(): Promise<Profissional[]> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name', { ascending: true });
  if (error) throw new Error(error.message);
  const { data: roles } = await supabase.from('user_roles').select('user_id, role');
  const roleMap = new Map<string, PapelDb>();
  (roles ?? []).forEach((r: any) => {
    if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role as PapelDb);
  });
  return (profiles ?? []).map((p: any) => ({
    id: p.id,
    nome: p.full_name ?? '—',
    email: p.email ?? '',
    papel: roleMap.get(p.id) ?? 'administrativo',
  }));
}

async function atualizarPapel(userId: string, papel: PapelDb) {
  await supabase.from('user_roles').delete().eq('user_id', userId);
  const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: papel });
  if (error) throw new Error(error.message);
}

async function atualizarPerfil(userId: string, nome: string, email: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: nome, email })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

function UsersPage() {
  const queryClient = useQueryClient();
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentEmail(data.user?.email ?? null));
  }, []);

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState<string | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPapel, setFormPapel] = useState<PapelDb>('profissional');

  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ['profissionais'],
    queryFn: listarProfissionais,
  });

  const editarMutation = useMutation({
    mutationFn: async () => {
      if (!modoEdicao) return;
      await atualizarPerfil(modoEdicao, formNome, formEmail);
      await atualizarPapel(modoEdicao, formPapel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profissionais'] });
      toast.success('Profissional atualizado');
      fecharModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function abrirModalEditar(prof: Profissional) {
    setModoEdicao(prof.id);
    setFormNome(prof.nome);
    setFormEmail(prof.email);
    setFormPapel(prof.papel);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setModoEdicao(null);
  }

  async function alterarPapel(id: string, novo: PapelDb) {
    try {
      await atualizarPapel(id, novo);
      queryClient.invalidateQueries({ queryKey: ['profissionais'] });
      toast.success('Papel atualizado');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserIcon className="h-6 w-6 text-teal-600" />
            <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Visualize e ajuste o papel de cada profissional da equipe
          </p>
        </div>
        <Button
          onClick={() => toast.info('Novos usuários se cadastram pela tela de login; depois ajuste o papel aqui.')}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Como adicionar
        </Button>
      </div>

      <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">Definição dos papéis:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>Administrador:</strong> acesso total à plataforma</li>
          <li><strong>Psicólogo(a):</strong> acessa prontuários de psicologia</li>
          <li><strong>Profissional:</strong> acessa prontuário multidisciplinar</li>
          <li><strong>Administrativo:</strong> acessa agenda e financeiro</li>
        </ul>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : profissionais.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum profissional cadastrado ainda
                </TableCell>
              </TableRow>
            ) : (
              profissionais.map((prof) => (
                <TableRow key={prof.id}>
                  <TableCell className="font-medium">
                    {prof.nome}
                    {prof.email === currentEmail && (
                      <span className="ml-2 rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-700">
                        você
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{prof.email}</TableCell>
                  <TableCell>
                    <Select
                      value={prof.papel}
                      onValueChange={(v: PapelDb) => alterarPapel(prof.id, v)}
                      disabled={prof.email === currentEmail}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAPEL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirModalEditar(prof)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Você não pode alterar o próprio papel para evitar perder acesso de administrador.
      </p>

      <Dialog open={modalAberto} onOpenChange={(o) => !o && fecharModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Profissional</DialogTitle>
            <DialogDescription>Altere os dados do profissional</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Papel</label>
              <Select value={formPapel} onValueChange={(v: PapelDb) => setFormPapel(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAPEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => editarMutation.mutate()}
              disabled={!formNome.trim() || editarMutation.isPending}
            >
              {editarMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
