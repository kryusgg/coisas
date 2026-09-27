export const dynamic = 'force-dynamic';

import { PrismaClient } from '@prisma/client'
import { criarTransacao, liquidarDivida, apagarTransacao, editarTransacao } from './actions/transacao'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function Home({ searchParams }: { searchParams: Promise<{ ws?: string, view?: string, edit?: string }> }) {
  const params = await searchParams
  
  let abaWs = 'PESSOAL'
  if (params.ws === 'doce_metade') abaWs = 'DOCE_METADE'
  if (params.ws === 'emprestimos') abaWs = 'EMPRESTIMO'
  
  let visaoAtual = 'resumo'
  if (params.view === 'extrato') visaoAtual = 'extrato'
  if (params.view === 'casal') visaoAtual = 'casal'

  const workspaces = await prisma.workspace.findMany()
  const workspaceAtivo = workspaces.find(w => w.tipo === abaWs) || workspaces[0]

  const transacoes = await prisma.transaction.findMany({
    where: { workspace_id: workspaceAtivo?.id },
    orderBy: { data: 'desc' }
  })

  // Identifica se estamos a editar alguma transação (baseado no clique do botão)
  const transacaoEdit = params.edit ? transacoes.find(t => t.id === params.edit) : null

  const mesAtual = new Date().getMonth()
  const anoAtual = new Date().getFullYear()
  const transacoesMes = transacoes.filter(t => t.data.getMonth() === mesAtual && t.data.getFullYear() === anoAtual)

  const totalReceitas = transacoesMes.filter(t => t.tipo === 'RECEITA').reduce((acc, t) => acc + t.valor, 0)
  const totalDespesas = transacoesMes.filter(t => t.tipo === 'DESPESA').reduce((acc, t) => acc + t.valor, 0)
  const saldoFinal = totalReceitas - totalDespesas

  // Lógica do Gráfico de Pizza
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

  // Motor Acerto Casal
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
        
        {/* FORMULÁRIO DINÂMICO (CRIAÇÃO OU EDIÇÃO) */}
        <aside className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
            {transacaoEdit ? (
              <span className="text-blue-600">✏️ Editar Lançamento</span>
            ) : (
              <span>{abaWs === 'EMPRESTIMO' ? 'Novo Empréstimo' : 'Novo Lançamento'}</span>
            )}
          </h2>

          <form action={transacaoEdit ? editarTransacao : criarTransacao} className="flex flex-col gap-4 text-sm">
            <input type="hidden" name="workspace_id" value={workspaceAtivo?.id || ''} />
            {transacaoEdit && <input type="hidden" name="id" value={transacaoEdit.id} />}

            <div>
              <label className="block mb-1 font-semibold">
                {abaWs === 'EMPRESTIMO' ? 'Nome de Quem Pegou Emprestado' : 'Descrição'}
              </label>
              <input type="text" name="descricao" required defaultValue={transacaoEdit?.descricao || ''} className="border p-2 w-full rounded" placeholder="O que foi?" />
            </div>
            
            <div>
              <label className="block mb-1 font-semibold">Categoria / Identificação</label>
              {/* @ts-ignore */}
              <select name="categoria" defaultValue={transacaoEdit?.categoria || 'Outros'} className="border p-2 w-full rounded bg-white">
                {abaWs === 'PESSOAL' ? (
                  <>
                    <option value="Alimentação">🛒 Alimentação / Mercado</option>
                    <option value="Casa">🏠 Casa / Contas</option>
                    <option value="Transporte">🚗 Transporte / Combustível</option>
                    <option value="Saúde">⚕️ Saúde</option>
                    <option value="Lazer">🍿 Lazer / Restaurante</option>
                    <option value="Compras">🛍️ Compras</option>
                    <option value="Outros">Outros</option>
                  </>
                ) : abaWs === 'DOCE_METADE' ? (
                  <>
                    <option value="Insumos">🧈 Insumos / Ingredientes</option>
                    <option value="Embalagens">📦 Embalagens</option>
                    <option value="Equipamentos">🍳 Equipamentos</option>
                    <option value="Marketing">📱 Marketing / Anúncios</option>
                    <option value="Entregas">🛵 Entregas</option>
                    <option value="Vendas">💰 Vendas (Receita)</option>
                    <option value="Outros">Outros</option>
                  </>
                ) : (
                  <>
                    <option value="EmprestimoFeito">💸 Dinheiro Emprestado (Saída)</option>
                    <option value="Recebimento">✅ Dinheiro Recebido de Volta (Entrada)</option>
                  </>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-semibold">Valor (R$)</label>
                <input type="number" step="0.01" name="valor" required defaultValue={transacaoEdit?.valor || ''} className="border p-2 w-full rounded" placeholder="0.00" />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Tipo</label>
                <select name="tipo" defaultValue={transacaoEdit?.tipo || 'DESPESA'} className="border p-2 w-full rounded">
                  <option value="DESPESA">{abaWs === 'EMPRESTIMO' ? 'Emprestado (Saiu)' : 'Despesa'}</option>
                  <option value="RECEITA">{abaWs === 'EMPRESTIMO' ? 'Recebido de Volta' : 'Receita'}</option>
                  {abaWs === 'PESSOAL' && <option value="ACERTO">Acerto / PIX</option>}
                </select>
              </div>
            </div>

            {/* Oculta os cartões na edição para não bagunçar parcelas futuras */}
            {!transacaoEdit && (
              <div className="p-3 border rounded bg-gray-50">
                <input type="checkbox" name="usar_cartao" id="usar_cartao" className="peer w-4 h-4 float-left mr-2 mt-1 cursor-pointer" />
                <label htmlFor="usar_cartao" className="cursor-pointer font-bold block">Foi no Cartão?</label>
                <div className="clear-both"></div>
                <div className="hidden peer-checked:block mt-3 pt-3 border-t">
                  <label className="block mb-1 text-xs">Parcelas</label>
                  <input type="number" name="parcelas" min="1" defaultValue="1" className="border p-1 w-full rounded" />
                </div>
              </div>
            )}

            {abaWs === 'PESSOAL' && (
              <div className="p-3 border border-blue-100 rounded bg-blue-50">
                <input type="checkbox" name="compartilhado" id="compartilhado" defaultChecked={transacaoEdit?.compartilhado || false} className="peer w-4 h-4 float-left mr-2 mt-1 cursor-pointer" />
                <label htmlFor="compartilhado" className="cursor-pointer font-bold text-blue-900 block">Dividir conta/Acerto?</label>
                <div className="clear-both"></div>
                <div className="hidden peer-checked:block mt-3 pt-3 border-t border-blue-200">
                   <label className="block mb-1 text-xs text-blue-800">Quem pagou?</label>
                   <select name="pago_por" defaultValue={transacaoEdit?.pago_por || 'Marcos'} className="border border-blue-200 p-1 w-full rounded">
                     <option value="Marcos">Marcos</option>
                     <option value="Sthe">Sthe</option>
                   </select>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <button type="submit" className={`p-3 rounded font-bold text-white flex-1 transition-colors ${transacaoEdit ? 'bg-blue-600 hover:bg-blue-700' : (abaWs === 'PESSOAL' ? 'bg-blue-600 hover:bg-blue-700' : (abaWs === 'DOCE_METADE' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-purple-600 hover:bg-purple-700'))}`}>
                {transacaoEdit ? 'Salvar Edição' : 'Registrar'}
              </button>
              
              {transacaoEdit && (
                <Link href={`?ws=${params.ws || 'pessoal'}&view=${params.view || 'extrato'}`} className="p-3 rounded font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 flex-1 text-center">
                  Cancelar
                </Link>
              )}
            </div>
          </form>
        </aside>

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
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="p-4">Data</th>
                    <th className="p-4">Descrição</th>
                    <th className="p-4 text-right">Valor</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transacoes.length === 0 ? (
                     <tr><td colSpan={4} className="p-4 text-center text-gray-500">Nenhum registo encontrado.</td></tr>
                  ) : (
                    transacoes.map((t) => (
                      <tr key={t.id} className={`hover:bg-gray-50 ${t.id === params.edit ? 'bg-blue-50' : ''}`}>
                        <td className="p-4 text-gray-500">{t.data.toLocaleDateString('pt-BR')}</td>
                        <td className="p-4 font-semibold">
                          {t.descricao}
                          {/* @ts-ignore */}
                          <span className="block text-xs font-normal text-gray-400">{t.categoria || 'Outros'}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.compartilhado && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">👫 {t.pago_por}</span>}
                            {t.cartao_id && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">💳 {t.parcela_atual ? `${t.parcela_atual}/${t.total_parcelas}` : ''}</span>}
                          </div>
                        </td>
                        <td className={`p-4 text-right font-bold ${t.tipo === 'ACERTO' ? 'text-purple-600' : (t.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600')}`}>
                          {t.tipo === 'RECEITA' ? '+' : (t.tipo === 'ACERTO' ? '↔' : '-')} R$ {t.valor.toFixed(2)}
                        </td>
                        <td className="p-4 text-center w-48">
                          
                          <div className="flex justify-center items-center gap-2">
                            {/* BOTÃO EDITAR */}
                            <Link href={`?ws=${params.ws || 'pessoal'}&view=extrato&edit=${t.id}`} className="text-blue-600 hover:text-blue-800 font-bold bg-blue-100 px-3 py-1.5 rounded transition-colors" title="Editar">
                              ✏️
                            </Link>

                            {/* EXCLUSÃO PROTEGIDA POR SENHA */}
                            <form action={apagarTransacao} className="flex gap-1 items-center bg-red-50 p-1 rounded border border-red-100">
                              <input type="hidden" name="id" value={t.id} />
                              <input type="password" name="senha" placeholder="Senha" required className="w-16 px-1.5 py-1 text-xs border border-red-200 rounded bg-white outline-none focus:border-red-500" title="Digite a senha (1234) para apagar" />
                              <button type="submit" className="text-red-500 hover:text-red-700 font-bold px-2 py-1" title="Excluir">X</button>
                            </form>
                          </div>

                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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