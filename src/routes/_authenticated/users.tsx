import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  listarProfissionais,
  criarProfissional,
  atualizarProfissional,
  excluirProfissional,
  type ProfissionalRole,
} from '~/lib/admin-users.server';
import { useUser } from '~/hooks/useUser';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '~/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, UserIcon } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
});

const PAPEL_OPTIONS: { value: ProfissionalRole; label: string }[] = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'psicologo', label: 'Psicólogo(a)' },
  { value: 'profissional', label: 'Profissional' },
  { value: 'administrativo', label: 'Administrativo' },
];

function UsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState<string | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPapel, setFormPapel] = useState<ProfissionalRole>('profissional');
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ['profissionais'],
    queryFn: listarProfissionais,
  });

  const criarMutation = useMutation({
    mutationFn: () =>
      criarProfissional({ nome: formNome, email: formEmail, papel: formPapel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profissionais'] });
      toast.success('Profissional cadastrado com sucesso');
      fecharModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editarMutation = useMutation({
    mutationFn: () =>
      atualizarProfissional(modoEdicao!, {
        nome: formNome,
        email: formEmail,
        papel: formPapel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profissionais'] });
      toast.success('Profissional atualizado com sucesso');
      fecharModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const excluirMutation = useMutation({
    mutationFn: () => excluirProfissional(excluirId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profissionais'] });
      toast.success('Profissional excluído com sucesso');
      setExcluirId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function abrirModalCriar() {
    setModoEdicao(null);
    setFormNome('');
    setFormEmail('');
    setFormPapel('profissional');
    setModalAberto(true);
  }

  function abrirModalEditar(prof: (typeof profissionais)[0]) {
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

  async function alterarPapel(profissionalId: string, novoPapel: ProfissionalRole) {
    try {
      await atualizarProfissional(profissionalId, { papel: novoPapel });
      queryClient.invalidateQueries({ queryKey: ['profissionais'] });
      toast.success('Papel atualizado');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserIcon className="h-6 w-6 text-teal-600" />
            <h1 className="text-2xl font-bold text-gray-900">Gestão de Usuários</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Cadastre, edite e gerencie os profissionais da equipe
          </p>
        </div>
        <Button onClick={abrirModalCriar} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="mr-2 h-4 w-4" />
          Novo Profissional
        </Button>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-medium mb-1">Definição dos papéis:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>Administrador:</strong> acesso total à plataforma</li>
          <li><strong>Psicólogo(a):</strong> acessa prontuários de psicologia</li>
          <li><strong>Profissional:</strong> acessa prontuário multidisciplinar</li>
          <li><strong>Administrativo:</strong> acessa agenda e financeiro</li>
        </ul>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white shadow-sm">
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
                <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : profissionais.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                  Nenhum profissional cadastrado ainda
                </TableCell>
              </TableRow>
            ) : (
              profissionais.map((prof) => (
                <TableRow key={prof.id}>
                  <TableCell className="font-medium">
                    {prof.nome}
                    {prof.email === currentUser?.email && (
                      <span className="ml-2 rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-700">
                        você
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500">{prof.email}</TableCell>
                  <TableCell>
                    <Select
                      value={prof.papel}
                      onValueChange={(val: ProfissionalRole) =>
                        alterarPapel(prof.id, val)
                      }
                      disabled={prof.email === currentUser?.email}
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
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirModalEditar(prof)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExcluirId(prof.id)}
                        disabled={prof.email === currentUser?.email}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400">
        Você não pode alterar o próprio papel ou excluir a si mesmo para evitar
        perder acesso de administrador. Peça a outro administrador para fazer
        essas alterações.
      </p>

      {/* Modal Criar/Editar */}
      <Dialog open={modalAberto} onOpenChange={(open) => !open && fecharModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modoEdicao ? 'Editar Profissional' : 'Novo Profissional'}
            </DialogTitle>
            <DialogDescription>
              {modoEdicao
                ? 'Altere os dados do profissional'
                : 'Preencha os dados para cadastrar um novo profissional'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Nome</label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Papel</label>
              <Select value={formPapel} onValueChange={(val: ProfissionalRole) => setFormPapel(val)}>
                <SelectTrigger>
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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>
              Cancelar
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() =>
                modoEdicao ? editarMutation.mutate() : criarMutation.mutate()
              }
              disabled={
                !formNome.trim() ||
                !formEmail.trim() ||
                criarMutation.isPending ||
                editarMutation.isPending
              }
            >
              {criarMutation.isPending || editarMutation.isPending
                ? 'Salvando...'
                : modoEdicao
                  ? 'Salvar Alterações'
                  : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={!!excluirId} onOpenChange={() => setExcluirId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Profissional</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este profissional? Esta ação não
              pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => excluirMutation.mutate()}
              disabled={excluirMutation.isPending}
            >
              {excluirMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
