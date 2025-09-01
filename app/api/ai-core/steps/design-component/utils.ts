import { streamText, CoreMessage } from "ai"
import { WorkflowContext } from "../../type"
import {
  getPrivateComponentDocs,
  getPrivateDocsDescription,
  getRagEnhancedRule,
} from "../../utils/codegenRules"
import { createRAGService, defaultRAGConfig } from "@/lib/rag/service/rag-service"
import { ComponentDoc } from "@/lib/rag/types"

export interface ComponentDesign {
  componentName: string
  componentDescription: string
  library: Array<{
    name: string
    components: string[]
    description: string
  }>
  retrievedAugmentationContent?: string
  ragComponents?: ComponentDoc[] // RAG检索到的组件
  ragConfidence?: number // RAG检索置信度
}

// buildSystemPrompt function removed - replaced by RAG-enhanced system prompts

/**
 * 构建初始分析的系统提示词
 */
function buildInitialAnalysisPrompt(): string {
  return `
    # You are a senior frontend engineer specializing in component analysis

    ## Goal
    Analyze the user's requirements and extract key information about the component they want to build.
    
    ## Task
    Based on the user's input, provide a detailed analysis including:
    1. Component purpose and functionality
    2. Key features required
    3. UI/UX requirements
    4. Data handling needs
    5. Interaction patterns
    
    ## Response Format
    Provide a concise but comprehensive analysis in plain text (no XML).
    Focus on technical requirements and component characteristics.
  `
}

// When component exists, build corresponding user message and assistant message
const buildCurrentComponentMessage = (
  component: WorkflowContext["query"]["component"],
): Array<CoreMessage> => {
  return component && !component.isInitialized
    ? [
        {
          role: "user",
          content:
            component?.prompt?.map(prompt => {
              if (prompt.type === "image") {
                return { type: "image" as const, image: prompt.image }
              }
              return { type: "text" as const, text: prompt.text }
            }) || [],
        },
        {
          role: "assistant",
          content: `
        - Component name: ${component?.name}
        - Component code:
        ${component?.code}
      `,
        },
      ]
    : []
}

// Build user message
const buildUserMessage = (
  prompt: WorkflowContext["query"]["prompt"],
): Array<CoreMessage> => {
  return [
    {
      role: "user",
      content: prompt.map(p => {
        if (p.type === "image") {
          return { type: "image" as const, image: p.image }
        }
        return { type: "text" as const, text: p.text }
      }),
    },
  ]
}

// get the api of the components in the library
export function getRetrievedAugmentationContent(
  docs: ReturnType<typeof getPrivateComponentDocs>,
  library?: ComponentDesign["library"],
): string {
  if (!library) {
    return ``
  }

  const templates: string[] = []

  for (const param of library) {
    const namespace = param.name
    const componentsList = param?.components
    const components = docs?.[namespace]

    if (components) {
      let componentDescriptions = ""

      for (const componentName of componentsList) {
        const component = components[componentName]
        if (component) {
          componentDescriptions += `
${componentName}: ${component.api}
`
        }
      }

      const template = `
The following content describes the usage of components in the ${namespace} library
---------------------
${componentDescriptions.trim()}
---------------------
`
      templates.push(template.trim())
    }
  }

  return templates.join("\n\n")
}

/**
 * 执行RAG搜索
 */
async function performRAGSearch(
  query: string,
  rules: WorkflowContext["query"]["rules"]
): Promise<{ components: ComponentDoc[], confidence: number } | null> {
  try {
    // 检查是否启用RAG
    const ragConfig = getRagEnhancedRule(rules)
    if (!ragConfig) {
      console.log('RAG not enabled in rules')
      return null
    }

    // 获取环境配置
    const config = {
      ...defaultRAGConfig,
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
      }
    }

    if (!config.openai.apiKey) {
      console.warn('OpenAI API key not configured for RAG search')
      return null
    }

    const sourcePath = process.env.PRIVATE_COMPONENTS_SOURCE_PATH || 
      '/Users/zhangyanhua/Desktop/AI/docs/private-bizcomponent-website/packages/@private-basic-components'

    const ragService = createRAGService(config, sourcePath)
    await ragService.initialize()

    const result = await ragService.searchComponents({
      query,
      topK: ragConfig.searchConfig.topK,
      threshold: ragConfig.searchConfig.threshold,
      filters: ragConfig.searchConfig.filters
    })

    return {
      components: result.components,
      confidence: result.confidence
    }
  } catch (error) {
    console.error('RAG search failed:', error)
    return null
  }
}

/**
 * 构建RAG增强的系统提示词
 */
