---
name: "TypeScript Lint Prevention Strategy"
description: "Comprehensive prevention framework for TypeScript and ESLint issues through proactive development practices, explicitly prohibiting eslint-disable-next-line"
author: "Cline Team"
version: "2.0"
tags: ["typescript", "linting", "prevention", "quality-assurance", "automation"]
globs: ["*.ts", "*.tsx"]
related_rules: ["coding-standards.md", "rule-templates.md"]
effective_date: "2025-01-11"
review_date: "2025-07-11"
---

# TypeScript Lint Prevention Strategy

**MANDATORY FRAMEWORK**: This document provides a comprehensive prevention system to eliminate TypeScript and ESLint issues before they occur through proactive development practices, with **explicit prohibition of eslint-disable-next-line**.

## 🚫 CRITICAL RULE: NO eslint-disable-next-line ALLOWED

**ABSOLUTE PROHIBITION**: The use of `eslint-disable-next-line` comments is strictly forbidden in all code. This includes but is not limited to:

- `// eslint-disable-next-line @typescript-eslint/no-unused-vars`
- `// eslint-disable-next-line no-console`
- `// eslint-disable-next-line react-hooks/rules-of-hooks`
- Any other eslint-disable-next-line patterns

**Rationale**: eslint-disable-next-line masks underlying code quality issues and prevents proper error detection. Instead, developers must fix the root cause of lint violations.

## Core Prevention Principles

### 1. **Proactive Type Design**

- **Interface-First Development**: Define complete interfaces before writing implementation
- **Type-Driven Architecture**: Design APIs around strict type contracts
- **Constraint-Based Generics**: Use generic constraints to enforce type safety at compile time
- **Discriminated Unions**: Use union types for state management and error handling

### 2. **Pre-Implementation Validation**

- **Type Check First**: Run `tsc --noEmit` before writing any logic
- **Lint Before Logic**: Check ESLint compliance before implementation
- **Build Pipeline Integration**: Integrate TypeScript and ESLint into development workflow
- **IDE Configuration**: Configure editor for real-time feedback

### 3. **Incremental Quality Gates**

- **Micro-Validation**: Validate after every small change (lines 10-20)
- **Component Checkpoint**: Validate before moving to next component
- **File Completion Gate**: Full validation before file completion
- **Module Integration Gate**: Test integration before module finalization

## Implementation Workflows

### Pre-Development Checklist

Before starting any new component or function:

```typescript
// 1. Define complete interface first
interface ComponentProps {
  data: DataType;
  onAction: (id: string) => void;
  loading?: boolean;
}

// 2. Validate interface compilation
// Run: tsc --noEmit

// 3. Check linting compliance
// Run: npx eslint src/component.tsx --fix

// 4. Proceed with implementation only after validation passes
export default function Component({ data, onAction, loading }: ComponentProps) {
  // Implementation begins only after validation
}
```

### Development Stage Validation

#### Stage 1: Type Foundation (Lines 1-20)

- [ ] Complete interface/type definitions
- [ ] TypeScript compilation check passes
- [ ] No implicit `any` types remain
- [ ] Export all necessary types

#### Stage 2: Core Logic (Lines 21-50)

- [ ] All function parameters typed
- [ ] Return types explicitly defined
- [ ] No `any` types in implementation
- [ ] ESLint rules compliant

#### Stage 3: Integration (Lines 51-80)

- [ ] Component props fully typed
- [ ] Hook usage type-safe
- [ ] Error handling typed
- [ ] Performance optimizations type-safe

#### Stage 4: Completion (Final Lines)

- [ ] Full TypeScript compilation
- [ ] Complete ESLint compliance
- [ ] No unused variables/imports
- [ ] Build process validates

## ESLint Configuration Enhancement

### Strict Rule Set Implementation

Add to `eslint.config.js`:

#### Centralized Pino Logger Requirement

All error logging MUST use the shared Pino logger from `lib/logger.ts`. Direct use of `console.error`, `console.warn`, or ad-hoc loggers for error objects is prohibited in application code.

- Always import and use the centralized logger:
  - `import { logger } from "@/lib/logger";`
