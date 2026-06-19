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
  admin: 'bg-red-100 text-red-800 border-red-200',
  psicologo: 'bg-blue-100 text-blue-800 border-blue-200',
  profissional: 'bg-green-100 text-green-800 border-green-200',
  administrativo: 'bg-purple-100 text-purple-800 border-purple-200',
}

type UserRow = {
  user_id: string
  full_name: string | null
  email: string | null
  role: AppRole
  created_at: string
}

export const Route = createFileRoute('/_authenticated/users')({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
    if (!data) throw redirect({ to: '/dashboard' })
  },
  component: UsersPage,
})

function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ email: '', fullName: '', role: 'profissional' as AppRole })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => { loadUsers(); getMe() }, [])

  async function getMe() {
    const { data } = await supabase.auth.getUser()
    setCurrentUserId(data.user?.id ?? null)
  }

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_users_with_roles')
    if (error) toast.error('Erro: ' + error.message)
    else setUsers((data as UserRow[]) || [])
    setLoading(false)
  }

  const filtered = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fullName.trim() || !form.email.trim()) { toast.error('Preencha todos os campos.'); return }
    setSubmitting(true)
    try {
      const r = await inviteProfessional({ data: { email: form.email.trim(), fullName: form.fullName.trim(), role: form.role } })
      if (r.success) { toast.success('Convidado com sucesso!'); setModalOpen(null); setForm({ email: '', fullName: '', role: 'profissional' }); await loadUsers() }
      else toast.error(r.message || 'Erro')
    } catch { toast.error('Erro ao convidar') } finally { setSubmitting(false) }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser) return
    setSubmitting(true)
    try {
      const r = await updateProfessional({ data: { userId: selectedUser.user_id, data: { fullName: form.fullName.trim(), role: form.role } } })
      if (r.success) { toast.success('Atualizado!'); setModalOpen(null); await loadUsers() }
      else toast.error(r.message || 'Erro')
    } catch { toast.error('Erro ao editar') } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    if (!selectedUser) return
    if (selectedUser.user_id === currentUserId) { toast.error('Não pode excluir a própria conta.'); return }
    setSubmitting(true)
    try {
      const r = await deleteProfessional({ data: { userId: selectedUser.user_id } })
      if (r.success) { toast.success('Excluído!'); setModalOpen(null); await loadUsers() }
      else toast.error(r.message || 'Erro')
    } catch { toast.error('Erro ao excluir') } finally { setSubmitting(false) }
  }

  function openEdit(u: UserRow) { setSelectedUser(u); setForm({ email: u.email || '', fullName: u.full_name || '', role: u.role }); setModalOpen('edit') }
  function openDelete(u: UserRow) { setSelectedUser(u); setModalOpen('delete') }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
          <div><h1 className="text-2xl font-bold">Gestão de Profissionais</h1><p className="text-sm text-muted-foreground">Cadastre, edite e gerencie os profissionais</p></div>
        </div>
        <Dialog open={modalOpen === 'create'} onOpenChange={o => { setModalOpen(o ? 'create' : null); if (!o) setForm({ email: '', fullName: '', role: 'profissional' }) }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Novo Profissional</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Convidar Profissional</DialogTitle><DialogDescription>Ele receberá e-mail com instruções de acesso.</DialogDescription></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label>Nome</Label><Input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} required /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
              <div><Label>Papel</Label>
                <Select value={form.role} onValueChange={(v: AppRole) => setForm({...form, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="psicologo">Psicólogo(a)</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setModalOpen(null)} disabled={submitting}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Convidar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="bg-card rounded-xl border">
        {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : filtered.length === 0 ? <div className="flex flex-col items-center py-12 text-center"><Users className="h-10 w-10 text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground">Nenhum profissional encontrado.</p></div>
        : <Table>
            <TableHeader><TableRow><TableHead>Profissional</TableHead><TableHead>Papel</TableHead><TableHead>Cadastro</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">{(u.full_name || u.email || '?').charAt(0).toUpperCase()}</div>
                      <div><p className="font-medium">{u.full_name || 'Sem nome'}</p><p className="text-sm text-muted-foreground">{u.email}</p></div>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={roleBadgeStyles[u.role]} variant="outline">{roleLabels[u.role]}</Badge>{u.user_id === currentUserId && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openDelete(u)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>}
      </div>

      <p className="text-xs text-muted-foreground">Você não pode alterar o próprio papel para evitar perder acesso de administrador.</p>

      <Dialog open={modalOpen === 'edit'} onOpenChange={o => { setModalOpen(o ? 'edit' : null); if (!o) setSelectedUser(null) }}>
        <DialogContent><DialogHeader><DialogTitle>Editar Profissional</DialogTitle><DialogDescription>Atualize os dados.</DialogDescription></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div><Label>Nome</Label><Input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} required /></div>
            <div><Label>E-mail</Label><Input value={form.email} disabled /></div>
            <div><Label>Papel</Label>
              <Select value={form.role} onValueChange={(v: AppRole) => setForm({...form, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador(a)</SelectItem>
                  <SelectItem value="psicologo">Psicólogo(a)</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setModalOpen(null)} disabled={submitting}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen === 'delete'} onOpenChange={o => { setModalOpen(o ? 'delete' : null); if (!o) setSelectedUser(null) }}>
        <DialogContent><DialogHeader><DialogTitle>Excluir Profissional</DialogTitle><DialogDescription>Tem certeza que deseja excluir <strong>{selectedUser?.full_name || selectedUser?.email}</strong>? Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          {selectedUser?.user_id === currentUserId && <p className="text-sm text-destructive font-medium">Você não pode excluir a própria conta.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(null)} disabled={submitting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting || selectedUser?.user_id === currentUserId}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar Exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
