import { streamText } from "ai"
import { buildSystemPrompt, generateComponentMessage } from "./utils"
import {
  DesignProcessingWorkflowContext,
  GenerateProcessingWorkflowContext,
} from "../../type"
import { ComponentDesign } from "../design-component/utils"

export const generateComponent = async (
  context: DesignProcessingWorkflowContext,
): Promise<GenerateProcessingWorkflowContext> => {
  context.stream.write("🚀 Starting RAG-enhanced code generation...\n")

  let completion = ""
  
  // 获取RAG组件数据（如果可用）
  const designTask = context.state?.designTask as ComponentDesign
  const ragComponents = designTask?.ragComponents
  const ragConfidence = designTask?.ragConfidence

  if (ragComponents && ragComponents.length > 0) {
    context.stream.write(`✨ Using ${ragComponents.length} RAG-selected components (confidence: ${(ragConfidence || 0 * 100).toFixed(1)}%)\n`)
    
    // 显示将要使用的组件
    ragComponents.forEach((comp: any) => {
      context.stream.write(`   • ${comp.componentName} from ${comp.packageName}\n`)
    })
  }

  const systemPrompt = buildSystemPrompt(
    context.query.rules,
    context.state?.designTask?.retrievedAugmentationContent,
    ragComponents // 传递RAG组件数据
  )

  console.log("generate-component RAG-enhanced systemPrompt:", systemPrompt)

  const messages = generateComponentMessage(context)

  const stream = await streamText({
    system: systemPrompt,
    model: context.query.aiModel,
    messages,
  })

  context.stream.write("🎨 Generating component code with accurate package names...\n")

  for await (const part of stream.textStream) {
    try {
      process.stdout.write(part || "")
      const chunk = part || ""
      completion += chunk
      context.stream.write(chunk)
    } catch (e) {
      console.error(e)
    }
  }

  context.stream.write("\n✅ RAG-enhanced code generation completed!\n\n")

  return {
    ...context,
    state: {
      ...context.state,
      generatedCode: completion,
    },
  }
}
