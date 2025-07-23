# RFC (Request for Comments) Guidelines

## Overview

This directory contains technical design documents (RFCs) for DBDiagram features and systems. RFCs help us document architectural decisions, share knowledge, and ensure consistent implementation across the codebase.

## RFC Structure

Each RFC should follow this standardized format:

### 1. TLDR
- **Purpose**: Brief summary of what this feature/system does and why it exists
- **Target audience**: Engineers, AI agents, future maintainers
- **Length**: 2-3 sentences maximum

### 2. Concepts
- **Abstractions**: Key concepts and terminology needed to understand the RFC
- **Domain knowledge**: Business logic or technical concepts specific to this feature
- **Dependencies**: Related systems or components that interact with this feature

### 3. High-level Architecture
- **Design decisions**: Why certain approaches were chosen over alternatives
- **System boundaries**: What's included and what's not
- **Data flow**: How information moves through the system
- **Visual aids**: Mermaid diagrams, flowcharts, or code examples to illustrate the design

### 4. Detailed Implementation
- **Code organization**: File structure and module responsibilities
- **API contracts**: Interfaces, endpoints, and data formats
- **Error handling**: How failures are managed
- **Security considerations**: Authentication, authorization, validation
- **Performance implications**: Scalability and optimization notes

### 5. Limitations and Known Issues
- **Current limitations**: Known constraints or issues in the implementation
- **Technical debt**: Areas that need future improvement
- **Edge cases**: Scenarios that are not fully handled
- **Workarounds**: Temporary solutions or mitigations

## RFC Naming Convention

RFCs use date-based naming: `rfc-YYYYMMDD-feature-name.md`

- **YYYYMMDD**: Date when RFC was created (e.g., 20250715)
- **feature-name**: Descriptive name in kebab-case
- **Examples**:
  - `rfc-20250715-regional-pricing.md`
  - `rfc-20250820-workspace-permissions.md`
  - `rfc-20250901-api-rate-limiting.md`

## RFC Lifecycle (Git-Based)

### States

1. **🟡 DRAFT**: RFC is being written and reviewed (freely editable)
2. **🟢 IMPLEMENTED**: Feature is implemented and RFC reflects final design

### Update Strategy

**During DRAFT Phase:**
- Edit RFC file directly
- Git history tracks all changes
- Iterate based on team feedback

**After IMPLEMENTED:**
- Update RFC to reflect actual implementation
- Add "Design Evolution" section if implementation differs significantly from original design
- Document lessons learned and key insights

### State Tracking

Add status to RFC header:
```markdown
# RFC-YYYYMMDD: Feature Name

**Status**: DRAFT | IMPLEMENTED
**Last Updated**: Date
```

## Writing Guidelines

1. **Be concise but complete**: Include all necessary information without excessive detail
2. **Use clear language**: Avoid jargon unless defined in the Concepts section
3. **Include examples**: Code snippets, API calls, or configuration examples
4. **Consider maintainability**: How will this system evolve over time?
5. **Document trade-offs**: Explain why certain decisions were made
6. **Use Mermaid diagrams**: Preferred over ASCII art for better maintainability and readability
7. **Keep it current**: Update RFC to reflect actual implementation, not just original design

## Git-Based Change Management

Since we use Git for version control:
- **Direct editing** is preferred over complex versioning schemes
- **Commit messages** should explain what changed and why
- **Git history** provides complete evolution tracking
- **Diffs** show exactly what evolved between any two points

Example workflow:
```bash
# Initial RFC creation
git add docs/rfc/rfc-20250715-regional-pricing.md
git commit -m "RFC-20250715: Initial regional pricing design"

# Implementation simplification
git add docs/rfc/rfc-20250715-regional-pricing.md
git commit -m "RFC-20250715: Simplify to environment variable approach

- Remove complex admin API design
- Add simple ADMIN_REGION_OVERRIDE solution
- Update implementation section with actual approach"
```

## Template

```markdown
# RFC-YYYYMMDD: Feature Name

**Status**: DRAFT
**Last Updated**: YYYY-MM-DD

## TLDR
Brief summary of the feature purpose and value.

## Concepts
- **Term 1**: Definition and context
- **Term 2**: Definition and context

## High-level Architecture
Description of the overall design approach.

## Detailed Implementation
Specific implementation details, code organization, and technical considerations.

## Limitations and Known Issues
Current limitations, technical debt, and areas for future improvement.

## Design Evolution (if applicable)
Document significant changes from original design to final implementation.
```

## Related RFCs

- [RFC-20250115: DBML to JSON Database Model Parser](rfc-20250115-dbml-to-json-parser.md)
- [RFC-20250115: DBML Lexer Implementation](rfc-20250115-dbml-lexer.md)
- [RFC-20250722: DBML Playground Deployment](rfc-20250722-playground-deployment.md)