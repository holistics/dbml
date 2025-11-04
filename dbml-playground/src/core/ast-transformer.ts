/**
 * AST Transformer Service
 *
 * Transforms the DBML AST from @dbml/parse into semantic structures by REUSING
 * the parser's own type definitions and node structures. This eliminates
 * interface duplication and ensures consistency.
 *
 * Design Principles Applied:
 * - Deep Module: Complex transformation logic with simple interface
 * - Information Hiding: Transformation details hidden from consumers
 * - Single Responsibility: Only handles AST transformation and semantic analysis
 * - Single Source of Truth: Uses parser types directly - NO DUPLICATION
 * - Evolution Resilience: Handles new parser element types automatically
 */

import {
  Compiler,
  ElementKind,
  SyntaxNode,
  SyntaxNodeKind,
  ElementDeclarationNode,
  Position,
  Database,
  Table,
  Column,
  Enum,
  Ref,
  Project,
  TableGroup,
  TablePartial
} from '@dbml/parse'

// Use the actual parser types from the Compiler API
type CompilerAST = ReturnType<Compiler['parse']['ast']>

/**
 * Semantic AST Node - REUSES parser structures instead of duplicating
 *
 * This interface extends and reuses parser types wherever possible.
 * The 'data' field contains the actual parsed structure from @dbml/parse.
 *
 * The 'id' field is used internally for Vue component tracking and UI state management
 * (selection, expansion). It should NOT be shown in debugging UI - use the real parser 
 * node ID from sourcePosition.raw.id instead.
 */
export interface SemanticASTNode {
  id: string // Internal ID for Vue reactivity - NOT for debugging display
  type: ElementKind | 'database' | 'column' | 'index' | 'note' | 'unknown' // Use parser's ElementKind enum
  name: string
  displayName: string
  icon: string
  children: SemanticASTNode[]
  accessPath: string // JavaScript access path for debugging

  // REUSE parser structures instead of duplicating
  data?: Table | Column | Enum | Ref | Project | TableGroup | TablePartial | any

  // Source position using parser's Position interface
  sourcePosition?: {
    start: { line: number; column: number; offset: number }
    end: { line: number; column: number; offset: number }
    // Raw parser node information - use raw.id for debugging display
    raw?: {
      startPos: Position
      endPos: Position
      start: number
      end: number
      fullStart: number
      fullEnd: number
      id: number // THIS is the real parser node ID for debugging
      kind: SyntaxNodeKind
    }
    token?: any
  }
}

export interface AccessPath {
  raw: string
  description: string
  value: any
}

export interface FilterOptions {
  hidePositions: boolean
  hideInternalProps: boolean
  showOnlyNodeTypes: string[]
  searchTerm: string
}

/**
 * Development Info for debugging parser integration
 */
export interface ParserIntegrationInfo {
  isLinked: boolean
  packagePath: string
  version: string
  detectionMethod: string
}

/**
 * Element Handler Interface for the Resilient Design
 *
 * Handlers work with actual parser types, not duplicated interfaces
 */
export interface ElementHandler {
  canHandle(element: ElementDeclarationNode): boolean
  transform(element: ElementDeclarationNode, path: string): SemanticASTNode
  getElementType(): ElementKind | string
  getPriority(): number
}

/**
 * Element Type Registry using parser's ElementKind enum
 */
export class ElementTypeRegistry {
  private handlers: Map<ElementKind | string, ElementHandler> = new Map()
  private fallbackHandler: ElementHandler

  constructor() {
    this.fallbackHandler = new GenericElementHandler()
  }

  registerHandler(elementType: ElementKind | string, handler: ElementHandler): void {
    this.handlers.set(elementType, handler)
  }

  getHandler(element: ElementDeclarationNode): ElementHandler {
    const elementType = element?.type?.value?.toLowerCase() as ElementKind

    if (elementType && this.handlers.has(elementType)) {
      return this.handlers.get(elementType)!
    }

    // Find handler by canHandle method
    for (const handler of this.handlers.values()) {
      if (handler.canHandle(element)) {
        return handler
      }
    }

    // Return fallback for unknown types - this makes us evolution-resilient
    return this.fallbackHandler
  }

  getAllKnownTypes(): (ElementKind | string)[] {
    return Array.from(this.handlers.keys())
  }
}