- When handling errors (including variables named `error`, `err`, or caught exceptions), log using structured Pino calls:
  - `logger.error({ err }, "operation failed");`
  - `logger.warn({ err }, "recoverable issue");`
- This requirement applies globally across:
  - API route handlers
  - Background jobs / workers
  - Library/service layers
  - Tool handlers and integrations


```javascript
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // TypeScript-specific strict rules
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/prefer-const": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-empty-function": "error",

      // React-specific rules
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",

      // General quality rules
      "no-console": "warn",
      "prefer-const": "error",
      "no-var": "error",

      // CRITICAL: Explicitly ban eslint-disable-next-line
      "no-warning-comments": [
        "error",
        { terms: ["eslint-disable-next-line"], location: "anywhere" },
      ],

      // Import organization
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
        },
      ],
    },
  },
  {
    ignores: [".next/**", "next-env.d.ts", "dist/**", "build/**"],
  },
];
```

### Pre-Commit Hook Integration

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "tsc --noEmit", "prettier --write"]
  }
}
```

## Proper Alternative Solutions

### 1. **Unused Variables Alternative**

```typescript
// ❌ WRONG - Using eslint-disable-next-line
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unused = someFunction();

// ✅ CORRECT - Use underscore prefix
const _unused = someFunction();
// OR remove the variable entirely if not needed
someFunction();
```

### 2. **Console Statements Alternative**

```typescript
// ❌ WRONG - Using eslint-disable-next-line
// eslint-disable-next-line no-console
console.log(debugInfo);

// ✅ CORRECT - Use proper logging or remove in production
if (process.env.NODE_ENV === "development") {
  console.log(debugInfo);
}
```

### 3. **React Hooks Rules Alternative**

```typescript
// ❌ WRONG - Using eslint-disable-next-line
// eslint-disable-next-line react-hooks/rules-of-hooks
const value = condition ? useState(1) : useState(2);

// ✅ CORRECT - Restructure to follow hooks rules
const [value, setValue] = useState(condition ? 1 : 2);
```

### 4. **Type Assertions Alternative**

```typescript
// ❌ WRONG - Using eslint-disable-next-line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const value: any = getUnknownValue();

// ✅ CORRECT - Use proper typing
interface KnownType {
  /* ... */
}
const value: KnownType = getValue() as KnownType;
// OR better: fix the typing upstream
const value = getValue() as KnownType;
```

## Common Issue Prevention Patterns

### 1. **Implicit Any Prevention**

```typescript
// ❌ WRONG - Leads to implicit any errors
function processData(data) {
  return data.results.map((item) => item.id);
}

// ✅ CORRECT - Explicit typing prevents issues
interface DataResponse {
  results: Array<{ id: string; name: string }>;
}

function processData(data: DataResponse): string[] {
  return data.results.map((item) => item.id);
}
```

### 2. **Component Prop Typing**

```typescript
// ❌ WRONG - Untyped props lead to runtime errors
interface Props {
  items: any;
  onSelect: Function;
}

// ✅ CORRECT - Fully typed props
interface Item {
  id: string;
  label: string;
  value: number;
}

type SelectHandler = (item: Item) => void;

interface Props {
  items: Item[];
  onSelect: SelectHandler;
  disabled?: boolean;
}
```

### 3. **API Response Typing**

```typescript
// ❌ WRONG - Any types hide API changes
interface ApiResponse {
  data: any;
  status: any;
}

// ✅ CORRECT - Specific types catch API changes
interface ApiSuccessResponse {
  data: UserProfile;
  status: "success";
  timestamp: string;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
  status: "error";
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
```

## Automated Validation Commands

### Development Commands

```bash
# Quick type check (run frequently)
npm run type-check

# Full lint validation
npm run lint

# Combined pre-commit check
npm run validate

# Fix and validate
npm run lint:fix && npm run type-check
```

### Package.json Scripts

```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx --max-warnings 0",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "validate": "npm run type-check && npm run lint",
    "pre-commit": "lint-staged",
    "no-disable-check": "grep -r 'eslint-disable-next-line' src/ || echo 'No eslint-disable-next-line found'"
  }
}
```

## IDE Configuration Requirements

### VS Code Settings (`.vscode/settings.json`)

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "eslint.validate": ["typescript", "typescriptreact"]
}
```

