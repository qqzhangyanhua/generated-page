import { CoreMessage } from "ai"
import { WorkflowContext } from "../../type"
import {
  getPublicComponentsRule,
  getFileStructureRule,
  getStylesRule,
  getSpecialAttentionRules,
} from "../../utils/codegenRules"
import { ComponentDoc } from "@/lib/rag/types"

// Generate the output specification section
const generateOutputSpecification = (
  rules: WorkflowContext["query"]["rules"],
): string => {
  const fileStructure = getFileStructureRule(rules)
  if (!fileStructure) return ""

  return `
    ## Output Specification
    ${fileStructure}
  `
}

// Generate the style specification section
const generateStyleSpecification = (
  rules: WorkflowContext["query"]["rules"],
): string => {
  const styles = getStylesRule(rules)
  if (!styles) return ""

  return `
    ## Style Specification
    ${styles}
  `
}

// Generate the open source components section
const generateOpenSourceComponents = (
  rules: WorkflowContext["query"]["rules"],
): string => {
  const publicComponents = getPublicComponentsRule(rules)
  if (!publicComponents || publicComponents.length === 0) return ""

  return `
    **Open Source Components**
    - You can use components from ${publicComponents.join(", ")}
    - Use the latest stable version of APIs
  `
}

// Generate the private components section with RAG enhancement
const generatePrivateComponents = (
  retrievedAugmentationContent?: string,
  ragComponents?: ComponentDoc[]
): string => {
  // RAG增强版本 - 如果有RAG组件数据，优先使用
  if (ragComponents && ragComponents.length > 0) {
    const packageNames = Array.from(new Set(ragComponents.map(comp => comp.packageName)))
    const packageName = packageNames[0] // 获取主要包名
    
    // 生成完整的组件名称列表
    const componentNames = ragComponents.map(comp => comp.componentName).sort()
    const componentNamesList = componentNames.join(', ')
    
    return `
    **Private Components (RAG-Enhanced)**
    🔥 CRITICAL PACKAGE NAME REQUIREMENTS:
    - MUST use exact package name: "${packageName}" (with forward slash, NOT hyphen)
    - NEVER use "${packageName.replace('/', '-')}" (incorrect format)
    - Import format: import { ComponentName } from '${packageName}'
    
    **⚠️ ABSOLUTE COMPONENT NAME RESTRICTIONS:**
    - NEVER use "Icon" - it does not exist!
    - NEVER use "TextInput" - it does not exist!
    - NEVER use "TextField" - it does not exist!  
    - NEVER use "PrimaryButton" - it does not exist!
    - NEVER use "Btn" - it does not exist!
    - NEVER use any made-up component names!
    - DO NOT import components that are NOT in the exact list above!
    
    **🎯 EXACT COMPONENT NAMES (USE ONLY THESE):**
    Available components: ${componentNamesList}
    
    ⚠️ CRITICAL WARNING: The components listed above are the COMPLETE list of available components.
    NO OTHER COMPONENTS exist in @private/basic-components. 
    DO NOT attempt to use ANY component name not shown in this exact list!
    
    **Available Components (USE EXACT NAMES):**
    ${ragComponents.map(comp => `
    ✅ **${comp.componentName}** (EXACT NAME: "${comp.componentName}")
       Description: ${comp.description}
       Tags: ${comp.tags.join(', ')}
    `).join('')}
    
    **🚨 CRITICAL RULES:**
    1. ONLY use component names from the list above
    2. For text input, use "Input" NOT "TextInput" 
    3. For buttons, use "Button" NOT "TextButton" or "PrimaryButton"
    4. For icons, DO NOT use "Icon" component - it doesn't exist!
    5. Copy component names EXACTLY as shown above
    6. If a component is not listed above, DO NOT use it
    7. FORBIDDEN: Any component not explicitly listed in the available components list
    `
  }
  
  // 回退到静态文档版本
  if (!retrievedAugmentationContent) return ""

  return `
    **Private Components**
    - Must strictly follow the API defined in the documentation below
    - Using undocumented private component APIs is prohibited
    <basic-component-docs>
      ${retrievedAugmentationContent}
    </basic-component-docs>
  `
}

// Generate the additional rules section
const generateAdditionalRules = (
  rules: WorkflowContext["query"]["rules"],
): string => {
  const specialAttentionRules = getSpecialAttentionRules(rules)
  if (!specialAttentionRules) return ""

  return `
    ## Additional Rules
    ${specialAttentionRules}
  `
}

// RAG增强的系统提示词构建函数
export const buildSystemPrompt = (
  rules: WorkflowContext["query"]["rules"],
  retrievedAugmentationContent?: string,
  ragComponents?: ComponentDoc[]
): string => {
  // Generate each section
  const outputSpecification = generateOutputSpecification(rules)
  const styleSpecification = generateStyleSpecification(rules)
  const openSourceComponents = generateOpenSourceComponents(rules)
  const privateComponents = generatePrivateComponents(
    retrievedAugmentationContent,
    ragComponents
  )
  const additionalRules = generateAdditionalRules(rules)

  // Check if component usage guidelines exist
  const hasComponentGuidelines = openSourceComponents || privateComponents
  const componentGuidelinesHeader = hasComponentGuidelines
    ? "## Component Usage Guidelines\n"
    : ""

  // Only include component guidelines header if at least one of the sections exists
  const componentGuidelines = hasComponentGuidelines
    ? `${componentGuidelinesHeader}${openSourceComponents}${privateComponents}`
    : ""

  // RAG增强的特殊说明
  const ragEnhancement = ragComponents && ragComponents.length > 0
    ? `
    ## 🧠 RAG-Enhanced Component Generation
    This code generation is powered by intelligent component analysis.
    Selected components have been verified for relevance and accuracy.
    
    ⚠️ CRITICAL: Package names MUST be used exactly as specified above.
    `
    : ""

  return `
    # You are a senior frontend engineer focused on business component development

    ## Goal
    Generate business component code based on user requirements
    ${outputSpecification}
    ${styleSpecification}
    ${componentGuidelines}
    ${ragEnhancement}
    ${additionalRules}
  `
}

// build current component prompt
// When component exists, build corresponding user message and assistant message
export const buildCurrentComponentMessage = (
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

// build user prompt
export const buildUserMessage = (
  prompt: WorkflowContext["query"]["prompt"],
  design: NonNullable<WorkflowContext["state"]>["designTask"],
): Array<CoreMessage> => {
  return [
    {
      role: "user",
      content: prompt.map(p => {
        if (p.type === "image") {
          return { type: "image" as const, image: p.image }
        }
        return {
          type: "text" as const,
          text: `<user-requirements>
        ${p.text}

        ## Component Design Information
        - Component Name: ${design?.componentName}
        - Component Description: ${design?.componentDescription}
        - Base Components Used:
        ${design?.library
          ?.map(
            lib => `
          ${lib.name}:
          - Component List: ${lib.components.join(", ")}
          - Usage Instructions: ${lib.description}
        `,
          )
          .join("\n")}
        </user-requirements>`,
        }
      }),
    },
  ]
}

// generate component prompt
export const generateComponentMessage = (
  context: WorkflowContext,
): Array<CoreMessage> => {
  if (!context.state?.designTask) {
    throw new Error("Design task is required but not found in context")
  }

  return [
    ...buildCurrentComponentMessage(context.query.component),
    ...buildUserMessage(context.query.prompt, context.state.designTask),
  ]
}
