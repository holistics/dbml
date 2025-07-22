# DBML Parser Playground

Interactive web application for debugging and visualizing the DBML parser pipeline. Provides real-time parsing with bidirectional navigation, AST transformation, and comprehensive debugging features.

![DBML Parser Playground Screenshot](docs/screenshot.png)

## Features

- 🔍 **Real-time Parser Pipeline Visualization** - View all parsing stages (Lexer → Parser → Analyzer → Interpreter)
- 🎯 **Bidirectional Navigation** - Click-to-navigate between source code, tokens, and AST nodes
- 🌳 **AST Transformation** - Semantic trees with metadata and source position mapping
- 📝 **Monaco Editor** - Professional code editor with DBML syntax highlighting and Vim mode
- 🎛️ **Interactive Debugging** - Inspect tokens, raw AST, and semantic output
- 💾 **Persistent State** - Auto-saves your work to localStorage

## Quick Start

### Development

```bash
# Clone the repository
git clone https://github.com/holistics/dbml.git
cd dbml/dbml-playground

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to see the playground.

### Production Build

```bash
# Build for production
npm run build

# Preview the build
npm run preview
```

## Local Development with @dbml/parse

When developing changes to the DBML parser alongside the playground, use workspace dependencies:

### 1. Update package.json

Change the `@dbml/parse` dependency to use workspace:

```json
{
  "dependencies": {
    "@dbml/parse": "workspace:*"
  }
}
```

### 2. Install Dependencies

```bash
# From the monorepo root
npm install

# Or from playground directory
npm install
```

### 3. Development Indicator

The playground will automatically detect workspace dependencies and show "**development**" in the version tag instead of the version number, helping you distinguish between local and published package usage.

### 4. Switching Back

For production builds or when not doing local parser development, change back to the published version:

```json
{
  "dependencies": {
    "@dbml/parse": "3.13.7"
  }
}
```

## Usage

### Parser Pipeline Stages

The playground shows output from each stage of the DBML parser:

1. **Lexer** - Tokenization stage showing individual tokens
2. **Parser** - Syntax analysis stage showing raw AST
3. **Analyzer** - Semantic analysis stage with symbol resolution
4. **Interpreter** - Final semantic tree for database model
5. **Errors** - Parse errors with line/column information

### Navigation Features

- **Click tokens** to highlight corresponding source code
- **Click AST nodes** to jump to source location
- **Cmd/Ctrl+Click** for enhanced navigation mode
- **Resize panels** by dragging the divider

### Editor Features

- **DBML syntax highlighting**
- **Vim mode** toggle in the top-right
- **Auto-save** to localStorage
- **Cmd/Ctrl+S** manual save shortcut

## Project Structure

```
dbml-playground/
├── src/
│   ├── core/                    # Core business logic
│   │   ├── parser-service.ts    # DBML parsing wrapper
│   │   ├── reactive-parser.ts   # Vue reactivity layer
│   │   ├── ast-transformer.ts   # Semantic AST transformation
│   │   ├── token-mapping.ts     # Position-token mapping
│   │   └── token-navigation.ts  # Navigation coordination
│   ├── components/              # UI components
│   │   ├── editors/             # Monaco editor wrapper
│   │   ├── outputs/             # Output viewers
│   │   └── monaco/              # DBML language definition
│   ├── composables/             # Vue composables
│   ├── types/                   # TypeScript definitions
│   └── App.vue                  # Main application
├── public/                      # Static assets
└── dist/                        # Production build
```

## Architecture

The playground follows a modular architecture with clear separation of concerns:

- **Deep Modules**: Core services encapsulate complex logic behind simple interfaces
- **Shallow Modules**: UI components focus on presentation and delegate to services
- **Reactive Layer**: Vue 3 Composition API separates reactive concerns from business logic
- **Service Architecture**: Parser, AST transformation, and navigation services provide clean abstractions

For detailed architectural documentation, see [RFC-20250115](../docs/rfc/rfc-20250115-dbml-playground.md).

## Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint

# Code formatting
npm run format
```

## Contributing

1. **Local Development**: Use `"@dbml/parse": "workspace:*"` in package.json
2. **Testing**: Verify your changes with various DBML examples
3. **Documentation**: Update RFC if making architectural changes
4. **Production**: Change back to published version before committing

## Deployment

The playground can be deployed as a static site to any hosting platform:

- **GitHub Pages**: Automatic deployment from the repository
- **Vercel/Netlify**: Connect to repository for automatic builds
- **Static Hosting**: Upload `dist/` folder contents

## Troubleshooting

### Version Detection Issues

If the playground shows the wrong version indicator:

1. Check `package.json` dependency format
2. Ensure `workspace:*` for local development
3. Use semantic version (e.g., `3.13.7`) for production

### Build Errors

Common issues and solutions:

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Monaco Editor Issues

If the editor doesn't load properly:

1. Check browser console for errors
2. Ensure modern browser (ES2020+ support)
3. Try disabling browser extensions

## License

Apache-2.0 - see [LICENSE](../LICENSE) for details.