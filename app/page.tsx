export const dynamic = 'force-dynamic';

import { PrismaClient } from '@prisma/client'
import Formulario from './Formulario'
import { apagarVariasTransacoes, liquidarDivida } from './actions/transacao'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function Home({ searchParams }: { searchParams: Promise<{ ws?: string, view?: string, edit?: string, mode?: string }> }) {
  const params = await searchParams
  
  let abaWs = 'PESSOAL'
  if (params.ws === 'doce_metade') abaWs = 'DOCE_METADE'
  if (params.ws === 'emprestimos') abaWs = 'EMPRESTIMO'
  
  let visaoAtual = 'resumo'
  if (params.view === 'extrato') visaoAtual = 'extrato'
  if (params.view === 'casal') visaoAtual = 'casal'

  // Verifica se o Modo de Edição está ativo na URL
  const isEditMode = params.mode === 'edit'

  const workspaces = await prisma.workspace.findMany()
  const workspaceAtivo = workspaces.find(w => w.tipo === abaWs) || workspaces[0]

  const transacoes = await prisma.transaction.findMany({
    where: { workspace_id: workspaceAtivo?.id },
    orderBy: { data: 'desc' }
  })

  const transacaoEdit = params.edit ? transacoes.find(t => t.id === params.edit) : null

  const mesAtual = new Date().getMonth()
  const anoAtual = new Date().getFullYear()
  const transacoesMes = transacoes.filter(t => t.data.getMonth() === mesAtual && t.data.getFullYear() === anoAtual)

  const totalReceitas = transacoesMes.filter(t => t.tipo === 'RECEITA').reduce((acc, t) => acc + t.valor, 0)
  const totalDespesas = transacoesMes.filter(t => t.tipo === 'DESPESA').reduce((acc, t) => acc + t.valor, 0)
  const saldoFinal = totalReceitas - totalDespesas

  const despesasMes = transacoesMes.filter(t => t.tipo === 'DESPESA' && t.valor > 0)
  const coresPizza = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1']
  
  let categoriasAgrupadas: any[] = []
  let conicGradient = 'conic-gradient(#e5e7eb 0% 100%)'

  if (totalDespesas > 0) {
    const mapaCat = new Map()
    despesasMes.forEach(t => {
      // @ts-ignore
      const cat = t.categoria || 'Outros'
      mapaCat.set(cat, (mapaCat.get(cat) || 0) + t.valor)
    })
    
    categoriasAgrupadas = Array.from(mapaCat.entries())
      .map(([nome, valor], index) => ({
        nome, valor, percentual: (valor / totalDespesas) * 100, cor: coresPizza[index % coresPizza.length]
      }))
      .sort((a, b) => b.valor - a.valor)

    let acumulado = 0
    const stops = categoriasAgrupadas.map(c => {
      const inicio = acumulado
      acumulado += c.percentual
      return `${c.cor} ${inicio}% ${acumulado}%`
    }).join(', ')
    conicGradient = `conic-gradient(${stops})`
  }

  let totalMarcos = 0
  let totalSthe = 0
  let acertosMarcos = 0
  let acertosSthe = 0

  transacoesMes.forEach(t => {
    if (t.compartilhado) {
      if (t.tipo === 'DESPESA') {
        if (t.pago_por === 'Marcos') totalMarcos += t.valor
        if (t.pago_por === 'Sthe') totalSthe += t.valor
      } else if (t.tipo === 'ACERTO') {
        if (t.pago_por === 'Marcos') acertosMarcos += t.valor
        if (t.pago_por === 'Sthe') acertosSthe += t.valor
      }
    }
  })
  
  const totalCompartilhado = totalMarcos + totalSthe
  const cotaCadaUm = totalCompartilhado / 2
  let saldoMarcos = (totalMarcos - cotaCadaUm) + acertosMarcos - acertosSthe
  
  let mensagemAcerto = "Tudo quite neste mês! 🍻"
  let estiloAcerto = "bg-green-50 text-green-800 border-green-200"
  let devedor = null
  let valorDevido = 0

  if (saldoMarcos < -0.01) {
    valorDevido = Math.abs(saldoMarcos)
    mensagemAcerto = `Marcos deve transferir R$ ${valorDevido.toFixed(2)} à Sthe`
    estiloAcerto = "bg-red-50 text-red-800 border-red-200"
    devedor = 'Marcos'
  } else if (saldoMarcos > 0.01) {
    valorDevido = saldoMarcos
    mensagemAcerto = `Sthe deve transferir R$ ${valorDevido.toFixed(2)} ao Marcos`
    estiloAcerto = "bg-orange-50 text-orange-800 border-orange-200"
    devedor = 'Sthe'
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-12">
      
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex gap-4">
          <Link href="?ws=pessoal&view=resumo" className={`px-4 py-2 rounded-lg font-bold transition-colors ${abaWs === 'PESSOAL' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            🏡 Vida Pessoal
          </Link>
          <Link href="?ws=doce_metade&view=resumo" className={`px-4 py-2 rounded-lg font-bold transition-colors ${abaWs === 'DOCE_METADE' ? 'bg-pink-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            🧁 Doce Metade
          </Link>
          <Link href="?ws=emprestimos&view=resumo" className={`px-4 py-2 rounded-lg font-bold transition-colors ${abaWs === 'EMPRESTIMO' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            🤝 Empréstimos a Terceiros
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <Formulario key={transacaoEdit?.id || abaWs} abaWs={abaWs} workspaceAtivo={workspaceAtivo} transacaoEdit={transacaoEdit} params={params} />

        <section className="lg:col-span-2">
          
          <div className="flex gap-2 mb-6 border-b pb-2">
            <Link href={`?ws=${params.ws || 'pessoal'}&view=resumo`} className={`px-4 py-2 rounded font-semibold text-sm ${visaoAtual === 'resumo' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
              📊 Resumo
            </Link>
            <Link href={`?ws=${params.ws || 'pessoal'}&view=extrato`} className={`px-4 py-2 rounded font-semibold text-sm ${visaoAtual === 'extrato' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
              📝 Extrato Completo
            </Link>
            {abaWs === 'PESSOAL' && (
              <Link href={`?ws=${params.ws || 'pessoal'}&view=casal`} className={`px-4 py-2 rounded font-semibold text-sm ${visaoAtual === 'casal' ? 'bg-orange-600 text-white' : 'text-orange-500 hover:bg-orange-100'}`}>
                👫 Detalhes do Casal
              </Link>
            )}
          </div>

          {visaoAtual === 'resumo' && (
            <div className="space-y-6">
               <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-gray-500 text-sm font-bold">{abaWs === 'EMPRESTIMO' ? 'Total Recebido' : 'Entradas'}</p>
                  <p className="text-2xl font-black text-green-600">R$ {totalReceitas.toFixed(2)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-gray-500 text-sm font-bold">{abaWs === 'EMPRESTIMO' ? 'Total Emprestado' : 'Saídas'}</p>
                  <p className="text-2xl font-black text-red-600">R$ {totalDespesas.toFixed(2)}</p>
                </div>
                <div className={`p-5 rounded-xl border shadow-sm ${saldoFinal >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-sm font-bold opacity-80">
                    {abaWs === 'PESSOAL' ? 'Saldo Sobrante' : (abaWs === 'DOCE_METADE' ? 'Lucro do Mês' : 'Saldo Pendente')}
                  </p>
                  <p className="text-2xl font-black">R$ {saldoFinal.toFixed(2)}</p>
                </div>
              </div>

              {abaWs !== 'EMPRESTIMO' && (
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-8 items-center">
                  <div className="w-48 h-48 rounded-full shadow-inner border border-gray-200 flex-shrink-0" style={{ background: conicGradient }}></div>
                  <div className="flex-1 w-full">
                    <h3 className="font-bold text-lg mb-4 text-gray-800">Despesas por Categoria</h3>
                    {categoriasAgrupadas.length === 0 ? (
                      <p className="text-gray-400 text-sm">Ainda não há despesas neste mês.</p>
                    ) : (
                      <ul className="space-y-2">
                        {categoriasAgrupadas.map(c => (
                          <li key={c.nome} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor }}></span>
                              <span className="font-medium text-gray-700">{c.nome}</span>
                            </div>
                            <div className="flex gap-4">
                              <span className="text-gray-500 w-12 text-right">{c.percentual.toFixed(0)}%</span>
                              <span className="font-bold w-20 text-right">R$ {c.valor.toFixed(2)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {abaWs === 'PESSOAL' && (
                <div className={`p-5 border rounded-xl shadow-sm ${estiloAcerto}`}>
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2">⚖️ Acerto de Casal</h3>
                  <p className="text-sm opacity-80 mb-2">Total partilhado: R$ {totalCompartilhado.toFixed(2)}</p>
                  <p className="text-xl font-black mb-4">{mensagemAcerto}</p>
                  {devedor && (
                    <form action={liquidarDivida}>
                      <input type="hidden" name="workspace_id" value={workspaceAtivo?.id} />
                      <input type="hidden" name="devedor" value={devedor} />
                      <input type="hidden" name="valor" value={valorDevido} />
                      <button type="submit" className="bg-white text-black font-bold px-4 py-2 rounded shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors flex items-center gap-2 text-sm">
                        💸 Fazer Acerto de R$ {valorDevido.toFixed(2)} Agora
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {visaoAtual === 'extrato' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              
              <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Lançamentos Registados</h3>
                <Link href={`?ws=${params.ws || 'pessoal'}&view=extrato${isEditMode ? '' : '&mode=edit'}`} className={`px-4 py-2 rounded text-sm font-bold transition-colors shadow-sm ${isEditMode ? 'bg-gray-800 text-white hover:bg-black' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200'}`}>
                  {isEditMode ? 'Sair do Modo Edição' : '✏️ Ativar Modo Edição'}
                </Link>
              </div>

              <form action={apagarVariasTransacoes}>
                
                {isEditMode && (
                  <div className="bg-red-50 p-3 flex justify-between items-center border-b border-red-200">
                    <span className="text-sm font-bold text-red-800 flex items-center gap-2">
                      <span>🗑️</span> Marque os itens abaixo para excluir
                    </span>
                    <div className="flex gap-2">
                      <input type="password" name="senha" placeholder="Digite a Senha" required className="px-3 py-1.5 text-sm border border-red-300 rounded bg-white outline-none focus:border-red-500 w-32 shadow-inner" />
                      <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded font-bold text-sm shadow-sm transition-colors">
                        Excluir Selecionados
                      </button>
                    </div>
                  </div>
                )}

                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      {isEditMode && <th className="p-4 w-12 text-center">✅</th>}
                      <th className="p-4">Data</th>
                      <th className="p-4">Descrição</th>
                      <th className="p-4 text-right">Valor</th>
                      {isEditMode && <th className="p-4 text-center">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transacoes.length === 0 ? (
                       <tr><td colSpan={isEditMode ? 5 : 4} className="p-4 text-center text-gray-500">Nenhum registo encontrado.</td></tr>
                    ) : (
                      transacoes.map((t) => (
                        <tr key={t.id} className={`hover:bg-gray-50 ${t.id === params.edit ? 'bg-blue-50' : ''}`}>
                          
                          {isEditMode && (
                            <td className="p-4 text-center border-r border-gray-100">
                              <input type="checkbox" name="ids" value={t.id} className="w-4 h-4 cursor-pointer accent-red-600" />
                            </td>
                          )}

                          <td className="p-4">
                            <div className="flex items-center gap-2 font-semibold">
                              {/* BOLINHA COM A COR DO LOTE */}
                              {t.cor_grupo && (
                                <div className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: t.cor_grupo }} title="Itens comprados juntos"></div>
                              )}
                              <span>{t.descricao}</span>
                            </div>
                            {/* @ts-ignore */}
                            <span className="block text-xs font-normal text-gray-400 mt-1">
                              {/* @ts-ignore */}
                              {t.categoria || 'Outros'} {t.lugar ? ` • 📍 ${t.lugar}` : ''}
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {t.compartilhado && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">👫 {t.pago_por}</span>}
                              {t.cartao_id && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">💳 {t.parcela_atual ? `${t.parcela_atual}/${t.total_parcelas}` : ''}</span>}
                            </div>
                          </td>
                          
                          {isEditMode && (
                            <td className="p-4 text-center w-24">
                              <Link href={`?ws=${params.ws || 'pessoal'}&view=extrato&mode=edit&edit=${t.id}`} className="text-blue-600 hover:text-blue-800 font-bold bg-blue-100 px-4 py-2 rounded transition-colors inline-block shadow-sm" title="Modificar Item">
                                ✏️
                              </Link>
                            </td>
                          )}

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </form>
            </div>
          )}

          {visaoAtual === 'casal' && (
            <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200 overflow-hidden p-6">
              <h3 className="font-bold text-lg text-orange-900 mb-4">Lançamentos Partilhados (Mês Atual)</h3>
              <ul className="space-y-3">
                {transacoesMes.filter(t => t.compartilhado).length === 0 ? (
                  <p className="text-orange-700 opacity-80">Nenhum gasto partilhado neste mês.</p>
                ) : (
                  transacoesMes.filter(t => t.compartilhado).map(t => (
                    <li key={t.id} className="bg-white p-3 rounded shadow-sm flex justify-between border border-orange-100 items-center">
                      <div>
                        <span className="block font-semibold">{t.descricao}</span>
                        <span className="text-xs text-gray-500">{t.data.toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="text-right">
                        <span className="block font-bold">R$ {t.valor.toFixed(2)}</span>
                        <span className="text-xs text-orange-600 font-normal">pago por {t.pago_por}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

        </section>
      </div>
    </main>
  )
}