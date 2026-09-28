"use server"

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function criarTransacao(formData: FormData) {
  const itensStr = formData.get('itens') as string
  const itens = JSON.parse(itensStr)
  
  const compartilhado = formData.get('compartilhado') === 'on'
  const pago_por = compartilhado ? (formData.get('pago_por') as string) : null
  const cor_grupo = formData.get('cor_grupo') as string
  
  const usarCartao = formData.get('usar_cartao') === 'on'
  const parcelas = parseInt(formData.get('parcelas') as string) || 1
  const workspace_id = formData.get('workspace_id') as string 
  const cartao_id = usarCartao ? '22222222-2222-2222-2222-222222222222' : null

  const dataInput = formData.get('data') as string
  const dataBase = new Date(`${dataInput}T12:00:00`) 

  // CONFIGURAÇÃO DO SEU CARTÃO DE CRÉDITO
  const DIA_FECHAMENTO = 5; 
  const DIA_VENCIMENTO = 10; // <--- Altere aqui para o dia que o seu cartão vence

  let mesBase = dataBase.getMonth();
  const anoBase = dataBase.getFullYear();

  // Se a compra for DEPOIS do dia de fechamento (dia 6 em diante), empurra para a próxima fatura
  if (usarCartao && dataBase.getDate() > DIA_FECHAMENTO) {
      mesBase += 1;
  }

  const currentWs = await prisma.workspace.findUnique({ where: { id: workspace_id } })
  const wsPessoal = await prisma.workspace.findFirst({ where: { tipo: 'PESSOAL' } })
  
  const isDoceMetade = currentWs?.tipo === 'DOCE_METADE'
  const deveClonar = isDoceMetade && compartilhado && wsPessoal

  for (const item of itens) {
    const valorTotal = parseFloat(item.valor);
    if (isNaN(valorTotal) || valorTotal <= 0) continue; 

    if (usarCartao && parcelas > 1) {
      const valorParcela = valorTotal / parcelas
      for (let i = 1; i <= parcelas; i++) {
        // Lança a data da despesa para o dia do VENCIMENTO do cartão
        const dataParcela = new Date(anoBase, mesBase + (i - 1), DIA_VENCIMENTO, 12, 0, 0)
        
        await prisma.transaction.create({
          data: {
            descricao: `${item.descricao} (${i}/${parcelas})`,
            lugar: item.lugar || null, cor_grupo: cor_grupo || null,
            valor: valorParcela, data: dataParcela, tipo: item.tipo, categoria: item.categoria, 
            status: i === 1 ? "PAGO" : "PENDENTE", 
            workspace_id, compartilhado: isDoceMetade ? false : compartilhado, pago_por: isDoceMetade ? null : pago_por, cartao_id, parcela_atual: i, total_parcelas: parcelas
          }
        })

        if (deveClonar) {
           await prisma.transaction.create({
              data: {
                descricao: `🧁 [Doce Metade] ${item.descricao} (${i}/${parcelas})`,
                lugar: item.lugar || null, cor_grupo: cor_grupo || null,
                valor: valorParcela, data: dataParcela, tipo: item.tipo, categoria: item.categoria, 
                status: i === 1 ? "PAGO" : "PENDENTE", 
                workspace_id: wsPessoal!.id, compartilhado: true, pago_por, cartao_id, parcela_atual: i, total_parcelas: parcelas
              }
           })
        }
      }
    } else {
      // Lança a data da despesa para o dia do VENCIMENTO do cartão (ou data atual se for à vista)
      const dataLancamento = usarCartao ? new Date(anoBase, mesBase, DIA_VENCIMENTO, 12, 0, 0) : dataBase;
      
      await prisma.transaction.create({
        data: {
          descricao: item.descricao,
          lugar: item.lugar || null, cor_grupo: cor_grupo || null, 
          valor: valorTotal, data: dataLancamento, tipo: item.tipo, categoria: item.categoria, 
          status: "PAGO", 
          workspace_id, compartilhado: isDoceMetade ? false : compartilhado, pago_por: isDoceMetade ? null : pago_por, cartao_id, parcela_atual: usarCartao ? 1 : null, total_parcelas: usarCartao ? 1 : null
        }
      })

      if (deveClonar) {
         await prisma.transaction.create({
            data: {
              descricao: `🧁 [Doce Metade] ${item.descricao}`,
              lugar: item.lugar || null, cor_grupo: cor_grupo || null,
              valor: valorTotal, data: dataLancamento, tipo: item.tipo, categoria: item.categoria,
              status: "PAGO",
              workspace_id: wsPessoal!.id, compartilhado: true, pago_por, cartao_id, parcela_atual: usarCartao ? 1 : null, total_parcelas: usarCartao ? 1 : null
            }
         })
      }
    }
  }
  revalidatePath('/')
}

export async function editarTransacao(formData: FormData) {
  const id = formData.get('id') as string
  const itensStr = formData.get('itens') as string
  const itens = JSON.parse(itensStr)
  const item = itens[0] 

  const compartilhado = formData.get('compartilhado') === 'on'
  const pago_por = compartilhado ? (formData.get('pago_por') as string) : null
  const cor_grupo = formData.get('cor_grupo') as string 
  
  const dataInput = formData.get('data') as string
  const dataBase = new Date(`${dataInput}T12:00:00`)

  await prisma.transaction.update({
    where: { id },
    data: {
      descricao: item.descricao, lugar: item.lugar || null, cor_grupo: cor_grupo || null,
      valor: parseFloat(item.valor), tipo: item.tipo, categoria: item.categoria, data: dataBase,
      compartilhado, pago_por
    }
  })
  revalidatePath('/')
}

export async function liquidarDivida(formData: FormData) {
  const workspace_id = formData.get('workspace_id') as string
  const devedor = formData.get('devedor') as string
  const valor = parseFloat(formData.get('valor') as string)
  
  await prisma.transaction.create({
    data: {
      descricao: '💸 Pagamento de Acerto (PIX)', valor, data: new Date(), tipo: 'ACERTO', categoria: 'Transferência', status: 'PAGO', workspace_id, compartilhado: true, pago_por: devedor
    }
  })
  revalidatePath('/')
}

export async function apagarTransacao(formData: FormData) {
  const id = formData.get('id') as string
  const senha = formData.get('senha') as string
  if (senha !== '1234') return 
  await prisma.transaction.delete({ where: { id } })
  revalidatePath('/')
}

export async function apagarVariasTransacoes(formData: FormData) {
  const ids = formData.getAll('ids') as string[]
  const senha = formData.get('senha') as string
  if (senha !== '1234' || ids.length === 0) return 
  await prisma.transaction.deleteMany({ where: { id: { in: ids } } })
  revalidatePath('/')
}