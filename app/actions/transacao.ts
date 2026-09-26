"use server"

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function criarTransacao(formData: FormData) {
  const descricao = formData.get('descricao') as string
  const valorTotal = parseFloat(formData.get('valor') as string)
  const tipo = formData.get('tipo') as string
  const categoria = formData.get('categoria') as string || 'Outros' // Captura a categoria
  const compartilhado = formData.get('compartilhado') === 'on'
  const pago_por = compartilhado ? (formData.get('pago_por') as string) : null
  
  const usarCartao = formData.get('usar_cartao') === 'on'
  const parcelas = parseInt(formData.get('parcelas') as string) || 1
  const workspace_id = formData.get('workspace_id') as string 
  const cartao_id = usarCartao ? '22222222-2222-2222-2222-222222222222' : null

  const dataAtual = new Date();
  let mesBase = dataAtual.getMonth();
  const anoBase = dataAtual.getFullYear();

  if (usarCartao && dataAtual.getDate() >= 11) {
      mesBase += 1;
  }

  if (usarCartao && parcelas > 1) {
    const valorParcela = valorTotal / parcelas
    
    for (let i = 1; i <= parcelas; i++) {
      const dataParcela = new Date(anoBase, mesBase + (i - 1), 11)

      await prisma.transaction.create({
        data: {
          descricao: `${descricao} (${i}/${parcelas})`,
          valor: valorParcela,
          data: dataParcela,
          tipo,
          categoria, // Salva no banco
          status: i === 1 ? "PAGO" : "PENDENTE",
          workspace_id,
          compartilhado,
          pago_por,
          cartao_id,
          parcela_atual: i,
          total_parcelas: parcelas
        }
      })
    }
  } else {
    const dataLancamento = usarCartao ? new Date(anoBase, mesBase, 11) : new Date();

    await prisma.transaction.create({
      data: {
        descricao,
        valor: valorTotal,
        data: dataLancamento,
        tipo,
        categoria, // Salva no banco
        status: "PAGO",
        workspace_id,
        compartilhado,
        pago_por,
        cartao_id,
        parcela_atual: usarCartao ? 1 : null,
        total_parcelas: usarCartao ? 1 : null
      }
    })
  }
  revalidatePath('/')
}

export async function liquidarDivida(formData: FormData) {
  const workspace_id = formData.get('workspace_id') as string
  const devedor = formData.get('devedor') as string
  const valor = parseFloat(formData.get('valor') as string)
  
  await prisma.transaction.create({
    data: {
      descricao: '💸 Pagamento de Acerto (PIX)',
      valor: valor,
      data: new Date(),
      tipo: 'ACERTO', 
      categoria: 'Transferência',
      status: 'PAGO',
      workspace_id,
      compartilhado: true,
      pago_por: devedor
    }
  })
  revalidatePath('/')
}

export async function apagarTransacao(formData: FormData) {
  const id = formData.get('id') as string
  await prisma.transaction.delete({ where: { id } })
  revalidatePath('/')
}