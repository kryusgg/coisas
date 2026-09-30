"use client"

import { useState, useRef } from 'react'
import Link from 'next/link'
import { salvarItemEstoque } from './actions/estoque'

export default function FormularioEstoque({ itemEdit }: { itemEdit: any }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [imagemBase64, setImagemBase64] = useState<string>(itemEdit?.imagem || '')
  const [loading, setLoading] = useState(false)

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setImagemBase64(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const clientAction = async (formData: FormData) => {
    setLoading(true)
    formData.append('imagem', imagemBase64)
    await salvarItemEstoque(formData)
    alert(itemEdit ? '✅ Item atualizado com sucesso!' : '✅ Item adicionado ao estoque!')
    
    if (!itemEdit) {
      formRef.current?.reset()
      setImagemBase64('')
    }
    setLoading(false)
  }

  return (
    <aside className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-teal-100 h-fit">
      <h2 className="text-xl font-bold mb-6 text-teal-800 flex items-center gap-2">
        {itemEdit ? '✏️ Editar Item' : '📦 Novo Item no Estoque'}
      </h2>

      <form ref={formRef} action={clientAction} className="flex flex-col gap-4 text-sm">
        {itemEdit && <input type="hidden" name="id" value={itemEdit.id} />}

        <div className="border-2 border-dashed border-teal-200 rounded-xl p-4 text-center bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer relative">
          {imagemBase64 ? (
             <img src={imagemBase64} alt="Preview" className="mx-auto h-32 object-cover rounded shadow-sm" />
          ) : (
             <div className="py-4 text-teal-700 font-semibold flex flex-col items-center gap-2">
                <span className="text-2xl">📷</span>
                Clique para adicionar foto
             </div>
          )}
          <input type="file" accept="image/*" onChange={handleImage} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        </div>

        <div>
          <label className="block mb-1 font-bold text-gray-700">Nome do Produto / Insumo</label>
          <input type="text" name="nome" required defaultValue={itemEdit?.nome || ''} className="border border-gray-300 p-3 w-full rounded-lg outline-none focus:border-teal-500" placeholder="Ex: Farinha de Trigo Rosa Branca" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-bold text-gray-700">Categoria</label>
            <select name="categoria" defaultValue={itemEdit?.categoria || 'Insumos'} className="border border-gray-300 p-3 w-full rounded-lg outline-none focus:border-teal-500">
              <option value="Insumos">🧈 Insumos</option>
              <option value="Embalagens">📦 Embalagens</option>
              <option value="Adesivos">🏷️ Adesivos/Tags</option>
              <option value="Produtos Prontos">🍫 Produtos Prontos</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 font-bold text-gray-700">Quantidade e Unid.</label>
            <div className="flex gap-2">
              <input type="number" name="quantidade" step="0.01" required min="0" defaultValue={itemEdit?.quantidade || ''} className="border border-gray-300 p-3 w-full rounded-lg outline-none focus:border-teal-500 font-bold text-teal-700" placeholder="Ex: 5" />
              <select name="unidade" defaultValue={itemEdit?.unidade || 'un'} className="border border-gray-300 p-3 rounded-lg outline-none focus:border-teal-500 bg-gray-50 font-bold">
                <option value="un">un</option>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="L">L</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={loading} className="p-4 rounded-lg font-black text-white flex-1 transition-colors shadow-sm bg-teal-600 hover:bg-teal-700">
            {loading ? 'A processar...' : (itemEdit ? 'Salvar Edição' : 'Adicionar ao Estoque')}
          </button>
          
          {itemEdit && (
            <Link href="?ws=estoque" className="p-4 rounded-lg font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 flex-1 text-center">
              Cancelar
            </Link>
          )}
        </div>
      </form>
    </aside>
  )
}