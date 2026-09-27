"use client"

import { useState, useRef } from 'react'
import Link from 'next/link'
import { criarTransacao, editarTransacao } from './actions/transacao'

export default function Formulario({ abaWs, workspaceAtivo, transacaoEdit, params }: any) {
  const formRef = useRef<HTMLFormElement>(null)
  
  // Função para gerar uma cor aleatória bonita
  const gerarCorAleatoria = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
  
  // Estado que guarda a cor escolhida para este lote todo
  const [corGrupo, setCorGrupo] = useState(transacaoEdit?.cor_grupo || gerarCorAleatoria())

  const [itens, setItens] = useState(
    transacaoEdit
      ? [{ id: 1, descricao: transacaoEdit.descricao, lugar: transacaoEdit.lugar || '', categoria: transacaoEdit.categoria, valor: transacaoEdit.valor.toString(), tipo: transacaoEdit.tipo }]
      : [{ id: Date.now(), descricao: '', lugar: '', categoria: 'Outros', valor: '', tipo: 'DESPESA' }]
  )

  const obterDataPadrao = () => {
    if (transacaoEdit && transacaoEdit.data) {
      const d = new Date(transacaoEdit.data)
      return d.toISOString().split('T')[0]
    }
    const hoje = new Date()
    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset())
    return hoje.toISOString().split('T')[0]
  }

  const adicionarItem = () => {
    const primeiroItem = itens[0]; 
    setItens([
      ...itens, 
      { 
        id: Date.now(), 
        descricao: '',                          
        lugar: primeiroItem?.lugar || '',       // Herda o lugar do item 1
        categoria: 'Outros',                    
        valor: '',                              
        tipo: primeiroItem?.tipo || 'DESPESA'   // Herda o tipo do item 1
      }
    ])
  }

  const removerItem = (id: number) => {
    if (itens.length > 1) {
      setItens(itens.filter(i => i.id !== id))
    }
  }

  const atualizarItem = (id: number, campo: string, valor: string) => {
    setItens(itens.map(i => i.id === id ? { ...i, [campo]: valor } : i))
  }

  const clientAction = async (formData: FormData) => {
    // Adiciona a cor escolhida ao formulário antes de enviar
    formData.append('cor_grupo', corGrupo)

    if (transacaoEdit) {
      await editarTransacao(formData)
      alert('✅ Edição salva com sucesso!')
    } else {
      await criarTransacao(formData)
      alert('✅ Lançamento(s) registrado(s) com sucesso!')
      
      // Reseta os itens e gera uma NOVA cor aleatória para a próxima nota
      setItens([{ id: Date.now(), descricao: '', lugar: '', categoria: 'Outros', valor: '', tipo: 'DESPESA' }])
      setCorGrupo(gerarCorAleatoria())
      formRef.current?.reset()
    }
  }

  const totalItens = itens.reduce((acc, item) => acc + (parseFloat(item.valor) || 0), 0)

  return (
    <aside className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
      <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
        {transacaoEdit ? (
          <span className="text-blue-600">✏️ Editar Lançamento</span>
        ) : (
          <span>{abaWs === 'EMPRESTIMO' ? 'Novo Empréstimo' : 'Novo Lançamento'}</span>
        )}
      </h2>

      <form ref={formRef} action={clientAction} className="flex flex-col gap-4 text-sm">
        <input type="hidden" name="workspace_id" value={workspaceAtivo?.id || ''} />
        <input type="hidden" name="itens" value={JSON.stringify(itens)} />
        {transacaoEdit && <input type="hidden" name="id" value={transacaoEdit.id} />}

        {/* NOVA LINHA: DATA E COR DO LOTE */}
        <div className="flex gap-3">
          <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
            <label className="block mb-1 font-bold text-gray-700">📅 Data da Compra</label>
            <input type="date" name="data" required defaultValue={obterDataPadrao()} className="border border-gray-300 p-2 w-full rounded bg-white font-semibold text-gray-700 outline-none focus:border-blue-500 transition-colors" />
          </div>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex flex-col items-center justify-center w-24">
            <label className="block mb-1 font-bold text-gray-700 text-xs text-center leading-tight">Cor da Nota</label>
            <input type="color" value={corGrupo} onChange={(e) => setCorGrupo(e.target.value)} className="w-8 h-8 cursor-pointer rounded border-0 outline-none bg-transparent" title="Cor que agrupará estes itens no extrato" />
          </div>
        </div>

        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 pb-2 mt-2">
          {itens.map((item, index) => (
            <div key={item.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 relative shadow-sm">
              
              {itens.length > 1 && (
                <button type="button" onClick={() => removerItem(item.id)} className="absolute -top-3 -right-3 bg-red-100 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white rounded-full w-7 h-7 flex items-center justify-center font-bold transition-colors" title="Remover item da lista">
                  X
                </button>
              )}
              {itens.length > 1 && <h4 className="font-bold text-gray-500 mb-2 border-b pb-1">Item {index + 1}</h4>}

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block mb-1 font-semibold">{abaWs === 'EMPRESTIMO' ? 'Quem Pegou?' : 'Descrição'}</label>
                  <input type="text" required value={item.descricao} onChange={e => atualizarItem(item.id, 'descricao', e.target.value)} className="border border-gray-300 p-2 w-full rounded bg-white outline-none focus:border-blue-500" placeholder="Ex: Queijo Muçarela" />
                </div>
                <div>
                  <label className="block mb-1 font-semibold">Local (Opcional)</label>
                  <input type="text" value={item.lugar} onChange={e => atualizarItem(item.id, 'lugar', e.target.value)} className="border border-gray-300 p-2 w-full rounded bg-white outline-none focus:border-blue-500" placeholder="Ex: Atacadão" />
                </div>
              </div>

              <div className="mb-3">
                <label className="block mb-1 font-semibold">Categoria</label>
                <select value={item.categoria} onChange={e => atualizarItem(item.id, 'categoria', e.target.value)} className="border border-gray-300 p-2 w-full rounded bg-white outline-none focus:border-blue-500">
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
                  <input type="number" step="0.01" required value={item.valor} onChange={e => atualizarItem(item.id, 'valor', e.target.value)} className="border border-gray-300 p-2 w-full rounded bg-white outline-none focus:border-blue-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block mb-1 font-semibold">Tipo</label>
                  <select value={item.tipo} onChange={e => atualizarItem(item.id, 'tipo', e.target.value)} className="border border-gray-300 p-2 w-full rounded bg-white outline-none focus:border-blue-500">
                    <option value="DESPESA">{abaWs === 'EMPRESTIMO' ? 'Emprestado (Saiu)' : 'Despesa'}</option>
                    <option value="RECEITA">{abaWs === 'EMPRESTIMO' ? 'Recebido de Volta' : 'Receita'}</option>
                    {abaWs === 'PESSOAL' && <option value="ACERTO">Acerto / PIX</option>}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!transacaoEdit && (
          <button type="button" onClick={adicionarItem} className="border-2 border-dashed border-gray-300 p-3 rounded-lg text-gray-600 font-bold hover:bg-gray-100 hover:border-gray-400 transition-colors flex items-center justify-center gap-2">
            <span>➕ Adicionar item à mesma nota</span>
          </button>
        )}

        {!transacaoEdit && (
          <div className="p-3 border rounded bg-gray-50">
            <input type="checkbox" name="usar_cartao" id="usar_cartao" className="peer w-4 h-4 float-left mr-2 mt-1 cursor-pointer" />
            <label htmlFor="usar_cartao" className="cursor-pointer font-bold block">Passou no Cartão?</label>
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
               <label className="block mb-1 text-xs text-blue-800">Quem pagou a nota toda?</label>
               <select name="pago_por" defaultValue={transacaoEdit?.pago_por || 'Marcos'} className="border border-blue-200 p-1 w-full rounded outline-none">
                 <option value="Marcos">Marcos</option>
                 <option value="Sthe">Sthe</option>
               </select>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button type="submit" className={`p-4 rounded font-black text-white flex-1 transition-colors shadow-sm ${transacaoEdit ? 'bg-blue-600 hover:bg-blue-700' : (abaWs === 'PESSOAL' ? 'bg-blue-600 hover:bg-blue-700' : (abaWs === 'DOCE_METADE' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-purple-600 hover:bg-purple-700'))}`}>
            {transacaoEdit ? 'Salvar Edição' : (itens.length > 1 ? `Gravar ${itens.length} Itens (Total: R$ ${totalItens.toFixed(2)})` : 'Registrar')}
          </button>

          {transacaoEdit && (
            <Link href={`?ws=${params.ws || 'pessoal'}&view=${params.view || 'extrato'}`} className="p-4 rounded font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 flex-1 text-center">
              Cancelar
            </Link>
          )}
        </div>
      </form>
    </aside>
  )
}