/**
 * Generic Element Handler - Handles Unknown Types
 *
 * This ensures playground continues working when parser adds new element types
 */
export class GenericElementHandler implements ElementHandler {
  canHandle(_element: ElementDeclarationNode): boolean {
    return true // Can handle any element as fallback
  }

  transform(element: ElementDeclarationNode, path: string): SemanticASTNode {
    const name = this.extractElementName(element) || 'unknown'
    const elementType = element?.type?.value || 'unknown'

    // Generate deterministic ID for Vue reactivity using parser node ID if available
    const parserNodeId = element?.id || 0
    const semanticId = `${elementType}_${name}_${parserNodeId}`

    return {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: 'unknown',
      name,
      displayName: `${elementType}: ${name}`,
      icon: 'note',
      children: [],
      accessPath: path,
      data: element, // Store the original parser node
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  getElementType(): string {
    return 'unknown'
  }

  getPriority(): number {
    return 0 // Lowest priority - used as fallback
  }

  private extractElementName(element: ElementDeclarationNode): string | null {
    if (!element?.name) return null

    if (element.name.kind === SyntaxNodeKind.INFIX_EXPRESSION && element.name.op?.value === '.') {
      const left = this.getNameValue(element.name.leftExpression)
      const right = this.getNameValue(element.name.rightExpression)
      if (left && right) return `${left}.${right}`
      return right || left
    }

    return this.getNameValue(element.name)
  }

  private getNameValue(nameNode: any): string | null {
    if (!nameNode) return null
    if (nameNode.value) return nameNode.value
    if (nameNode.token?.value) return nameNode.token.value
    if (nameNode.variable?.value) return nameNode.variable.value
    return null
  }

  private extractSourcePosition(element: SyntaxNode) {
    const startLine = element.startPos.line + 1
    const startColumn = element.startPos.column + 1
    const endLine = element.endPos.line + 1
    const endColumn = element.endPos.column + 1

    return {
      start: {
        line: startLine,
        column: startColumn,
        offset: element.start
      },
      end: {
        line: endLine,
        column: endColumn,
        offset: element.end
      },
      raw: {
        startPos: element.startPos,
        endPos: element.endPos,
        start: element.start,
        end: element.end,
        fullStart: element.fullStart,
        fullEnd: element.fullEnd,
        id: element.id,
        kind: element.kind
      }
    }
  }
}

/**
 * AST Transformer Service
 *
 * Uses @dbml/parse types directly. No interface duplication.
 * Implements registry system for parser evolution resilience.
 */
export class ASTTransformerService {
  private rawAST: CompilerAST | null = null
  private semanticAST: SemanticASTNode | null = null
  private registry: ElementTypeRegistry

  constructor() {
    this.registry = new ElementTypeRegistry()
    this.initializeKnownHandlers()
  }

  /**
   * Check if we're using a linked version of @dbml/parse (for development)
   * This helps developers know if they're testing local changes
   *
   * Browser-compatible approach using import meta and runtime detection
   */
  public static getParserIntegrationInfo(): ParserIntegrationInfo {
    try {
      // Method 1: Check if we can access Compiler constructor properties that might indicate dev mode
      const compiler = new Compiler()
      let detectionMethod = 'runtime-analysis'
      let isLinked = false
      let version = 'unknown'

      // Method 2: Check for development mode indicators in the environment
      if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
        isLinked = true
        detectionMethod = 'vite-dev-mode'
      }

      // Method 3: Check URL patterns that might indicate local development
      if (typeof window !== 'undefined') {
        const currentURL = window.location.href
        if (currentURL.includes('localhost') || currentURL.includes('127.0.0.1') || currentURL.includes(':5173')) {
          isLinked = true
          detectionMethod = 'development-server'
        }
      }

      // Method 4: Try to detect by checking if compiler has development-only properties
      const compilerString = compiler.toString()
      if (compilerString.includes('development') || compilerString.includes('debug')) {
        isLinked = true
        detectionMethod = 'compiler-debug-mode'
      }

      // Method 5: Check package version if available through public API
      try {
        // If the package exports version info, we can access it
        version = (compiler as any).__version__ || 'runtime-detected'
      } catch {
        version = 'unavailable-in-browser'
      }

      return {
        isLinked,
        packagePath: 'browser-environment',
        version,
        detectionMethod
      }
    } catch (error) {
      return {
        isLinked: false,
        packagePath: 'browser-environment',
        version: 'unknown',
        detectionMethod: 'error: ' + (error as Error).message
      }
    }
  }

  /**
   * Initialize handlers for known element types from parser's ElementKind enum
   */
  private initializeKnownHandlers(): void {
    this.registry.registerHandler(ElementKind.Table, {
      canHandle: (element) => element?.type?.value?.toLowerCase() === ElementKind.Table,
      transform: (element, path) => this.createSemanticTable(element, path),
      getElementType: () => ElementKind.Table,
      getPriority: () => 10
    })

    this.registry.registerHandler(ElementKind.Enum, {
      canHandle: (element) => element?.type?.value?.toLowerCase() === ElementKind.Enum,
      transform: (element, path) => this.createSemanticEnum(element, path),
      getElementType: () => ElementKind.Enum,
      getPriority: () => 10
    })

    this.registry.registerHandler(ElementKind.Ref, {
      canHandle: (element) => element?.type?.value?.toLowerCase() === ElementKind.Ref,
      transform: (element, path) => this.createSemanticRef(element, path),
      getElementType: () => ElementKind.Ref,
      getPriority: () => 10
    })

    this.registry.registerHandler(ElementKind.Project, {
      canHandle: (element) => element?.type?.value?.toLowerCase() === ElementKind.Project,
      transform: (element, path) => this.createSemanticProject(element, path),
      getElementType: () => ElementKind.Project,
      getPriority: () => 10
    })

    this.registry.registerHandler(ElementKind.TableGroup, {
      canHandle: (element) => element?.type?.value?.toLowerCase() === ElementKind.TableGroup,
      transform: (element, path) => this.createSemanticTableGroup(element, path),
      getElementType: () => ElementKind.TableGroup,
      getPriority: () => 10
    })

    this.registry.registerHandler(ElementKind.TablePartial, {
      canHandle: (element) => element?.type?.value?.toLowerCase() === ElementKind.TablePartial,
      transform: (element, path) => this.createSemanticTablePartial(element, path),
      getElementType: () => ElementKind.TablePartial,
      getPriority: () => 10
    })

    // Add Note handler
    this.registry.registerHandler('note', {
      canHandle: (element) => element?.type?.value?.toLowerCase() === 'note',
      transform: (element, path) => this.createSemanticNote(element, path),
      getElementType: () => 'note',
      getPriority: () => 10
    })
  }

  /**
   * Transform parser AST into semantic structure
   * Uses registry system for automatic parser evolution handling
   */
  public transformToSemantic(rawAST: CompilerAST): SemanticASTNode {
    this.rawAST = rawAST
    this.semanticAST = this.createSemanticDatabase(rawAST)
    return this.semanticAST
  }

  /**
   * Create semantic transformation using fresh Compiler instance
   * Demonstrates direct use of parser API + structured data reuse
   */
  public static transformFromSource(source: string): {
    semantic: SemanticASTNode
    tokens: any[]
    errors: any[]
    interpretedData?: Database // REUSE parser's interpreted structure
    parserInfo: ParserIntegrationInfo // Include parser integration info
  } {
    const compiler = new Compiler()
    compiler.setSource(source)

    const ast = compiler.parse.ast()
    const tokens = compiler.parse.tokens()
    const errors = compiler.parse.errors()

    // Note: interpretedData would come from compiler.parse.rawDb() if available
    const interpretedData = undefined

    const transformer = new ASTTransformerService()
    const semantic = transformer.transformToSemantic(ast)
    const parserInfo = ASTTransformerService.getParserIntegrationInfo()

    return { semantic, tokens, errors, interpretedData, parserInfo }
  }

  /**
   * Register new element handler using parser's ElementKind
   */
  public registerElementHandler(elementType: ElementKind | string, handler: ElementHandler): void {
    this.registry.registerHandler(elementType, handler)
  }

  /**
   * Get all known element types from parser's ElementKind
   */
  public getKnownElementTypes(): (ElementKind | string)[] {
    return this.registry.getAllKnownTypes()
  }

  /**
   * Generate access path for any property in the AST
   */
  public generateAccessPath(node: any, property: string, value: any): AccessPath {
    const rawPath = this.findRawPath(node, property)
    const description = this.generateDescription(node, property, value)

    return {
      raw: rawPath,
      description,
      value
    }
  }

  /**
   * Filter raw AST based on criteria
   */
  public filterRawAST(rawAST: any, options: FilterOptions): any {
    if (!rawAST || typeof rawAST !== 'object') {
      return rawAST
    }

    const filtered: any = Array.isArray(rawAST) ? [] : {}

    for (const [key, value] of Object.entries(rawAST)) {
      // Filter out positions if requested
      if (options.hidePositions && this.isPositionProperty(key)) {
        continue
      }

      // Filter out internal properties if requested
      if (options.hideInternalProps && this.isInternalProperty(key)) {
        continue
      }

      // Apply search filter
      if (options.searchTerm && !this.matchesSearch(key, value, options.searchTerm)) {
        continue
      }

      // Recursively filter nested objects
      if (typeof value === 'object' && value !== null) {
        const filteredValue = this.filterRawAST(value, options)
        if (this.hasContent(filteredValue)) {
          filtered[key] = filteredValue
        }
      } else {
        filtered[key] = value
      }
    }

    return filtered
  }

  /**
   * Find nodes by property value in raw AST
   */
  public findNodesWithProperty(rawAST: CompilerAST, propertyName: string, propertyValue?: any): any[] {
    const results: any[] = []
    this.searchForProperty(rawAST, propertyName, propertyValue, [], results)
    return results
  }

  /**
   * Get semantic node by ID
   */
  public getSemanticNodeById(nodeId: string): SemanticASTNode | null {
    if (!this.semanticAST) return null
    return this.findSemanticNodeById(this.semanticAST, nodeId)
  }

  // Private methods

  private createSemanticDatabase(rawAST: CompilerAST): SemanticASTNode {
    const databaseNode: SemanticASTNode = {
      id: 'database_root', // Root semantic node for organizational purposes
      type: 'database',
      name: 'Database Schema',
      displayName: 'Database Schema',
      icon: 'database',
      children: [],
      accessPath: 'ast',
      data: rawAST // Store the program node as data
    }

    if (!rawAST?.body) {
      return databaseNode
    }

    // Process all elements using the registry system
    rawAST.body.forEach((element: ElementDeclarationNode, index: number) => {
      const semanticChild = this.createSemanticElement(element, index)
      if (semanticChild) {
        databaseNode.children.push(semanticChild)
      }
    })

    // Group children by type for better organization
    this.organizeSemanticChildren(databaseNode)

    return databaseNode
  }

  /**
   * CRITICAL: Uses registry system for automatic parser evolution handling
   */
  private createSemanticElement(element: ElementDeclarationNode, elementIndex: number): SemanticASTNode | null {
    if (!element) {
      return null
    }

    const basePath = `ast.body[${elementIndex}]`

    // Use registry to find appropriate handler
    const handler = this.registry.getHandler(element)

    // Transform using the handler - works for both known and unknown types
    return handler.transform(element, basePath)
  }

  // Specific handler methods that use parser types

  private createSemanticTable(element: ElementDeclarationNode, parentPath: string): SemanticASTNode {
    let tableName = this.extractElementName(element)
    tableName = tableName || 'unnamed_table'
    const columnCount = this.getColumnCount(element)
    const indexCount = this.getIndexCount(element)

    // Generate deterministic ID using parser node ID
    const parserNodeId = element?.id || 0
    const semanticId = `table_${tableName}_${parserNodeId}`

    const tableNode: SemanticASTNode = {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: ElementKind.Table, // Use parser's ElementKind
      name: tableName,
      displayName: `${tableName} (${columnCount} columns${indexCount > 0 ? `, ${indexCount} indexes` : ''})`,
      icon: 'table',
      children: [],
      accessPath: parentPath,
      data: element, // Store the original parser element
      sourcePosition: this.extractSourcePosition(element)
    }

    // Add columns using flexible traversal
    if (element.body?.body) {
      element.body.body.forEach((item: any, index: number) => {
        if (this.isColumnDefinition(item)) {
          const column = this.createSemanticColumn(item, `${parentPath}.body.body[${index}]`)
          if (column) {
            tableNode.children.push(column)
          }
        } else if (this.isIndexDefinition(item)) {
          const indexNode = this.createSemanticIndex(item, `${parentPath}.body.body[${index}]`)
          if (indexNode) {
            tableNode.children.push(indexNode)
          }
        }
      })
    }

    return tableNode
  }

  private createSemanticColumn(element: any, accessPath: string): SemanticASTNode | null {
    const columnName = this.extractColumnName(element) || 'unnamed_column'
    const columnType = this.extractColumnType(element) || 'unknown'
    const constraints = this.extractColumnConstraints(element)

    const constraintText = constraints.length > 0 ? ` [${constraints.join(', ')}]` : ''

    // Generate deterministic ID using parser node ID
    const parserNodeId = element?.id || 0
    const semanticId = `column_${columnName}_${parserNodeId}`

    return {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: 'column',
      name: columnName,
      displayName: `${columnName}: ${columnType}${constraintText}`,
      icon: this.getColumnIcon(constraints),
      children: [],
      accessPath,
      data: element, // Store the original parser element
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticEnum(element: ElementDeclarationNode, accessPath: string): SemanticASTNode {
    let enumName = this.extractElementName(element)
    enumName = enumName || 'unnamed_enum'
    const valueCount = this.getEnumValueCount(element)

    // Generate deterministic ID using parser node ID
    const parserNodeId = element?.id || 0
    const semanticId = `enum_${enumName}_${parserNodeId}`

    return {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: ElementKind.Enum, // Use parser's ElementKind
      name: enumName,
      displayName: `${enumName} (${valueCount} values)`,
      icon: 'enum',
      children: [],
      accessPath,
      data: element, // Store the original parser element
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticRef(element: ElementDeclarationNode, accessPath: string): SemanticASTNode {
    const refName = this.extractElementName(element) // Use the standard name extraction
    const relationship = this.extractRefRelationship(element)

    // Use the actual ref name if available, otherwise use a more descriptive fallback
    const displayName = refName || relationship || 'Reference'
    const semanticName = refName || 'reference'

    // Generate deterministic ID using parser node ID
    const parserNodeId = element?.id || 0
    const semanticId = `ref_${semanticName}_${parserNodeId}`

    return {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: ElementKind.Ref, // Use parser's ElementKind
      name: semanticName,
      displayName: displayName,
      icon: 'ref',
      children: [],
      accessPath,
      data: element, // Store the original parser element
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticProject(element: ElementDeclarationNode, accessPath: string): SemanticASTNode {
    const projectName = this.extractElementName(element) || 'Project Settings'

    // Generate deterministic ID using parser node ID
    const parserNodeId = element?.id || 0
    const semanticId = `project_${projectName}_${parserNodeId}`

    return {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: ElementKind.Project, // Use parser's ElementKind
      name: projectName,
      displayName: `${projectName}`,
      icon: 'project',
      children: [],
      accessPath,
      data: element, // Store the original parser element
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticTableGroup(element: ElementDeclarationNode, accessPath: string): SemanticASTNode {
    const groupName = this.extractElementName(element) || 'unnamed_group'
    const tableNames = this.extractTableGroupMembers(element)

    // Create display name with table details
    let displayName = groupName
    if (tableNames.length > 0) {
      displayName = `${groupName} [${tableNames.join(', ')}]`
    }

    // Generate deterministic ID using parser node ID
    const parserNodeId = element?.id || 0
    const semanticId = `tablegroup_${groupName}_${parserNodeId}`

    return {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: ElementKind.TableGroup, // Use parser's ElementKind
      name: groupName,
      displayName: displayName,
      icon: 'tableGroup',
      children: [],
      accessPath,
      data: element, // Store the original parser element
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticTablePartial(element: ElementDeclarationNode, accessPath: string): SemanticASTNode {
    const partialName = this.extractElementName(element) || 'unnamed_partial'

    // Generate deterministic ID using parser node ID
    const parserNodeId = element?.id || 0
    const semanticId = `tablepartial_${partialName}_${parserNodeId}`

    return {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: ElementKind.TablePartial, // Use parser's ElementKind
      name: partialName,
      displayName: `${partialName} (partial)`,
      icon: 'tablePartial',
      children: [],
      accessPath,
      data: element, // Store the original parser element
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticIndex(element: any, accessPath: string): SemanticASTNode {
    const indexName = this.extractIndexName(element)

    // Generate deterministic ID using parser node ID
    const parserNodeId = element?.id || 0
    const semanticId = `index_${indexName}_${parserNodeId}`

    return {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: 'index',
      name: indexName,
      displayName: `${indexName}`,
      icon: 'index',
      children: [],
      accessPath,
      data: element, // Store the original parser element
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticNote(element: ElementDeclarationNode, accessPath: string): SemanticASTNode {
    const noteName = this.extractElementName(element) || this.extractNoteContent(element) || 'Sticky Note'

    // Generate deterministic ID using parser node ID
    const parserNodeId = element?.id || 0
    const semanticId = `note_${noteName}_${parserNodeId}`

    return {
      id: semanticId, // Deterministic ID for Vue, based on content + parser node ID
      type: 'note',
      name: noteName,
      displayName: noteName,
      icon: 'note',
      children: [],
      accessPath,
      data: element, // Store the original parser element
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  // Helper methods using parser types

  private extractElementName(element: ElementDeclarationNode): string | null {
    if (!element?.name) {
      return null
    }

    // Handle infix expressions using parser's SyntaxNodeKind
    if (element.name.kind === SyntaxNodeKind.INFIX_EXPRESSION && element.name.op?.value === '.') {
      const left = this.extractNameFromNode(element.name.leftExpression)
      const right = this.extractNameFromNode(element.name.rightExpression)
      if (left && right) {
        return `${left}.${right}`
      }
      return right || left
    }

    return this.extractNameFromNode(element.name)
  }

  private extractNameFromNode(nameNode: any): string | null {
    if (!nameNode) return null

    // Direct value
    if (nameNode.value) {
      return nameNode.value
    }

    // String type
    if (typeof nameNode === 'string') {
      return nameNode
    }

    // Variable with value
    if (nameNode.variable?.value) {
      return nameNode.variable.value
    }

    // Token with value
    if (nameNode.token?.value) {
      return nameNode.token.value
    }

    // Expression with nested structure
    if (nameNode.expression) {
      return this.extractNameFromNode(nameNode.expression)
    }

    // Body with multiple tokens (identifier stream)
    if (nameNode.body && Array.isArray(nameNode.body)) {
      const tokens = nameNode.body
        .map((token: any) => this.extractNameFromNode(token))
        .filter((val: string | null) => val && val !== '.')

      if (tokens.length > 0) {
        return tokens.join('.')
      }
    }

    // Identifiers array (for identifier streams)
    if (nameNode.identifiers && Array.isArray(nameNode.identifiers)) {
      const tokens = nameNode.identifiers
        .map((id: any) => this.extractNameFromNode(id))
        .filter((val: string | null) => val)

      if (tokens.length > 0) {
        return tokens.join('.')
      }
    }

    // For complex nested structures, try to find any meaningful name
    if (typeof nameNode === 'object') {
      for (const [key, value] of Object.entries(nameNode)) {
        if (key === 'value' && typeof value === 'string') {
          return value
        }
        if (key === 'name' && value) {
          return this.extractNameFromNode(value)
        }
      }
    }

    return null
  }

  private extractColumnName(element: any): string | null {
    if (!element?.callee) {
      return null
    }

    return this.extractNameFromNode(element.callee)
  }

  private extractColumnType(element: any): string | null {
    if (!element.args || element.args.length === 0) {
      return null
    }

    const typeArg = element.args[0]
    if (!typeArg) {
      return null
    }

    return this.extractNameFromNode(typeArg)
  }

  private extractColumnConstraints(element: any): string[] {
    const constraints: string[] = []

    if (element.args) {
      element.args.forEach((arg: any) => {
        if (arg?.body) {
          // Handle attribute lists like [pk, unique]
          arg.body.forEach((attr: any) => {
            if (attr?.name?.value) {
              constraints.push(attr.name.value)
            } else if (attr?.name?.token?.value) {
              constraints.push(attr.name.token.value)
            }
          })
        }
      })
    }

    return constraints
  }

  private extractRefRelationship(element: ElementDeclarationNode): string {
    // Try multiple ways to extract the relationship
    if (element.body?.left && element.body?.right) {
      const left = this.extractRefEndpoint(element.body.left)
      const right = this.extractRefEndpoint(element.body.right)
      const op = element.body.op?.value || '→'
      return `${left} ${op} ${right}`
    }

    // Try to extract from different possible structures
    if (element.body?.expression) {
      return this.extractRelationshipFromExpression(element.body.expression)
    }

    // Try to extract from body directly if it's a different structure
    if (element.body && typeof element.body === 'object') {
      const bodyStr = this.extractRelationshipFromBody(element.body)
      if (bodyStr) return bodyStr
    }

    return 'Reference Relationship'
  }

  private extractRefEndpoint(endpoint: any): string {
    if (endpoint?.value) {
      return endpoint.value
    }
    if (endpoint?.left && endpoint?.right) {
      return `${endpoint.left.value}.${endpoint.right.value}`
    }
    return 'unknown'
  }

  private extractRelationshipFromExpression(expression: any): string {
    // Handle infix expressions for relationships
    if (expression?.left && expression?.right && expression?.op) {
      const left = this.extractRefEndpoint(expression.left)
      const right = this.extractRefEndpoint(expression.right)
      const op = expression.op.value || '→'
      return `${left} ${op} ${right}`
    }
    return ''
  }

  private extractRelationshipFromBody(body: any): string {
    // Try to find relationship information in the body structure
    if (body?.sourceColumn && body?.targetColumn) {
      const source = this.extractNameFromNode(body.sourceColumn)
      const target = this.extractNameFromNode(body.targetColumn)
      return `${source} → ${target}`
    }

    // Look for any structure that might contain relationship info
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'object' && value !== null) {
        if (key === 'relationship' || key === 'relation') {
          return this.extractRelationshipFromExpression(value)
        }
      }
    }

    return ''
  }

  private extractIndexName(_element: any): string {
    return 'index'
  }

  private extractNoteContent(element: ElementDeclarationNode): string | null {
    // Try to extract the note content/text from the body
    if (element.body?.value) {
      return element.body.value.substring(0, 50) // First 50 chars as name
    }

    if (element.body?.token?.value) {
      return element.body.token.value.substring(0, 50)
    }

    // Try to find string content in the body
    if (element.body && typeof element.body === 'object') {
      for (const [_key, value] of Object.entries(element.body)) {
        if (typeof value === 'string' && value.length > 0) {
          return value.substring(0, 50)
        }
        if (typeof value === 'object' && value !== null && (value as any).value) {
          return String((value as any).value).substring(0, 50)
        }
      }
    }

    return null
  }

  private extractTableGroupMembers(element: ElementDeclarationNode): string[] {
    const tableNames: string[] = []

    // Try to extract table names from the table group body
    if (element.body?.body && Array.isArray(element.body.body)) {
      element.body.body.forEach((item: any) => {
        let tableName = this.extractNameFromNode(item)

        // If standard extraction fails, try more specific methods for table names
        if (!tableName) {
          if (item?.variable?.value) tableName = item.variable.value
          if (item?.callee?.value) tableName = item.callee.value
          if (item?.callee?.token?.value) tableName = item.callee.token.value
        }

        if (tableName) {
          tableNames.push(tableName)
        }
      })
    }

    return tableNames
  }

  private extractSourcePosition(element: SyntaxNode) {
    const startLine = element.startPos.line + 1
    const startColumn = element.startPos.column + 1
    const endLine = element.endPos.line + 1
    const endColumn = element.endPos.column + 1

    return {
      start: {
        line: startLine,
        column: startColumn,
        offset: element.start
      },
      end: {
        line: endLine,
        column: endColumn,
        offset: element.end
      },
      raw: {
        startPos: element.startPos,
        endPos: element.endPos,
        start: element.start,
        end: element.end,
        fullStart: element.fullStart,
        fullEnd: element.fullEnd,
        id: element.id,
        kind: element.kind
      }
    }
  }

  // Utility methods

  private isColumnDefinition(item: any): boolean {
    return item?.kind === SyntaxNodeKind.FUNCTION_APPLICATION || (item?.callee && item?.args)
  }

  private isIndexDefinition(item: any): boolean {
    return item?.type?.value?.toLowerCase() === ElementKind.Indexes
  }

  private getColumnCount(element: ElementDeclarationNode): number {
    if (!element.body?.body) return 0
    return element.body.body.filter((item: any) => this.isColumnDefinition(item)).length
  }

  private getIndexCount(element: ElementDeclarationNode): number {
    if (!element.body?.body) return 0
    return element.body.body.filter((item: any) => this.isIndexDefinition(item)).length
  }

  private getEnumValueCount(element: ElementDeclarationNode): number {
    if (!element.body?.body) return 0
    return element.body.body.length
  }

  private getColumnIcon(constraints: string[]): string {
    if (constraints.includes('pk')) return 'column-pk'
    if (constraints.includes('unique')) return 'column-unique'
    if (constraints.includes('not null')) return 'column-required'
    return 'column'
  }

  private isPositionProperty(key: string): boolean {
    return ['token', 'startPos', 'endPos', 'start', 'end', 'fullStart', 'fullEnd', 'id'].includes(key)
  }

  private isInternalProperty(key: string): boolean {
    return ['symbol', 'referee', 'parent', 'kind'].includes(key)
  }

  private matchesSearch(key: string, value: any, searchTerm: string): boolean {
    const term = searchTerm.toLowerCase()

    // Search in property names
    if (key.toLowerCase().includes(term)) {
      return true
    }

    // Search in string values
    if (typeof value === 'string' && value.toLowerCase().includes(term)) {
      return true
    }

    // Search in AST node kinds using parser's SyntaxNodeKind
    if (typeof value === 'object' && value !== null && value.kind) {
      if (value.kind.toLowerCase().includes(term)) {
        return true
      }
    }

    // Search in nested object properties recursively
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (this.matchesSearch(nestedKey, nestedValue, searchTerm)) {
          return true
        }
      }
    }

    return false
  }

  private hasContent(obj: any): boolean {
    if (obj === null || obj === undefined) return false
    if (Array.isArray(obj)) return obj.length > 0
    if (typeof obj === 'object') return Object.keys(obj).length > 0
    return true
  }

  private organizeSemanticChildren(databaseNode: SemanticASTNode): void {
    // Group children by type
    const groups: Record<string, SemanticASTNode[]> = {}

    databaseNode.children.forEach(child => {
      const typeKey = child.type as string
      if (!groups[typeKey]) {
        groups[typeKey] = []
      }
      groups[typeKey].push(child)
    })

    // Create organized structure
    const organizedChildren: SemanticASTNode[] = []

    // Add tables group
    if (groups[ElementKind.Table]) {
      organizedChildren.push({
        id: `group_tables_${groups[ElementKind.Table].length}`, // Deterministic based on content
        type: 'database',
        name: 'tables',
        displayName: `tables (${groups[ElementKind.Table].length})`,
        icon: 'table',
        children: groups[ElementKind.Table],
        accessPath: ''
      })
    }

    // Add other groups dynamically using parser's ElementKind
    Object.entries(groups).forEach(([type, children]) => {
      if (type !== ElementKind.Table && type !== 'database') {
        organizedChildren.push({
          id: `group_${type}_${children.length}`, // Deterministic based on content
          type: 'database',
          name: type,
          displayName: `${type} (${children.length})`,
          icon: this.getTypeIcon(type),
          children,
          accessPath: ''
        })
      }
    })

    databaseNode.children = organizedChildren
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      [ElementKind.Table]: 'table',
      [ElementKind.Enum]: 'enum',
      [ElementKind.Ref]: 'ref',
      [ElementKind.Project]: 'project',
      [ElementKind.TableGroup]: 'tableGroup',
      [ElementKind.TablePartial]: 'tablePartial',
      note: 'note',
      unknown: 'note',
    }
    return icons[type] || 'note'
  }

  private findRawPath(_node: any, property: string): string {
    return `ast.${property}`
  }

  private generateDescription(node: any, property: string, _value: any): string {
    return `${property} in ${node?.type || 'unknown'} node`
  }

  private searchForProperty(obj: any, propertyName: string, propertyValue: any, currentPath: string[], results: any[]): void {
    if (typeof obj !== 'object' || obj === null) {
      return
    }

    for (const [key, value] of Object.entries(obj)) {
      const newPath = [...currentPath, key]

      if (key === propertyName && (propertyValue === undefined || value === propertyValue)) {
        results.push({
          path: newPath.join('.'),
          value,
          node: obj
        })
      }

      if (typeof value === 'object' && value !== null) {
        this.searchForProperty(value, propertyName, propertyValue, newPath, results)
      }
    }
  }

  private findSemanticNodeById(node: SemanticASTNode, nodeId: string): SemanticASTNode | null {
    if (node.id === nodeId) {
      return node
    }

    for (const child of node.children) {
      const found = this.findSemanticNodeById(child, nodeId)
      if (found) {
        return found
      }
    }

    return null
  }
}
