'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function registrarFechamentoDiario(formData: FormData) {
  const faturamento = parseFloat(formData.get('faturamento') as string)
  const dataString = formData.get('data') as string

  if (!faturamento || faturamento <= 0) return { error: "Valor inválido" }

  let dataFechamento = new Date()
  if (dataString) {
    const [ano, mes, dia] = dataString.split('-')
    dataFechamento = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0)
  }

  const CUSTO_CARRO = 32.00
  const caixaInsumos = faturamento * 0.50
  
  const resto = faturamento - caixaInsumos - CUSTO_CARRO
  const lucroLimpo = resto > 0 ? resto : 0
  
  const proLabore = lucroLimpo * 0.60
  const lucroEmpresa = lucroLimpo * 0.40

  try {
    await prisma.fechamentoDoceMetade.create({
      data: {
        data_fechamento: dataFechamento,
        faturamento_total: faturamento,
        caixa_insumos: caixaInsumos,
        custo_carro: CUSTO_CARRO,
        lucro_limpo: lucroLimpo,
        pro_labore_casal: proLabore,
        lucro_empresa: lucroEmpresa
      }
    })

    const atualizarCaixinha = async (nome: string, valor: number) => {
      await prisma.caixinhaVirtual.upsert({
        where: { nome: nome },
        update: { saldo_atual: { increment: valor } },
        create: { nome: nome, saldo_atual: valor },
      })
    }

    await atualizarCaixinha("INSUMOS", caixaInsumos)
    await atualizarCaixinha("CARRO", CUSTO_CARRO)
    await atualizarCaixinha("PRO_LABORE", proLabore)
    await atualizarCaixinha("EMPRESA", lucroEmpresa)

    const workspaceDoceMetade = await prisma.workspace.findFirst({ where: { tipo: 'DOCE_METADE' }})
    if (workspaceDoceMetade) {
      await prisma.transaction.create({
        data: {
          descricao: "Fechamento Diário de Vendas",
          valor: faturamento,
          data: dataFechamento,
          tipo: "RECEITA",
          categoria: "Vendas",
          status: "PAGO",
          workspace_id: workspaceDoceMetade.id,
          compartilhado: false
        }
      })
    }

    revalidatePath('/')
    return { success: true }
    
  } catch (error) {
    console.error(error)
    return { error: "Erro ao registrar fechamento" }
  }
}

// NOVA FUNÇÃO: Zera a caixinha após o saque/transferência
export async function zerarCaixinha(formData: FormData) {
  const nome = formData.get('nome') as string;
  try {
    await prisma.caixinhaVirtual.update({
      where: { nome: nome },
      data: { saldo_atual: 0 }
    });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Erro ao zerar caixinha" };
  }
}