function buildRAGEnhancedSystemPrompt(
  rules: WorkflowContext["query"]["rules"],
  ragComponents?: ComponentDoc[]
): string {
  const componentsDescription = getPrivateDocsDescription(rules)
  const hasStaticLibraries = !!componentsDescription
  const hasRAGComponents = ragComponents && ragComponents.length > 0

  if (hasRAGComponents) {
    // RAG增强版本
    const ragComponentsList = ragComponents
      .map(comp => `{componentName: ${comp.componentName}, description: ${comp.description}}`)
      .join('\n  ')
    
    const componentNames = ragComponents.map(comp => comp.componentName).sort()

    return `
      # You are a senior frontend engineer specializing in component design analysis
      
      ## Goal  
      Extract the "basic component materials", component name, and description from the analyzed requirements.
      
      ## Available Components (RAG-Enhanced)
      You have access to the following verified components from @private/basic-components:
      ---------------------
      CRITICAL: These components have been intelligently selected for your use case. 
      The package name is "@private/basic-components" (with forward slash, NOT hyphen).
      
      🚨 FORBIDDEN COMPONENT NAMES (DO NOT USE):
      - Icon (doesn't exist - no icon component available)
      - TextInput (doesn't exist - use "Input" instead)
      - TextField (doesn't exist - use "Input" instead)  
      - PrimaryButton (doesn't exist - use "Button" instead)
      - Btn (doesn't exist - use "Button" instead)
      
      🎯 ALLOWED COMPONENT NAMES ONLY:
      ${componentNames.join(', ')}
      
      ⚠️ CRITICAL WARNING: The components listed above are the COMPLETE list of available components.
      NO OTHER COMPONENTS exist in @private/basic-components. 
      DO NOT attempt to use ANY component name not shown in this exact list!
      
      EXACT COMPONENT NAMES TO USE:
      ${ragComponentsList}
      
      🚨 STRICT NAMING REQUIREMENTS:
      - Use ONLY the exact component names listed above
      - DO NOT use variations like "TextInput" - use "Input" instead
      - DO NOT use variations like "PrimaryButton" - use "Button" instead
      - DO NOT create new component names
      ---------------------
      
      ## Instructions
      1. Select ONLY components from the list above that match your requirements
      2. The package name MUST be "@private/basic-components" (exact format)
      3. Component names MUST match exactly as listed
      4. Do not invent or modify component names
      5. If you need a text input field, use "Input" (not TextInput, TextField, etc.)
      6. If you need a button, use "Button" (not Btn, PrimaryButton, etc.)
      7. If you need an icon, DO NOT use "Icon" component - it doesn't exist!
      8. CRITICAL: Never import components that are not in the exact list above
      
      ## Response Format
      <ComponentDesign>
        <ComponentName>Component name</ComponentName>
        <ComponentDescription>Component description</ComponentDescription>
        <Libraries>
          <Library>
            <Name>@private/basic-components</Name>
            <Components>
              <Component>Exact component name from list above</Component>
              <!-- More components as needed -->
            </Components>
            <Description>Describe how each component will be used</Description>
          </Library>
        </Libraries>
      </ComponentDesign>
    `
  }
  
  if (hasStaticLibraries) {
    // 静态文档版本
    return `
      # You are a senior frontend engineer specializing in component design
      
      ## Goal
      Extract the "basic component materials", component name, and description information needed to develop business components from business requirements and design drafts.
      
      ## Constraints
      Basic component materials include:
      ${componentsDescription}
      Please note: You should not provide example code and any other text in your response, only provide XML response.
      
      ## Response Format
      <ComponentDesign>
        <ComponentName>Component name</ComponentName>
        <ComponentDescription>Component description</ComponentDescription>
        <Libraries>
          <Library>
            <Name>Library name</Name>
            <Components>
              <Component>Component name 1</Component>
              <Component>Component name 2</Component>
              <!-- More components as needed -->
            </Components>
            <Description>Describe how each component in components is used in a table format</Description>
          </Library>
          <!-- More libraries as needed -->
        </Libraries>
      </ComponentDesign>
    `
  }

  // 无组件库版本  
  return `
    # You are a senior frontend engineer specializing in component design
    
    ## Goal
    Extract component name and description information needed to develop business components from business requirements and design drafts.
    
    ## Response Format
    <ComponentDesign>
      <ComponentName>Component name</ComponentName>
      <ComponentDescription>Component description that clearly explains the purpose and functionality</ComponentDescription>
    </ComponentDesign>
  `
}

/**
 * 构建RAG上下文消息
 */
function buildRAGContextMessage(components: ComponentDoc[], confidence: number): string {
  return `
    Based on intelligent component analysis (confidence: ${(confidence * 100).toFixed(1)}%), 
    the following components have been identified as highly relevant for your requirements:

    ${components.map(comp => `
    - **${comp.componentName}** (from ${comp.packageName})
      Purpose: ${comp.description}
      Tags: ${comp.tags.join(', ')}
    `).join('')}

    Please select the most appropriate components from this curated list for your component design.
    Remember: The package name is "${components[0]?.packageName}" (exact format required).
  `
}

/**
 * 生成RAG增强的文档内容
 */
