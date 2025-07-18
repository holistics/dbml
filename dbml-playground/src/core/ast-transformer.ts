/**
 * AST Transformer Service
 *
 * Transforms the generic DBML AST into semantic structures that are easier
 * to understand and navigate. This service provides both semantic interpretation
 * and access path generation for debugging purposes.
 *
 * Design Principles Applied:
 * - Deep Module: Complex transformation logic with simple interface
 * - Information Hiding: Transformation details hidden from consumers
 * - Single Responsibility: Only handles AST transformation and semantic analysis
 */

export interface SemanticASTNode {
  id: string
  type: 'database' | 'table' | 'column' | 'enum' | 'ref' | 'project' | 'tableGroup' | 'index' | 'tablePartial'
  name: string
  displayName: string
  icon: string
  children: SemanticASTNode[]
  accessPath: string // JavaScript access path for debugging
  sourcePosition?: {
    start: { line: number; column: number; offset: number }
    end: { line: number; column: number; offset: number }
    // Enhanced debugging information
    raw?: {
      startPos: any
      endPos: any
      start: number
      end: number
      fullStart: number
      fullEnd: number
      id: number
      kind: string
    }
    token?: {
      kind: string
      value: string
      leadingTrivia?: Array<{ kind: string; value: string }>
      trailingTrivia?: Array<{ kind: string; value: string }>
      leadingInvalid: number
      trailingInvalid: number
      isInvalid: boolean
    }
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
 * AST Transformer Service
 *
 * Converts raw DBML AST into semantic tree structures and provides
 * navigation and access path utilities.
 */
export class ASTTransformerService {
  private rawAST: any = null
  private semanticAST: SemanticASTNode | null = null

  /**
   * Transform raw AST into semantic structure
   */
  public transformToSemantic(rawAST: any): SemanticASTNode {
    this.rawAST = rawAST
    this.semanticAST = this.createSemanticDatabase(rawAST)
    return this.semanticAST
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
  public findNodesWithProperty(rawAST: any, propertyName: string, propertyValue?: any): any[] {
    const results: any[] = []
    this.searchForProperty(rawAST, propertyName, propertyValue, [], results)
    return results
  }

  /**
   * Get semantic node by raw path
   */
  public getSemanticNodeById(nodeId: string): SemanticASTNode | null {
    if (!this.semanticAST) return null
    return this.findSemanticNodeById(this.semanticAST, nodeId)
  }

  // Private methods

  private createSemanticDatabase(rawAST: any): SemanticASTNode {
    const databaseNode: SemanticASTNode = {
      id: 'database',
      type: 'database',
      name: 'Database Schema',
      displayName: 'Database Schema',
      icon: 'database',
      children: [],
      accessPath: 'ast'
    }

    if (!rawAST || !rawAST.body) {
      return databaseNode
    }

    // Process all elements in the AST body
    rawAST.body.forEach((element: any, index: number) => {
      const semanticChild = this.createSemanticElement(element, index)
      if (semanticChild) {
        databaseNode.children.push(semanticChild)
      }
    })

    // Group children by type for better organization
    this.organizeSemanticChildren(databaseNode)

    return databaseNode
  }

  private createSemanticElement(element: any, elementIndex: number): SemanticASTNode | null {
    if (!element || !element.type) {
      return null
    }

    const elementType = element.type.value?.toLowerCase()
    const basePath = `ast.body[${elementIndex}]`

    switch (elementType) {
      case 'table':
        return this.createSemanticTable(element, basePath)
      case 'enum':
        return this.createSemanticEnum(element, basePath)
      case 'ref':
        return this.createSemanticRef(element, basePath)
      case 'project':
        return this.createSemanticProject(element, basePath)
      case 'tablegroup':
        return this.createSemanticTableGroup(element, basePath)
      case 'tablepartial':
        return this.createSemanticTablePartial(element, basePath)
      default:
        return this.createGenericSemanticNode(element, basePath)
    }
  }

  private createSemanticTable(element: any, parentPath: string): SemanticASTNode {
    let tableName = this.extractElementName(element)
    
    // Additional fallback attempts for table name extraction
    if (!tableName) {
      // Try alternative property names
      tableName = element.identifier?.value || 
                  element.tableName?.value ||
                  element.id?.value ||
                  element.left?.value ||
                  element.callee?.value
    }
    
    tableName = tableName || 'unnamed_table'
    const columnCount = this.getColumnCount(element)
    const indexCount = this.getIndexCount(element)

    const tableNode: SemanticASTNode = {
      id: `table_${tableName}`,
      type: 'table',
      name: tableName,
      displayName: `${tableName} (${columnCount} columns${indexCount > 0 ? `, ${indexCount} indexes` : ''})`,
      icon: 'table',
      children: [],
      accessPath: parentPath,
      sourcePosition: this.extractSourcePosition(element)
    }

    // Add columns
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

    return {
      id: `column_${columnName}`,
      type: 'column',
      name: columnName,
      displayName: `${columnName}: ${columnType}${constraintText}`,
      icon: this.getColumnIcon(constraints),
      children: [],
      accessPath,
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticEnum(element: any, accessPath: string): SemanticASTNode {
    let enumName = this.extractElementName(element)
    
    // Additional fallback for enum names
    if (!enumName) {
      enumName = element.identifier?.value || element.id?.value || 'unnamed_enum'
    }
    
    enumName = enumName || 'unnamed_enum'
    const valueCount = this.getEnumValueCount(element)

    return {
      id: `enum_${enumName}`,
      type: 'enum',
      name: enumName,
      displayName: `${enumName} (${valueCount} values)`,
      icon: 'enum',
      children: [],
      accessPath,
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticRef(element: any, accessPath: string): SemanticASTNode {
    const refName = this.extractRefName(element)
    const relationship = this.extractRefRelationship(element)

    return {
      id: `ref_${refName}`,
      type: 'ref',
      name: refName,
      displayName: `${relationship}`,
      icon: 'ref',
      children: [],
      accessPath,
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticProject(element: any, accessPath: string): SemanticASTNode {
    const projectName = this.extractElementName(element) || 'Project Settings'

    return {
      id: 'project',
      type: 'project',
      name: projectName,
      displayName: `${projectName}`,
      icon: 'project',
      children: [],
      accessPath,
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticTableGroup(element: any, accessPath: string): SemanticASTNode {
    const groupName = this.extractElementName(element) || 'unnamed_group'

    return {
      id: `tablegroup_${groupName}`,
      type: 'tableGroup',
      name: groupName,
      displayName: `${groupName}`,
      icon: 'tableGroup',
      children: [],
      accessPath,
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticTablePartial(element: any, accessPath: string): SemanticASTNode {
    const partialName = this.extractElementName(element) || 'unnamed_partial'

    return {
      id: `tablepartial_${partialName}`,
      type: 'tablePartial',
      name: partialName,
      displayName: `${partialName} (partial)`,
      icon: 'tablePartial',
      children: [],
      accessPath,
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createSemanticIndex(element: any, accessPath: string): SemanticASTNode {
    const indexName = this.extractIndexName(element)

    return {
      id: `index_${indexName}`,
      type: 'index',
      name: indexName,
      displayName: `${indexName}`,
      icon: 'index',
      children: [],
      accessPath,
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  private createGenericSemanticNode(element: any, accessPath: string): SemanticASTNode {
    const name = this.extractElementName(element) || 'unknown'
    const type = element.type?.value || 'unknown'

    return {
      id: `${type}_${name}`,
      type: type as any,
      name,
      displayName: `${type}: ${name}`,
      icon: 'note',
      children: [],
      accessPath,
      sourcePosition: this.extractSourcePosition(element)
    }
  }

  // Helper methods for extraction

  private extractElementName(element: any): string | null {
    if (!element?.name) {
      return null
    }

    // Handle infix expressions (e.g., "public.users")
    if (element.name.kind === '<infix-expression>' && element.name.op?.value === '.') {
      const left = this.extractNameFromNode(element.name.leftExpression)
      const right = this.extractNameFromNode(element.name.rightExpression)
      if (left && right) {
        return `${left}.${right}`
      }
      // If we can't get both parts, just use the right part (table name)
      return right || left
    }

    // For other structures, use the recursive extraction
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

  private extractRefName(element: any): string {
    if (element.body?.left && element.body?.right) {
      const left = this.extractRefEndpoint(element.body.left)
      const right = this.extractRefEndpoint(element.body.right)
      const op = element.body.op?.value || '→'
      return `${left} ${op} ${right}`
    }
    return 'unnamed_ref'
  }

  private extractRefRelationship(element: any): string {
    return this.extractRefName(element)
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

  private extractIndexName(element: any): string {
    // Extract index name from element structure
    return 'index'
  }

  private extractSourcePosition(element: any) {
    if (element.token || element.startPos) {
      const token = element.token || element

      // Extract position info - fix off-by-one error by adding +1 to convert from 0-based to 1-based
      const startLine = (token.start?.line ?? token.startPos?.line ?? 0) + 1
      const startColumn = (token.start?.column ?? token.startPos?.column ?? 0) + 1
      const endLine = (token.end?.line ?? token.endPos?.line ?? 0) + 1
      const endColumn = (token.end?.column ?? token.endPos?.column ?? 0) + 1

      return {
        start: {
          line: startLine,
          column: startColumn,
          offset: token.start?.offset ?? token.startPos?.offset ?? 0
        },
        end: {
          line: endLine,
          column: endColumn,
          offset: token.end?.offset ?? token.endPos?.offset ?? 0
        },
        // Enhanced debugging information
        raw: {
          // Original 0-based positions for debugging
          startPos: element.startPos,
          endPos: element.endPos,
          start: element.start,
          end: element.end,
          fullStart: element.fullStart,
          fullEnd: element.fullEnd,
          id: element.id,
          kind: element.kind
        },
        // Token details if available
        token: element.token ? {
          kind: element.token.kind,
          value: element.token.value,
          leadingTrivia: element.token.leadingTrivia?.map((t: any) => ({
            kind: t.kind,
            value: t.value
          })),
          trailingTrivia: element.token.trailingTrivia?.map((t: any) => ({
            kind: t.kind,
            value: t.value
          })),
          leadingInvalid: element.token.leadingInvalid?.length || 0,
          trailingInvalid: element.token.trailingInvalid?.length || 0,
          isInvalid: element.token.isInvalid
        } : undefined
      }
    }
    return undefined
  }

  // Removed extractElementProperties method - keeping properties simple with just accessPath

  // Utility methods

  private isColumnDefinition(item: any): boolean {
    return item?.kind === '<function-application>' || (item?.callee && item?.args)
  }

  private isIndexDefinition(item: any): boolean {
    return item?.type?.value?.toLowerCase() === 'indexes'
  }

  private getColumnCount(element: any): number {
    if (!element.body?.body) return 0
    return element.body.body.filter((item: any) => this.isColumnDefinition(item)).length
  }

  private getIndexCount(element: any): number {
    if (!element.body?.body) return 0
    return element.body.body.filter((item: any) => this.isIndexDefinition(item)).length
  }

  private getEnumValueCount(element: any): number {
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

    // Search in AST node kinds (for searching node types like <table>, <function-application>, etc.)
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
      if (!groups[child.type]) {
        groups[child.type] = []
      }
      groups[child.type].push(child)
    })

    // Create organized structure
    const organizedChildren: SemanticASTNode[] = []

    // Add tables group
    if (groups.table) {
      organizedChildren.push({
        id: 'tables_group',
        type: 'database',
        name: 'Tables',
        displayName: `Tables (${groups.table.length})`,
        icon: 'table',
        children: groups.table,
        accessPath: '' // Organizational group - no real access path
      })
    }

    // Add other groups...
    Object.entries(groups).forEach(([type, children]) => {
      if (type !== 'table') {
        organizedChildren.push({
          id: `${type}_group`,
          type: 'database',
          name: type,
                  displayName: `${type} (${children.length})`,
        icon: this.getTypeIcon(type),
          children,
          accessPath: '' // Organizational group - no real access path
        })
      }
    })

    databaseNode.children = organizedChildren
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      table: 'table',
      enum: 'enum',
      ref: 'ref',
      project: 'project',
      tableGroup: 'tableGroup',
      tablePartial: 'tablePartial'
    }
    return icons[type] || 'default'
  }

  private findRawPath(node: any, property: string): string {
    // Generate raw JSON path for accessing the property
    return `ast.${property}`
  }

  private generateDescription(node: any, property: string, value: any): string {
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