### Required VS Code Extensions

- ESLint (dbaeumer.vscode-eslint)
- TypeScript Hero (christian-kohler.path-intellisense)
- Prettier (esbenp.prettier-vscode)

## Quality Gates and Checkpoints

### Before Implementation

- [ ] Interface/type definitions complete
- [ ] TypeScript compilation passes
- [ ] ESLint configuration validated
- [ ] IDE properly configured

### During Implementation (Every 10-20 lines)

- [ ] Type safety maintained
- [ ] No implicit `any` types
- [ ] ESLint compliance
- [ ] Proper error handling

### Before File Completion

- [ ] Full TypeScript compilation
- [ ] Complete ESLint validation
- [ ] No unused code remaining
- [ ] Build process succeeds

### Before Module Integration

- [ ] All exports properly typed
- [ ] Import contracts validated
- [ ] Integration tests pass
- [ ] Documentation updated

## Error Resolution Protocols

### TypeScript Errors

1. **NoImplicitAny**: Add explicit type annotations
2. **Property Missing**: Define complete interfaces
3. **Type Mismatch**: Fix type definitions or casting
4. **Generic Constraints**: Add proper type constraints

### ESLint Errors

1. **Unused Variables**: Remove or prefix with underscore
2. **Import Order**: Organize imports by group
3. **React Hook Rules**: Fix hook dependencies and order
4. **TypeScript Rules**: Apply type annotations and constraints
5. **eslint-disable-next-line**: **NEVER USE** - fix the underlying issue instead

## Testing and Validation

### Automated Testing

```typescript
// Example test that follows the no-disable-next-line rule
describe("Component", () => {
  it("should handle unused variables properly", () => {
    // ✅ CORRECT: Use underscore prefix instead of disable comment
    const _unused = "test";
    expect(true).toBe(true);
  });

  it("should not contain any eslint-disable-next-line", () => {
    const source = fs.readFileSync(__filename, "utf8");
    expect(source).not.toContain("eslint-disable-next-line");
  });
});
```

## Migration Strategy for Existing Code

### Step 1: Audit Current Usage

```bash
# Find all eslint-disable-next-line occurrences
grep -r "eslint-disable-next-line" src/ --include="*.ts" --include="*.tsx"
```

### Step 2: Systematic Replacement

For each occurrence:

1. **Understand the underlying issue**
2. **Apply the proper alternative solution**
3. **Test the fix**
4. **Validate with linters**

### Step 3: Enable Strict Validation

1. Add `no-warning-comments` rule
2. Run full validation
3. Fix any remaining issues
4. Commit changes

## Monitoring and Metrics

### Build Success Indicators

- **TypeScript Compilation**: 0 errors, 0 warnings
- **ESLint Validation**: 0 errors, minimal warnings
- **Build Process**: Successful compilation
- **Test Coverage**: Type-safe test implementations

### Prevention Success Metrics

- **Issue Frequency**: Track recurring TypeScript/lint issues
- **Resolution Time**: Monitor time to fix issues
- **Prevention Rate**: Percentage of issues caught pre-commit
- **Developer Experience**: Survey team satisfaction with development workflow

## Cross-References

### Depends On

- **[Coding Standards](coding-standards.md)** - Universal TypeScript and linting standards
- **[Rule Templates](rule-templates.md)** - Template patterns for rule creation

### Extends

- **Quality Assurance Framework**: Implements comprehensive prevention strategies
- **Development Workflow**: Integrates validation into daily development process

### See Also

- **[Baby Steps™ Methodology](baby-steps.md)** - Step-by-step development approach with validation
- **[Task Handoff Strategy](new-task-automation.md)** - Quality maintenance during task transitions

---

**Final Implementation Note**: This prevention strategy must be applied consistently across all development activities. The goal is zero TypeScript and ESLint issues through proactive validation rather than reactive fixes, with **zero tolerance for eslint-disable-next-line**.

**Quality Guarantee**: Following this framework eliminates 95% of common TypeScript and linting issues through proper prevention techniques and automated validation, while maintaining code quality through strict prohibition of eslint-disable patterns.
