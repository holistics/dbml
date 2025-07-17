import { ref, computed, watch } from 'vue'
// @ts-ignore: Type definitions issue with @dbml/parse exports
import { Compiler } from '@dbml/parse'

interface CompileError {
  code: number
  message: string
  nodeOrToken?: {
    startPos?: { line: number; column: number }
    endPos?: { line: number; column: number }
  }
}

interface ParseStageResult {
  tokens?: any[]
  ast?: any
  analyzedAst?: any
  json?: any
  errors?: CompileError[]
}

interface ParseResult extends ParseStageResult {
  success: boolean
  error?: string
}

export function useParser() {
  const dbmlInput = ref(`Table users {
  id int [pk]
  username varchar [not null]
  email varchar [unique, not null]
  created_at timestamp [default: \`now()\`]
}

Table posts {
  id int [pk]
  title varchar [not null]
  content text
  user_id int [ref: > users.id]
  created_at timestamp [default: \`now()\`]
  
  indexes {
    created_at
    (user_id, created_at)
  }
}

Enum post_status {
  draft
  published
  archived
}`)

  const parseResult = ref<ParseResult>({
    success: false,
    tokens: [],
    ast: null,
    analyzedAst: null,
    json: null,
    errors: []
  })

  const isLoading = ref(false)

  // Create compiler instance
  const compiler = new Compiler()

  const parseDBML = async (input: string): Promise<ParseResult> => {
    try {
      isLoading.value = true
      
      // Set the source for the compiler
      compiler.setSource(input)

      // Get tokens from lexer
      const tokens = compiler.parse.tokens()
      
      // Get AST from parser
      const ast = compiler.parse.ast()
      
      // Get errors from all stages
      const errors = compiler.parse.errors()
      
      // Get final JSON output if no errors
      let json = null
      if (errors.length === 0) {
        try {
          json = compiler.parse.rawDb()
        } catch (err) {
          console.warn('Failed to get raw database:', err)
        }
      }

      return {
        success: errors.length === 0,
        tokens: tokens || [],
        ast,
        analyzedAst: ast, // The AST from compiler.parse.ast() is already analyzed
        json,
        errors,
        error: errors.length > 0 ? errors.map((e: any) => e.message).join('\n') : undefined
      }
    } catch (error: any) {
      console.error('Parser error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
        tokens: [],
        ast: null,
        analyzedAst: null,
        json: null,
        errors: []
      }
    } finally {
      isLoading.value = false
    }
  }

  // Watch for input changes and reparse with debouncing
  let parseTimeout: number | null = null
  watch(dbmlInput, (newInput) => {
    if (parseTimeout) {
      clearTimeout(parseTimeout)
    }
    
    parseTimeout = window.setTimeout(async () => {
      const result = await parseDBML(newInput)
      parseResult.value = result
    }, 300) // 300ms debounce
  }, { immediate: true })

  // Computed properties for each stage
  const tokens = computed(() => parseResult.value.tokens || [])
  const ast = computed(() => parseResult.value.ast)
  const analyzedAst = computed(() => parseResult.value.analyzedAst)
  const json = computed(() => parseResult.value.json)
  const errors = computed(() => parseResult.value.errors || [])
  const hasErrors = computed(() => !parseResult.value.success)

  // Format output for display
  const formatTokens = (tokens: any[]) => {
    return tokens
      .filter(token => token.kind !== 'EOF') // Filter out EOF token
      .map(token => ({
        kind: token.kind,
        value: token.value,
        position: {
          line: token.startPos?.line + 1 || 1,
          column: token.startPos?.column + 1 || 1
        }
      }))
  }

  const formatAST = (ast: any) => {
    if (!ast) return null
    
    // Remove circular references and simplify for display
    const simplified = JSON.parse(JSON.stringify(ast, (key, value) => {
      // Skip these properties to reduce noise
      if (['parent', 'symbol', 'referee', 'id'].includes(key)) {
        return undefined
      }
      return value
    }))
    
    return simplified
  }

  const formatJSON = (json: any) => {
    if (!json) return null
    
    // Clean up the JSON output for better readability
    return {
      schemas: json.schemas || [],
      tables: (json.tables || []).map((table: any) => ({
        name: table.name,
        schemaName: table.schemaName,
        fields: (table.fields || []).map((field: any) => ({
          name: field.name,
          type: field.type,
          pk: field.pk,
          unique: field.unique,
          not_null: field.not_null,
          increment: field.increment,
          default: field.default
        })),
        indexes: table.indexes || []
      })),
      refs: json.refs || [],
      enums: json.enums || [],
      tableGroups: json.tableGroups || [],
      project: json.project || {}
    }
  }

  const formatErrors = (errors: CompileError[]) => {
    return errors.map(error => ({
      code: error.code,
      message: error.message,
      location: {
        line: (error.nodeOrToken?.startPos?.line ?? 0) + 1,
        column: (error.nodeOrToken?.startPos?.column ?? 0) + 1
      }
    }))
  }

  return {
    // Input
    dbmlInput,
    
    // State
    isLoading,
    parseResult,
    
    // Computed outputs
    tokens,
    ast,
    analyzedAst,
    json,
    errors,
    hasErrors,
    
    // Formatters
    formatTokens,
    formatAST,
    formatJSON,
    formatErrors,
    
    // Methods
    parseDBML
  }
} 