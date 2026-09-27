import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  
  // Puxa as credenciais seguras (longe do GitHub)
  const adminUser = process.env.ADMIN_USER
  const adminPass = process.env.ADMIN_PASS

  // Trava de segurança: se esquecer de configurar na Vercel, o site tranca!
  if (!adminUser || !adminPass) {
      return new NextResponse('Bloqueio de Seguranca: Credenciais de admin nao configuradas no servidor.', { status: 500 })
  }

  // Se não tem login, pede o login no navegador
  if (!authHeader) {
    return new NextResponse('Acesso Restrito', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Gestor Privado"' },
    })
  }

  try {
    // Descriptografa o login digitado e compara com a sua Variável de Ambiente
    const authValue = authHeader.split(' ')[1]
    const [providedUser, providedPass] = atob(authValue).split(':')

    if (providedUser === adminUser && providedPass === adminPass) {
      return NextResponse.next() // Login correto: deixa o site carregar!
    }
  } catch (e) {
    // Ignora tentativas com caracteres estranhos
  }

  // Login errado: exibe mensagem e pede de novo
  return new NextResponse('Usuário ou senha incorretos.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Gestor Privado"' },
  })
}

// Protege TODAS as rotas do site, exceto arquivos de sistema (imagens, ícones)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}