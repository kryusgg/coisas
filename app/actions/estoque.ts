"use server"

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function salvarItemEstoque(formData: FormData) {
  const id = formData.get('id') as string | null
  const nome = formData.get('nome') as string
  const quantidade = parseFloat(formData.get('quantidade') as string) || 0
  const unidade = formData.get('unidade') as string || 'un'
  const categoria = formData.get('categoria') as string
  const imagem = formData.get('imagem') as string

  if (id) {
    await prisma.estoque.update({
      where: { id },
      data: { nome, quantidade, unidade, categoria, ...(imagem ? { imagem } : {}) }
    })
  } else {
    await prisma.estoque.create({
      data: { nome, quantidade, unidade, categoria, imagem: imagem || null }
    })
  }
  revalidatePath('/')
}

export async function apagarItemEstoque(formData: FormData) {
  const id = formData.get('id') as string
  await prisma.estoque.delete({ where: { id } })
  revalidatePath('/')
}

export async function atualizarQuantidadeEstoque(formData: FormData) {
  const id = formData.get('id') as string;
  const novaQuantidade = parseFloat(formData.get('quantidade') as string);

  if (id && !isNaN(novaQuantidade) && novaQuantidade >= 0) {
    await prisma.estoque.update({
      where: { id },
      data: { quantidade: novaQuantidade }
    });
    revalidatePath('/');
  }
}