function generateRAGAugmentationContent(
  ragComponents: ComponentDoc[],
  selectedLibraries: ComponentDesign['library']
): string {
  const templates: string[] = []

  for (const lib of selectedLibraries) {
    const namespace = lib.name
    const selectedComponents = lib.components

    // 从RAG结果中找到匹配的组件
    const matchingComponents = ragComponents.filter(comp => 
      comp.packageName === namespace && 
      selectedComponents.includes(comp.componentName)
    )

    if (matchingComponents.length > 0) {
      let componentDescriptions = ""

      for (const component of matchingComponents) {
        componentDescriptions += `
${component.componentName}: ${component.api}

Examples:
${component.examples.slice(0, 2).map(example => `\`\`\`tsx\n${example}\n\`\`\``).join('\n')}
`
      }

      const template = `
The following content describes the usage of components in the ${namespace} library
---------------------
CRITICAL: Package name is "${namespace}" (exact format - with forward slash, not hyphen)

${componentDescriptions.trim()}
---------------------
`
      templates.push(template.trim())
    }
  }

  return templates.join("\n\n")
}

/**
 * RAG增强的组件设计生成函数
 */
export async function generateComponentDesign(
  req: WorkflowContext,
): Promise<ComponentDesign> {
  let parserCompletion: ComponentDesign = {
    componentName: "componentName",
    componentDescription: "componentDescription",
    library: [],
  }

  // 1. 首次AI调用：分析用户需求
  req.stream.write("🔍 Analyzing user requirements...\n")
  
  const initialSystemPrompt = buildInitialAnalysisPrompt()
  const messages = [
    ...buildCurrentComponentMessage(req.query.component),
    ...buildUserMessage(req.query.prompt),
  ]

  const initialStream = await streamText({
    system: initialSystemPrompt,
    model: req.query.aiModel,
    messages,
  })

  let initialAnalysis = ""
  for await (const part of initialStream.textStream) {
    initialAnalysis += part || ""
  }

  // 2. RAG检索相关组件
  req.stream.write("🧠 Searching for relevant components using RAG...\n")
  
  const ragResult = await performRAGSearch(initialAnalysis, req.query.rules)
  
  if (ragResult) {
    req.stream.write(`✅ Found ${ragResult.components.length} relevant components (confidence: ${(ragResult.confidence * 100).toFixed(1)}%)\n`)
  } else {
    req.stream.write("⚠️  RAG search failed, falling back to static docs\n")
  }

  // 3. 基于RAG结果的精确设计
  req.stream.write("🎨 Generating precise component design...\n")
  
  const enhancedSystemPrompt = buildRAGEnhancedSystemPrompt(req.query.rules, ragResult?.components)
  
  const finalMessages: CoreMessage[] = [
    ...messages,
    {
      role: "assistant",
      content: `Initial analysis: ${initialAnalysis}`
    },
    {
      role: "user",
      content: ragResult ? buildRAGContextMessage(ragResult.components, ragResult.confidence) : "Proceed with standard component selection."
    }
  ]

  try {
    const stream = await streamText({
      system: enhancedSystemPrompt,
      model: req.query.aiModel,
      messages: finalMessages,
    })

    let accumulatedXml = ""

    for await (const part of stream.textStream) {
      req.stream.write(part)
      accumulatedXml += part
    }

    try {
      if (!accumulatedXml) {
        throw new Error(
          "No response from the AI, please check the providers configuration and the apiKey balance",
        )
      }

      // Try to extract XML from the response
      const xmlMatch = accumulatedXml.match(
        /<ComponentDesign>[\s\S]*<\/ComponentDesign>/,
      )
      if (!xmlMatch) {
        throw new Error("No valid XML found in the response")
      }

      // Import the XML parser from the parser.ts file
      const { transformComponentDesignFromXml } = await import(
        "@/lib/xml-message-parser/parser"
      )

      // Parse the XML
      parserCompletion = transformComponentDesignFromXml(xmlMatch[0])
      
      // 添加RAG相关信息
      if (ragResult) {
        parserCompletion.ragComponents = ragResult.components
        parserCompletion.ragConfidence = ragResult.confidence
      }
      
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as valid XML: ${parseError}`)
    }

    // 生成增强的文档内容
    if (parserCompletion.library.length > 0) {
      if (ragResult && ragResult.components.length > 0) {
        // 使用RAG结果生成文档
        parserCompletion.retrievedAugmentationContent = generateRAGAugmentationContent(
          ragResult.components, 
          parserCompletion.library
        )
      } else {
        // 回退到静态文档
        const docs = getPrivateComponentDocs(req.query.rules)
        parserCompletion.retrievedAugmentationContent =
          getRetrievedAugmentationContent(docs, parserCompletion.library)
      }
    }

    return parserCompletion
  } catch (err: unknown) {
    console.log("err", err)
    if (err instanceof Error) {
      throw err
    }
    throw new Error(String(err))
  }
}
