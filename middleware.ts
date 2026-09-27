import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  
  // O .trim() destrói qualquer espaço em branco ou quebra de linha invisível!
  const adminUser = process.env.ADMIN_USER?.trim()
  const adminPass = process.env.ADMIN_PASS?.trim()

  if (!adminUser || !adminPass) {
      return new NextResponse('Bloqueio de Seguranca: Credenciais nao configuradas.', { status: 500 })
  }

  if (!authHeader) {
    return new NextResponse('Acesso Restrito', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Gestor Privado"' },
    })
  }

  try {
    const authValue = authHeader.split(' ')[1]
    const decodificado = atob(authValue)
    const [providedUser, providedPass] = decodificado.split(':')

    // Comparamos limpando espaços de todos os lados
    if (providedUser.trim() === adminUser && providedPass.trim() === adminPass) {
      return NextResponse.next() 
    }
  } catch (e) {
    // Ignora
  }

  return new NextResponse('Usuário ou senha incorretos.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Gestor Privado"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}