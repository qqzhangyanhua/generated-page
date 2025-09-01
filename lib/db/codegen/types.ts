export interface CodegenRule {
  type:
    | "public-components"
    | "styles"
    | "private-components"
    | "file-structure"
    | "attention-rules"
    | "rag-enhanced"
  description: string
  prompt?: string // only used when type is "styles" | "file-structure" | "special-attention"
  dataSet?: string[] // only used when type is "public-components"
  docs?: {
    // only used when type is "private-components"
    [libraryName: string]: {
      [componentName: string]: {
        description: string
        api: string
      }
    }
  }
  // RAG-enhanced specific properties
  enabled?: boolean // only used when type is "rag-enhanced"
  vectorStore?: string // only used when type is "rag-enhanced"
  namespace?: string // only used when type is "rag-enhanced"
  searchConfig?: {
    topK?: number
    threshold?: number
    filters?: {
      packageName?: string
    }
  } // only used when type is "rag-enhanced"
}

export interface Codegen {
  title: string
  description: string
  fullStack: "React" | "Vue"
  guides: string[]
  model: string
  codeRendererUrl: string
  rules: CodegenRule[]
}
