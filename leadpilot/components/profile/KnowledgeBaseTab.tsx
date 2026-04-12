"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, FileType, Globe, Upload, Trash2, ChevronDown, ChevronRight, CheckCircle2, Plus, Zap, Eye } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type FileCategory = 'PDF' | 'WORD' | 'LINK'
type ParseStatus  = 'PENDING' | 'PARSING' | 'READY' | 'FAILED'

interface DocumentChunk { id: string; index: number; content: string; tokenCount: number }
interface KBFile {
  id: string; name: string; category: FileCategory; status: ParseStatus
  chunkCount: number; fileSizeBytes?: number; vectorizedAt?: string
  sourceUrl?: string; progress?: number; chunks?: DocumentChunk[]
}

const CAT = {
  PDF:  { label:'PDF 手册',  Icon:FileText, color:'#ef4444', bg:'rgba(239,68,68,0.12)',  accept:'.pdf' },
  WORD: { label:'Word 文档', Icon:FileType, color:'#3b82f6', bg:'rgba(59,130,246,0.12)', accept:'.doc,.docx' },
  LINK: { label:'网站链接',  Icon:Globe,    color:'#10b981', bg:'rgba(16,185,129,0.12)', accept:'' },
} as const

const STA = {
  PENDING:{ label:'等待解析', cls:'text-slate-400',  dot:'bg-slate-500' },
  PARSING:{ label:'解析中',   cls:'text-blue-400',   dot:'bg-blue-400 animate-pulse' },
  READY:  { label:'已就绪',   cls:'text-emerald-400',dot:'bg-emerald-400' },
  FAILED: { label:'失败',     cls:'text-red-400',    dot:'bg-red-400' },
} as const

const INIT: KBFile[] = [
  { id:'1', name:'Product_Catalog_2024.pdf', category:'PDF', status:'READY', chunkCount:4,
    fileSizeBytes:2_340_000, vectorizedAt:'2024-03-10 14:23',
    chunks:[
      {id:'c1',index:0,tokenCount:58,content:'公司简介：LeadPilot 精密零部件有限公司成立于2008年，专注于高精度机械零部件制造，拥有ISO9001、ISO14001双认证，年产能超过500万件。'},
      {id:'c2',index:1,tokenCount:72,content:'核心产品线：精密轴承系列（LP-B200~LP-B800）、液压缸配件（密封圈/活塞杆）、定制齿轮组件。支持MOQ 50件，15-30天交货。'},
      {id:'c3',index:2,tokenCount:61,content:'质量认证：三坐标测量仪（CMM）精度检测，公差±0.005mm，提供完整材质证书（MTC）和检测报告。'},
      {id:'c4',index:3,tokenCount:55,content:'付款条款：T/T 30%预付，余款提单前付清。支持LC at sight。FOB 深圳。'},
    ]},
  { id:'2', name:'欧洲定价方案_Q1.docx', category:'WORD', status:'READY', chunkCount:2,
    fileSizeBytes:890_000, vectorizedAt:'2024-03-09 09:11',
    chunks:[
      {id:'c5',index:0,tokenCount:68,content:'Q1 欧洲参考报价（内部，对外需加利润后销售确认）：精密轴承 LP-B200: EUR 12.5/件（MOQ 100），液压密封圈套装: EUR 8.9/套（MOQ 200）'},
      {id:'c6',index:1,tokenCount:63,content:'竞争力分析：相较欧洲本地供应商价格优势15-25%。主要竞品：SKF、FAG。差异化：交货期短、小批量定制。'},
    ]},
]

const fmtB = (b?:number) => !b?'—':b<1048576?`${(b/1024).toFixed(1)}KB`:`${(b/1048576).toFixed(1)}MB`

