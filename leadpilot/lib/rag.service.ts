/**
 * RAG (Retrieval-Augmented Generation) 核心服务
 *
 * 流水线：
 *   文档二进制流 → 文本提取 → 语义切片 → 向量化 → 写入数据库
 *
 * 依赖：
 *   pdf-parse   — PDF 文本提取
 *   mammoth     — .docx 文本提取
 *   @langchain/textsplitters — RecursiveCharacterTextSplitter
 *
 * 环境变量：
 *   ZHIPU_API_KEY   — 智谱 AI Embedding API Key（GLM Embedding）
 *   EMBEDDING_API_KEY — 通用兜底 key（DeepSeek / 其他）
 */

import mammoth from 'mammoth'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { prisma } from '@/lib/prisma'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

// ─── 切片配置 ────────────────────────────────────────────────────────────────
const CHUNK_SIZE    = 500
const CHUNK_OVERLAP = 50

// ─── 类型定义 ────────────────────────────────────────────────────────────────
export interface RagChunk {
  content:    string
  tokenCount: number
  embedding?: number[] // 预留：向量维度取决于所选模型
}

export interface RagProcessResult {
  chunks:     RagChunk[]
  chunkCount: number
  rawText:    string
}

// ─── 1. 文档解析：二进制 → 纯文本 ───────────────────────────────────────────
export async function extractText(
  buffer: Buffer,
  fileExt: string, // '.pdf' | '.doc' | '.docx'
): Promise<string> {
  const ext = fileExt.toLowerCase()

  if (ext === '.pdf') {
    try {
      const result = await pdfParse(buffer)
      if (!result.text?.trim()) throw new Error('PDF 内容为空或为扫描件（无法提取文字）')
      return result.text.trim()
    } catch (err: any) {
      throw new Error(`PDF 解析失败：${err.message}`)
    }
  }

  if (ext === '.docx' || ext === '.doc') {
    try {
      const result = await mammoth.extractRawText({ buffer })
      if (!result.value?.trim()) throw new Error('Word 文档内容为空')
      return result.value.trim()
    } catch (err: any) {
      throw new Error(`Word 解析失败：${err.message}`)
    }
  }

  throw new Error(`不支持的文件格式：${ext}`)
}

// ─── 2. 智能切片：纯文本 → 语义块数组 ───────────────────────────────────────
export async function splitIntoChunks(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize:    CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators:   ['\n\n', '\n', '。', '！', '？', '；', ' ', ''],
  })
  const docs = await splitter.createDocuments([text])
  return docs.map(d => d.pageContent.trim()).filter(c => c.length > 0)
}

// ─── 3. 向量化（Embedding）────────────────────────────────────────────────────
// 目前对接智谱 AI (GLM-4 Embedding)；可替换为 DeepSeek / OpenAI 兼容接口。
// 如果 API Key 未配置，返回 undefined（跳过向量化，仅做文本切片入库）。
export async function embedChunks(
  chunks: string[],
): Promise<(number[] | undefined)[]> {
  const apiKey = process.env.ZHIPU_API_KEY || process.env.EMBEDDING_API_KEY
  if (!apiKey) {
    console.warn('[RAG] 未配置 ZHIPU_API_KEY / EMBEDDING_API_KEY，跳过向量化')
    return chunks.map(() => undefined)
  }

  const results: (number[] | undefined)[] = []

  // 智谱 AI Embedding 接口（批量，每次最多 25 条）
  const BATCH_SIZE = 25
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'embedding-3',
          input: batch,
        }),
      })

      if (!res.ok) {
        const errBody = await res.text()
        console.error(`[RAG] Embedding API 错误 (batch ${i / BATCH_SIZE + 1}):`, errBody)
        batch.forEach(() => results.push(undefined))
        continue
      }

      const data = await res.json()
      // 智谱返回格式: { data: [{ embedding: number[] }, ...] }
      const embeddings: number[][] = data.data.map((d: any) => d.embedding)
      embeddings.forEach(e => results.push(e))
    } catch (err: any) {
      console.error(`[RAG] Embedding 请求失败 (batch ${i / BATCH_SIZE + 1}):`, err.message)
      batch.forEach(() => results.push(undefined))
    }
  }

  return results
}

// ─── 4. 向量存储预留接口 ─────────────────────────────────────────────────────
// TODO: 生产环境替换为 Zilliz Cloud (Milvus) SDK 或 pgvector 扩展写入。
// 目前将向量序列化为 JSON 字符串存入 DocumentChunk.embedding 字段。
async function storeEmbedding(
  chunkId:   string,
  embedding: number[] | undefined,
): Promise<void> {
  if (!embedding) return
  await prisma.documentChunk.update({
    where: { id: chunkId },
    data:  { embedding: JSON.stringify(embedding) },
  })
}

// ─── 5. 主流水线：全自动处理一个知识库文件 ──────────────────────────────────
/**
 * processKnowledgeBase
 * @param knowledgeBaseId  Prisma KnowledgeBase 记录 ID
 * @param buffer           文件二进制内容
 * @param fileExt          文件后缀（.pdf / .doc / .docx）
 *
 * 处理成功 → parseStatus = READY，写入真实 chunkCount
 * 处理失败 → parseStatus = FAILED，打印错误
 */
export async function processKnowledgeBase(
  knowledgeBaseId: string,
  buffer:          Buffer,
  fileExt:         string,
): Promise<void> {
  try {
    // Step 1: 解析文本
    const rawText = await extractText(buffer, fileExt)

    // Step 2: 切片
    const chunkTexts = await splitIntoChunks(rawText)
    if (chunkTexts.length === 0) {
      throw new Error('文档切片结果为空，可能内容太短或全为图片')
    }

    // Step 3: 向量化（异步，不阻塞写库）
    const embeddings = await embedChunks(chunkTexts)

    // Step 4: 批量写入 DocumentChunk
    const now = new Date()
    const createdChunks = await prisma.$transaction(
      chunkTexts.map((content, index) =>
        prisma.documentChunk.create({
          data: {
            knowledgeBaseId,
            content,
            chunkIndex:  index,
            tokenCount:  Math.ceil(content.length / 2.5), // 粗估中文 token 数
            embedding:   embeddings[index] ? JSON.stringify(embeddings[index]) : null,
            createdAt:   now,
          },
        })
      )
    )

    // Step 5: 更新 KnowledgeBase 状态为 READY
    await prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: {
        parseStatus:  'READY',
        chunkCount:   createdChunks.length,
        vectorizedAt: now,
      },
    })

    console.log(`[RAG] ✅ 知识库 ${knowledgeBaseId} 处理完成：${createdChunks.length} 个切片`)
  } catch (err: any) {
    console.error(`[RAG] ❌ 知识库 ${knowledgeBaseId} 处理失败：`, err.message)
    // 将状态标记为 FAILED，前端可感知
    await prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data:  { parseStatus: 'FAILED' },
    }).catch(() => {}) // 忽略二次错误
  }
}
