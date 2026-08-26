import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/RouteGuards'
import { SplashScreen } from '@/pages/auth/Splash'
import { Login } from '@/pages/auth/Login'
import { Cadastro } from '@/pages/auth/Cadastro'
import { RecuperarSenha } from '@/pages/auth/RecuperarSenha'
import { AtualizarSenha } from '@/pages/auth/AtualizarSenha'
import { Dashboard } from '@/pages/app/Dashboard'
import { Clientes } from '@/pages/app/Clientes'
import { NovoCliente } from '@/pages/app/NovoCliente'
import { EditarCliente } from '@/pages/app/EditarCliente'
import { PerfilCliente } from '@/pages/app/PerfilCliente'
import { Emprestimos } from '@/pages/app/Emprestimos'
import { NovoEmprestimo } from '@/pages/app/NovoEmprestimo'
import { NovoEmprestimoSelecionar } from '@/pages/app/NovoEmprestimoSelecionar'
import { NovoClienteRapido } from '@/pages/app/NovoClienteRapido'
import { DetalheEmprestimo } from '@/pages/app/DetalheEmprestimo'
import { Pagamento } from '@/pages/app/Pagamento'
import { Renovacao } from '@/pages/app/Renovacao'
import { Receber } from '@/pages/app/Receber'
import { Relatorios } from '@/pages/app/Relatorios'
import { Simulador } from '@/pages/app/Simulador'
import { Configuracoes } from '@/pages/app/Configuracoes'
import { MeuPerfil } from '@/pages/app/MeuPerfil'
import { AlterarSenha } from '@/pages/app/AlterarSenha'
import { Planos } from '@/pages/app/Planos'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/splash" element={<SplashScreen />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        </Route>

        <Route path="/atualizar-senha" element={<AtualizarSenha />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/novo" element={<NovoCliente />} />
            <Route path="/clientes/:id" element={<PerfilCliente />} />
            <Route path="/clientes/:id/editar" element={<EditarCliente />} />
            <Route path="/emprestimos" element={<Emprestimos />} />
            <Route path="/emprestimos/novo" element={<NovoEmprestimoSelecionar />} />
            <Route path="/emprestimos/novo/novo-cliente" element={<NovoClienteRapido />} />
            <Route path="/emprestimos/novo/definir" element={<NovoEmprestimo />} />
            <Route path="/emprestimos/:id" element={<DetalheEmprestimo />} />
            <Route path="/emprestimos/:id/pagamento" element={<Pagamento />} />
            <Route path="/emprestimos/:id/renovar" element={<Renovacao />} />
            <Route path="/receber" element={<Receber />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/simulador" element={<Simulador />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/perfil" element={<MeuPerfil />} />
            <Route path="/alterar-senha" element={<AlterarSenha />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