export function KnowledgeBaseTab() {
  const [files,setFiles]       = useState<KBFile[]>(INIT)
  const [link,setLink]         = useState('')
  const [drag,setDrag]         = useState(false)
  const [expanded,setExpanded] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const totalChunks = files.filter(f=>f.status==='READY').reduce((a,f)=>a+f.chunkCount,0)
  const toggle = (id:string) => setExpanded(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })

  const simulateUpload = (name:string, cat:FileCategory, sourceUrl?:string, size?:number) => {
    const id=`f-${Date.now()}`
    setFiles(p=>[...p,{id,name,category:cat,status:'PENDING',chunkCount:0,fileSizeBytes:size,sourceUrl,progress:0}])
    setTimeout(()=>{
      setFiles(p=>p.map(f=>f.id===id?{...f,status:'PARSING'}:f))
      let pct=0
      const iv=setInterval(()=>{
        pct+=Math.floor(Math.random()*20)+8
        if(pct>=100){
          clearInterval(iv)
          const cc=Math.floor(Math.random()*5)+2
          const chunks:DocumentChunk[]=Array.from({length:cc},(_,i)=>({
            id:`${id}-c${i}`,index:i,tokenCount:Math.floor(Math.random()*60)+30,
            content:`【切片 ${i+1}】从「${name}」自动提取的语义段落（生产环境显示真实文本）。`,
          }))
          setFiles(p=>p.map(f=>f.id===id?{...f,status:'READY',chunkCount:cc,progress:100,vectorizedAt:new Date().toLocaleString('zh-CN'),chunks}:f))
          toast({title:'✅ 解析完成',description:`已切分为 ${cc} 个语义块`})
        } else { setFiles(p=>p.map(f=>f.id===id?{...f,progress:pct}:f)) }
      },300)
    },500)
  }

  const handleFile=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0];if(!f)return
    if(f.size>10*1024*1024){toast({title:'文件超过 10MB',variant:'destructive'});return}
    simulateUpload(f.name,'PDF',undefined,f.size);e.target.value=''
  }
  const handleDrop=(e:React.DragEvent)=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files?.[0];if(f)simulateUpload(f.name,'PDF',undefined,f.size)}
  const handleLink=()=>{
    if(!link.trim())return
    try{new URL(link)}catch{toast({title:'请输入有效网址',variant:'destructive'});return}
    simulateUpload(link,'LINK',link);setLink('')
  }
  const handleDelete=(id:string,name:string)=>{
    setFiles(p=>p.filter(f=>f.id!==id))
    setExpanded(p=>{const n=new Set(p);n.delete(id);return n})
    toast({title:`已删除「${name}」`})
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'文档总数',value:files.length,Icon:FileText,color:'#3b82f6'},
          {label:'已就绪',value:files.filter(f=>f.status==='READY').length,Icon:CheckCircle2,color:'#10b981'},
          {label:'语义切片',value:totalChunks,Icon:Zap,color:'#f97316'},
        ].map(s=>(
          <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:`${s.color}20`}}>
              <s.Icon className="w-5 h-5" style={{color:s.color}}/>
            </div>
            <div><div className="text-xl font-bold">{s.value}</div><div className="text-xs text-slate-500">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* 上传区 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-400"/>上传资料
        </h3>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFile} className="hidden"/>
        <div
          onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={handleDrop}
          onClick={()=>fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4 ${
            drag?'border-blue-500 bg-blue-500/10':'border-slate-700 hover:border-slate-500'
          }`}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-slate-500"/>
          <p className="text-sm text-slate-400">拖拽 PDF / Word 到此处，或点击上传</p>
          <p className="text-xs text-slate-600 mt-1">最大 10MB</p>
        </div>
        <div className="flex gap-2">
          <input type="url" value={link} onChange={e=>setLink(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleLink()} placeholder="https://your-website.com"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button onClick={handleLink} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-1">
            <Plus className="w-4 h-4"/>添加链接
          </button>
        </div>
      </div>

      {/* 文档列表 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <Eye className="w-4 h-4 text-purple-400"/>
          <h3 className="font-semibold text-white">已上传文档 · 白盒切片查看</h3>
          <span className="ml-auto text-xs text-slate-500">{files.length} 个文件</span>
        </div>
        <div className="divide-y divide-slate-800/60">
          <AnimatePresence>
            {files.length===0?(
              <div className="text-center py-12 text-slate-600">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30"/>
                <p className="text-sm">暂无文档，请上传</p>
              </div>
            ):files.map(file=>{
              const isExp=expanded.has(file.id)
              const Ic=CAT[file.category].Icon
              return(
                <motion.div key={file.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
                  {/* 文件行 */}
                  <div className="flex items-center gap-3 px-5 py-4 hover:bg-slate-800/30 transition-all">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:CAT[file.category].bg}}>
                      <Ic className="w-4 h-4" style={{color:CAT[file.category].color}}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{file.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${STA[file.status].dot}`}/>
                          <span className={`text-xs ${STA[file.status].cls}`}>{STA[file.status].label}</span>
                        </div>
                        <span className="text-xs text-slate-600">{fmtB(file.fileSizeBytes)}</span>
                        {file.status==='READY'&&<span className="text-xs text-slate-600">{file.chunkCount} 个切片</span>}
                        {file.vectorizedAt&&<span className="text-xs text-slate-700">向量化 {file.vectorizedAt}</span>}
                      </div>
                      {/* 解析进度条 */}
                      {file.status==='PARSING'&&(
                        <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden w-full">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{width:`${file.progress||0}%`}}/>
                        </div>
                      )}
                    </div>
                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {file.status==='READY'&&(
                        <button onClick={()=>toggle(file.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs transition-all"
                        >
                          {isExp?<ChevronDown className="w-3 h-3"/>:<ChevronRight className="w-3 h-3"/>}
                          查看切片
                        </button>
                      )}
                      <button onClick={()=>handleDelete(file.id,file.name)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      ><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                  {/* 切片展开区 — 白盒显示 */}
                  <AnimatePresence>
                    {isExp&&file.chunks&&(
                      <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                        <div className="px-5 pb-4 space-y-2">
                          <p className="text-xs text-purple-400 font-semibold mb-3 flex items-center gap-1">
                            <Eye className="w-3 h-3"/>AI 切片内容（{file.chunks.length} 个语义块）</p>
                          {file.chunks.map(chunk=>(
                            <div key={chunk.id} className="bg-slate-950/70 border border-slate-700/50 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-mono text-purple-400">#{chunk.index+1}</span>
                                <span className="text-xs text-slate-600">~{chunk.tokenCount} tokens</span>
                              </div>
                              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
