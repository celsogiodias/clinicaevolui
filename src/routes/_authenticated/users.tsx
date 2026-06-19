import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../integrations/supabase/client'
import { inviteProfessional, updateProfessional, deleteProfessional } from '../../lib/admin-users.server'
import type { Database } from '../../integrations/supabase/types'
import { toast } from 'sonner'
import { Loader2, Users, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'

type AppRole = Database['public']['Enums']['app_role']

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador(a)',
  psicologo: 'Psicólogo(a)',
  profissional: 'Profissional',
  administrativo: 'Administrativo',
}

const roleBadgeStyles: Record<AppRole, string> = {
  admin: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  psicologo: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  profissional: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  administrativo: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100',
}

type UserRow = {
  user_id: string
  full_name: string | null
  email: string | null
  role: AppRole
  created_at: string
}

type ProfessionalForm = {
  email: string
  fullName: string
  role: AppRole
}

const DEFAULT_CREATE_FORM: ProfessionalForm = {
  email: '',
  fullName: '',
  role: 'profissional',
}

export const Route = createFileRoute('/_authenticated/users')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
    if (!data) throw redirect({ to: '/dashboard' })
  },
  component: UsersPage,
})

function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalCreate, setModalCreate] = useState(false)
  const [modalEdit, setModalEdit] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null })
  const [modalDelete, setModalDelete] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null })
  const [submitting, setSubmitting] = useState(false)
  const [createForm, setCreateForm] = useState<ProfessionalForm>(DEFAULT_CREATE_FORM)
  const [editForm, setEditForm] = useState<ProfessionalForm>(DEFAULT_CREATE_FORM)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
    loadCurrentUser()
  }, [])

  async function loadCurrentUser() {
    const { data } = await supabase.auth.getUser()
    setCurrentUserId(data.user?.id ?? null)
  }

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_users_with_roles')
    if (error) {
      toast.error('Erro ao carregar profissionais: ' + error.message)
      setUsers([])
    } else {
      setUsers((data as UserRow[]) || [])
    }
    setLoading(false)
  }

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase()
    return (
      (user.full_name || '').toLowerCase().includes(term) ||
      (user.email || '').toLowerCase().includes(term)
    )
  })

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.fullName.trim() || !createForm.email.trim() || !createForm.role) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    if (!isValidEmail(createForm.email.trim())) {
      toast.error('Informe um e-mail válido.')
      return
    }
    const emailExists = users.some((u) =>
      (u.email || '').toLowerCase() === createForm.email.trim().toLowerCase()
    )
    if (emailExists) {
      toast.error('Já existe um profissional com este e-mail.')
      return
    }
    setSubmitting(true)
    try {
      const result = await inviteProfessional({
        data: {
          email: createForm.email.trim(),
          fullName: createForm.fullName.trim(),
          role: createForm.role,
        },
      })
      if (result.success) {
        toast.success('Convite enviado com sucesso!')
        setCreateForm(DEFAULT_CREATE_FORM)
        setModalCreate(false)
        await loadUsers()
      } else {
        toast.error(result.message || 'Erro ao convidar profissional')
      }
    } catch (err: any) {
      toast.error('Erro ao convidar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault()
    if (!modalEdit.user) return
    if (!editForm.fullName.trim() || !editForm.role) {
      toast.error('Preencha todos os campos.')
      return
    }
    setSubmitting(true)
    try {
      const result = await updateProfessional({
        data: {
          userId: modalEdit.user.user_id,
          data: {
            fullName: editForm.fullName.trim(),
            role: editForm.role,
          },
        },
      })
      if (result.success) {
        toast.success('Profissional atualizado com sucesso!')
        setModalEdit({ open: false, user: null })
        await loadUsers()
      } else {
        toast.error(result.message || 'Erro ao atualizar profissional')
      }
    } catch (err: any) {
      toast.error('Erro ao editar: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteUser() {
    if (!modalDelete.user) return
    if (modalDelete.user.user_id === currentUserId) {
      toast.error('Você não pode excluir a própria conta.')
      return
    }
    setSubmitting(true)
    try {
      const result = await deleteProfessional({
        data: { userId: modalDelete.user.user_id },
      })
      if (result.success) {
        toast.success('Profissional excluído com sucesso.')
        setModalDelete({ open: false, user: null })
        await loadUsers()
      } else {
        toast.error(result.message || 'Erro ao excluir profissional')
      }
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err?.message || 'Erro desconhecido'))
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(user: UserRow) {
    setEditForm({
      email: user.email || '',
      fullName: user.full_name || '',
      role: user.role,
    })
    setModalEdit({ open: true, user })
  }

  function openDelete(user: UserRow) {
    setModalDelete({ open: true, user })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Gestão de Profissionais</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Cadastre, edite e gerencie os profissionais da clínica
          </p>
        </div>

        <Dialog open={modalCreate} onOpenChange={setModalCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Profissional
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Convidar Profissional</DialogTitle>
              <DialogDescription>Ele receberá um e-mail com as instruções de acesso.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" placeholder="Digite o nome completo" value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="profissional@clinica.com" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="createRole">Papel</Label>
                <Select value={createForm.role} onValueChange={(value: AppRole) => setCreateForm({ ...createForm, role: value })}>
                  <SelectTrigger id="createRole">
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="psicologo">Psicólogo(a)</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalCreate(false)} disabled={submitting}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Convidar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou e-mail..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="bg-card rounded-xl border">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchTerm ? 'Nenhum profissional encontrado para esta busca.' : 'Nenhum profissional cadastrado.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const isSelf = user.user_id === currentUserId
                return (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                          {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground">{user.email || 'Sem e-mail'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={roleBadgeStyles[user.role]} variant="outline">
                        {roleLabels[user.role]}
                      </Badge>
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDelete(user)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Você não pode alterar o próprio papel para evitar perder acesso de administrador.
      </p>

      <Dialog open={modalEdit.open} onOpenChange={(open) => setModalEdit({ open, user: open ? modalEdit.user : null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Profissional</DialogTitle>
            <DialogDescription>Atualize os dados do profissional.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Nome completo</Label>
              <Input id="editName" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={editForm.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">Papel</Label>
              <Select value={editForm.role} onValueChange={(value: AppRole) => setEditForm({ ...editForm, role: value })}>
                <SelectTrigger id="editRole"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador(a)</SelectItem>
                  <SelectItem value="psicologo">Psicólogo(a)</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalEdit({ open: false, user: null })} disabled={submitting}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modalDelete.open} onOpenChange={(open) => setModalDelete({ open, user: open ? modalDelete.user : null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Profissional</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{modalDelete.user?.full_name || modalDelete.user?.email}</strong>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {modalDelete.user?.user_id === currentUserId && (
            <p className="text-sm text-destructive font-medium">Você não pode excluir a própria conta.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalDelete({ open: false, user: null })} disabled={submitting}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={handleDeleteUser} disabled={submitting || modalDelete.user?.user_id === currentUserId}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
