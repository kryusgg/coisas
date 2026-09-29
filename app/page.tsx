export const dynamic = 'force-dynamic';

import { PrismaClient } from '@prisma/client'
import Formulario from './Formulario'
import FormularioEstoque from './FormularioEstoque'
import { apagarVariasTransacoes, liquidarDivida } from './actions/transacao'
import { apagarItemEstoque, atualizarQuantidadeEstoque } from './actions/estoque'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function Home({ searchParams }: { searchParams: Promise<{ ws?: string, view?: string, edit?: string, mode?: string }> }) {
  const params = await searchParams
  
  let abaWs = 'PESSOAL'
  if (params.ws === 'doce_metade') abaWs = 'DOCE_METADE'
  if (params.ws === 'emprestimos') abaWs = 'EMPRESTIMO'
  if (params.ws === 'estoque') abaWs = 'ESTOQUE'
  
  let visaoAtual = 'resumo'
  if (params.view === 'extrato') visaoAtual = 'extrato'
  if (params.view === 'casal') visaoAtual = 'casal'

  const isEditMode = params.mode === 'edit'

  // --- LÓGICA DO ESTOQUE ---
  let itensEstoque: any[] = []
  let itemEstoqueEdit = null
  let graficoEstoqueGradient = 'conic-gradient(#e5e7eb 0% 100%)'
  let legendasEstoque: any[] = []

  if (abaWs === 'ESTOQUE') {
    itensEstoque = await prisma.estoque.findMany({ orderBy: { categoria: 'asc' } })
    itemEstoqueEdit = params.edit ? itensEstoque.find(i => i.id === params.edit) : null
    
    const totalItens = itensEstoque.reduce((acc, i) => acc + i.quantidade, 0)
    if (totalItens > 0) {
      const mapaCat = new Map()
      itensEstoque.forEach(i => mapaCat.set(i.categoria, (mapaCat.get(i.categoria) || 0) + i.quantidade))
      
      const coresPizza = ['#0d9488', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6']
      legendasEstoque = Array.from(mapaCat.entries()).map(([nome, qtd], index) => ({
        nome, qtd, percentual: (qtd / totalItens) * 100, cor: coresPizza[index % coresPizza.length]
      })).sort((a, b) => b.qtd - a.qtd)

      let acumulado = 0
      const stops = legendasEstoque.map(c => {
        const inicio = acumulado
        acumulado += c.percentual
        return `${c.cor} ${inicio}% ${acumulado}%`
      }).join(', ')
      graficoEstoqueGradient = `conic-gradient(${stops})`
    }
  }

  // --- LÓGICA FINANCEIRA ---
  let workspaces: any[] = []
  let workspaceAtivo: any = null
  let transacoes: any[] = []
  let transacaoEdit = null
  let totalReceitas = 0, totalDespesas = 0, saldoFinal = 0
  let categoriasAgrupadas: any[] = []
  let conicGradient = 'conic-gradient(#e5e7eb 0% 100%)'
  let totalCompartilhado = 0, cotaCadaUm = 0, saldoMarcos = 0
  let mensagemAcerto = "", estiloAcerto = "", devedor = null, valorDevido = 0
  let gruposDeTransacoes: any[] = []
  let transacoesMes: any[] = []

  if (abaWs !== 'ESTOQUE') {
    workspaces = await prisma.workspace.findMany()
    workspaceAtivo = workspaces.find(w => w.tipo === abaWs) || workspaces[0]

    transacoes = await prisma.transaction.findMany({
      where: { workspace_id: workspaceAtivo?.id },
      orderBy: { data: 'desc' }
    })
    transacaoEdit = params.edit ? transacoes.find(t => t.id === params.edit) : null

    const mesAtual = new Date().getMonth()
    const anoAtual = new Date().getFullYear()
    transacoesMes = transacoes.filter(t => t.data.getMonth() === mesAtual && t.data.getFullYear() === anoAtual)

    totalReceitas = transacoesMes.filter(t => t.tipo === 'RECEITA').reduce((acc, t) => acc + t.valor, 0)
    totalDespesas = transacoesMes.filter(t => t.tipo === 'DESPESA').reduce((acc, t) => acc + t.valor, 0)
    saldoFinal = totalReceitas - totalDespesas

    const despesasMes = transacoesMes.filter(t => t.tipo === 'DESPESA' && t.valor > 0)
    const coresPizza = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1']
    
    if (totalDespesas > 0) {
      const mapaCat = new Map()
      despesasMes.forEach(t => mapaCat.set(t.categoria || 'Outros', (mapaCat.get(t.categoria || 'Outros') || 0) + t.valor))
      
      categoriasAgrupadas = Array.from(mapaCat.entries())
        .map(([nome, valor], index) => ({ nome, valor, percentual: (valor / totalDespesas) * 100, cor: coresPizza[index % coresPizza.length] }))
        .sort((a, b) => b.valor - a.valor)

      let acumulado = 0
      conicGradient = `conic-gradient(${categoriasAgrupadas.map(c => {
        const inicio = acumulado; acumulado += c.percentual; return `${c.cor} ${inicio}\%${acumulado}%`
      }).join(', ')})`
    }

    let totalMarcos = 0, totalSthe = 0, acertosMarcos = 0, acertosSthe = 0
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
    
    totalCompartilhado = totalMarcos + totalSthe
    cotaCadaUm = totalCompartilhado / 2
    saldoMarcos = (totalMarcos - cotaCadaUm) + acertosMarcos - acertosSthe
    
    mensagemAcerto = "Tudo quite neste mês! 🍻"
    estiloAcerto = "bg-green-50 text-green-800 border-green-200"
    if (saldoMarcos < -0.01) {
      valorDevido = Math.abs(saldoMarcos); mensagemAcerto = `Marcos deve transferir R$ ${valorDevido.toFixed(2)} à Sthe`; estiloAcerto = "bg-red-50 text-red-800 border-red-200"; devedor = 'Marcos'
    } else if (saldoMarcos > 0.01) {
      valorDevido = saldoMarcos; mensagemAcerto = `Sthe deve transferir R$ ${valorDevido.toFixed(2)} ao Marcos`; estiloAcerto = "bg-orange-50 text-orange-800 border-orange-200"; devedor = 'Sthe'
    }

    transacoes.forEach(t => {
      const dataStr = t.data.toLocaleDateString('pt-BR');
      let grupo = gruposDeTransacoes.find(g => g.dataStr === dataStr);
      if (!grupo) { grupo = { dataStr, dia: t.data.getDate(), itens: [], totalDia: 0 }; gruposDeTransacoes.push(grupo); }
      grupo.itens.push(t);
      if (t.tipo === 'DESPESA') grupo.totalDia -= t.valor; else if (t.tipo === 'RECEITA') grupo.totalDia += t.valor;
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-12">
      
      <header className="bg-white border-b shadow-sm sticky top-0 z-10 overflow-x-auto">
        <div className="max-w-6xl mx-auto px-6 py-4 flex gap-4 min-w-max">
          <Link href="?ws=pessoal&view=resumo" className={`px-4 py-2 rounded-lg font-bold transition-colors ${abaWs === 'PESSOAL' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            🏡 Vida Pessoal
          </Link>
          <Link href="?ws=doce_metade&view=resumo" className={`px-4 py-2 rounded-lg font-bold transition-colors ${abaWs === 'DOCE_METADE' ? 'bg-pink-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            🧁 Doce Metade
          </Link>
          <Link href="?ws=emprestimos&view=resumo" className={`px-4 py-2 rounded-lg font-bold transition-colors ${abaWs === 'EMPRESTIMO' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            🤝 Empréstimos a Terceiros
          </Link>
          <Link href="?ws=estoque" className={`px-4 py-2 rounded-lg font-bold transition-colors border-2 ml-4 ${abaWs === 'ESTOQUE' ? 'bg-teal-600 text-white border-teal-600' : 'text-teal-700 hover:bg-teal-50 border-teal-200'}`}>
            📦 Controle de Estoque
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {abaWs === 'ESTOQUE' ? (
           <FormularioEstoque itemEdit={itemEstoqueEdit} />
        ) : (
           <Formulario key={transacaoEdit?.id || abaWs} abaWs={abaWs} workspaceAtivo={workspaceAtivo} transacaoEdit={transacaoEdit} params={params} />
        )}

        <section className="lg:col-span-2">
          
          {abaWs === 'ESTOQUE' && (
            <div className="space-y-6">
              
              <div className="bg-white p-6 rounded-xl border border-teal-100 shadow-sm flex flex-col md:flex-row gap-8 items-center mb-8">
                <div className="w-40 h-40 rounded-full shadow-inner border border-gray-200 flex-shrink-0" style={{ background: graficoEstoqueGradient }}></div>
                <div className="flex-1 w-full">
                  <h3 className="font-bold text-lg mb-4 text-teal-900">Distribuição do Estoque (Qtd. de Itens)</h3>
                  {legendasEstoque.length === 0 ? (
                    <p className="text-gray-400 text-sm">O seu estoque está vazio.</p>
                  ) : (
                    <ul className="space-y-2">
                      {legendasEstoque.map(c => (
                        <li key={c.nome} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor }}></span>
                            <span className="font-medium text-gray-700">{c.nome}</span>
                          </div>
                          <div className="flex gap-4">
                            <span className="text-gray-500 w-12 text-right">{c.percentual.toFixed(0)}%</span>
                            <span className="font-bold w-12 text-right text-teal-700">{c.qtd} un</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                <h3 className="font-bold text-xl text-gray-800">Inventário Visual</h3>
                <span className="text-sm font-bold bg-teal-100 text-teal-800 px-3 py-1 rounded-full">{itensEstoque.length} itens registados</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {itensEstoque.map(item => (
                  <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden hover:shadow-md transition-shadow group">
                    
                    <div className="h-40 w-full bg-gray-100 flex items-center justify-center border-b border-gray-100">
                      {item.imagem ? (
                         <img src={item.imagem} alt={item.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                         <span className="text-4xl opacity-20">📦</span>
                      )}
                    </div>
                    
                    <div className="p-4 flex flex-col flex-1">
                      <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded w-fit mb-2">{item.categoria}</span>
                      <h4 className="font-bold text-gray-800 leading-tight mb-4 flex-1">{item.nome}</h4>
                      
                      <div className="flex items-center justify-between mt-auto">
                        
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-400 mb-1">Quantidade</span>
                          <div className="flex items-center gap-1">
                            
                            {/* Botão de - */}
                            <form action={atualizarQuantidadeEstoque}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="quantidade" value={Math.max(0, item.quantidade - 1)} />
                              <button type="submit" className="w-7 h-7 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center shadow-sm transition-colors" title="Diminuir 1">-</button>
                            </form>
                            
                            {/* Input Editável + Botão Salvar Flutuante */}
                            <form action={atualizarQuantidadeEstoque} className="relative flex items-center group/input">
                              <input type="hidden" name="id" value={item.id} />
                              <input 
                                type="number" 
                                name="quantidade" 
                                defaultValue={item.quantidade} 
                                min="0"
                                className="font-black text-xl text-teal-700 w-12 text-center bg-transparent hover:bg-teal-50 focus:bg-teal-50 border-b-2 border-transparent focus:border-teal-400 rounded-t outline-none transition-all cursor-text py-0.5" 
                                title="Clique para digitar um valor"
                              />
                              <button 
                                type="submit" 
                                className="absolute -top-7 left-1/2 -translate-x-1/2 bg-teal-600 text-white font-bold text-[10px] px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-focus-within/input:opacity-100 group-focus-within/input:pointer-events-auto transition-all z-10"
                              >
                                SALVAR
                              </button>
                            </form>
                            
                            {/* Botão de + */}
                            <form action={atualizarQuantidadeEstoque}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="quantidade" value={item.quantidade + 1} />
                              <button type="submit" className="w-7 h-7 rounded-md bg-teal-100 hover:bg-teal-200 text-teal-700 font-bold flex items-center justify-center shadow-sm transition-colors" title="Aumentar 1">+</button>
                            </form>

                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Link href={`?ws=estoque&edit=${item.id}`} className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Editar Informações">
                            ✏️
                          </Link>
                          {/* Botão de apagar CORRIGIDO sem o evento onClick */}
                          <form action={apagarItemEstoque}>
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit" className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 rounded transition-colors" title="Apagar Item">
                              🗑️
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaWs !== 'ESTOQUE' && (
             <>
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
                  <div className="bg-transparent">
                    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 mb-6 flex justify-between items-center">
                      <h3 className="font-bold text-gray-700">Lançamentos Registados</h3>
                      <Link href={`?ws=${params.ws || 'pessoal'}&view=extrato${isEditMode ? '' : '&mode=edit'}`} className={`px-4 py-2 rounded text-sm font-bold transition-colors shadow-sm ${isEditMode ? 'bg-gray-800 text-white hover:bg-black' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200'}`}>
                        {isEditMode ? 'Sair do Modo Edição' : '✏️ Ativar Modo Edição'}
                      </Link>
                    </div>

                    <form action={apagarVariasTransacoes}>
                      {isEditMode && (
                        <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-200 mb-6 flex justify-between items-center sticky top-20 z-20">
                          <span className="text-sm font-bold text-red-800 flex items-center gap-2">
                            <span>🗑️</span> Marque os itens nas listas abaixo para excluir
                          </span>
                          <div className="flex gap-2">
                            <input type="password" name="senha" placeholder="Senha" required className="px-3 py-1.5 text-sm border border-red-300 rounded bg-white outline-none focus:border-red-500 w-32 shadow-inner" />
                            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded font-bold text-sm shadow-sm transition-colors">
                              Excluir Selecionados
                            </button>
                          </div>
                        </div>
                      )}

                      {gruposDeTransacoes.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">Nenhum registo encontrado.</div>
                      ) : (
                        gruposDeTransacoes.map((grupo) => {
                          const hue = grupo.dia * 11.6; 
                          return (
                            <details key={grupo.dataStr} className="group mb-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                              <summary className="p-4 cursor-pointer flex justify-between items-center select-none transition-colors border-b border-gray-100 list-none [&::-webkit-details-marker]:hidden hover:opacity-90" style={{ backgroundColor: `hsl(${hue}, 70%, 96%)`, borderLeft: `6px solid hsl(${hue}, 60%, 55%)` }}>
                                <div className="font-black text-gray-800 flex items-center gap-3">
                                  <span className="text-sm group-open:rotate-90 transition-transform duration-200 inline-block">▶</span>
                                  📅 {grupo.dataStr}
                                </div>
                                <div className="flex items-center gap-4 text-sm font-bold">
                                  <span className="text-gray-500">{grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}</span>
                                  <span className={`bg-white/60 px-3 py-1 rounded-lg border border-black/5 ${grupo.totalDia >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    Total: R$ {Math.abs(grupo.totalDia).toFixed(2)}
                                  </span>
                                </div>
                              </summary>
                              <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50/50 text-gray-400 text-xs uppercase">
                                  <tr>
                                    {isEditMode && <th className="p-3 w-12 text-center">✅</th>}
                                    <th className="p-3 pl-6">Descrição</th>
                                    <th className="p-3 text-right pr-6">Valor</th>
                                    {isEditMode && <th className="p-3 text-center w-24">Ações</th>}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {grupo.itens.map((t: any) => (
                                    <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${t.id === params.edit ? 'bg-blue-50' : ''}`}>
                                      {isEditMode && (
                                        <td className="p-3 text-center border-r border-gray-100">
                                          <input type="checkbox" name="ids" value={t.id} className="w-4 h-4 cursor-pointer accent-red-600" />
                                        </td>
                                      )}
                                      <td className="p-3 pl-6">
                                        <div className="flex items-center gap-2 font-semibold text-gray-800">
                                          {t.cor_grupo && <div className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: t.cor_grupo }} title="Lote específico"></div>}
                                          <span>{t.descricao}</span>
                                        </div>
                                        <span className="block text-xs font-normal text-gray-400 mt-1">
                                          {t.categoria || 'Outros'} {t.lugar ? ` • 📍 ${t.lugar}` : ''}
                                        </span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {t.compartilhado && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs border border-purple-200">👫 {t.pago_por}</span>}
                                          {t.cartao_id && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs border border-orange-200">💳 {t.parcela_atual ? `${t.parcela_atual}/${t.total_parcelas}` : ''}</span>}
                                        </div>
                                      </td>
                                      <td className={`p-3 pr-6 text-right font-bold align-top pt-4 ${t.tipo === 'ACERTO' ? 'text-purple-600' : (t.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600')}`}>
                                        {t.tipo === 'RECEITA' ? '+' : (t.tipo === 'ACERTO' ? '↔' : '-')} R$ {t.valor.toFixed(2)}
                                      </td>
                                      {isEditMode && (
                                        <td className="p-3 text-center align-top pt-3">
                                          <Link href={`?ws=${params.ws || 'pessoal'}&view=extrato&mode=edit&edit=${t.id}`} className="text-blue-600 hover:text-blue-800 font-bold bg-blue-100 px-4 py-2 rounded transition-colors inline-block shadow-sm" title="Modificar Item">
                                            ✏️
                                          </Link>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </details>
                          )
                        })
                      )}
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
             </>
          )}

        </section>
      </div>
    </main>
  )
}