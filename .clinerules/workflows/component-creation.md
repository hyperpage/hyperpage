# Component Creation Workflow

This workflow creates new components following the architectural patterns from coding-principles.md and coding-style.md.

## Prerequisites
- Feature requirements documented
- Component purpose and scope defined
- Design requirements specified (dark mode, responsive behavior)

## Workflow Steps

### Step 1: PLAN MODE - Component Design

```xml
<ask_followup_question>
<question>What is the single responsibility of this new component?</question>
</ask_followup_question>
```

Analyze component placement and relationships:

```xml
<ask_followup_question>
<question>Which existing component should render this new component? Or should it be added at portal level?</question>
<options>["Add to existing component", "Create new top-level component", "This replaces existing functionality", "Dashboard-level addition"]</options>
</ask_followup_question>
```

### Step 2: Hook-First Pattern Implementation

Following "Hook-First Pattern" from coding-principles.md, start with custom hooks:

```xml
<ask_followup_question>
<question>What data does this component need? Does it require a custom hook following useToolData/useActivityData patterns?</question>
<options>["Needs custom hook - implements data fetching logic", "Uses existing hooks - direct prop passing", "Stateless component - no data fetching", "Local state only - React hooks sufficient"]</options>
</ask_followup_question>
```

If custom hook needed, examine existing patterns:

```xml
<read_file>
<path>app/components/hooks/useToolData.ts</path>
</read_file>
```

Create custom hook following patterns:

```xml
<write_to_file>
<path>app/components/hooks/use{ComponentName}Data.ts</path>
<content>
// Following Hook-First Pattern - extract complex stateful logic before component
// Per coding-principles.md: custom hooks for state management

import { useState, useEffect, useCallback } from 'react';

export interface Use{ComponentName}DataProps {{
  refreshInterval?: number;
  // Add component-specific props
}}

export interface Use{ComponentName}DataReturn {{
  data: any[]; // Replace with proper type
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}}

export function use{ComponentName}Data(props: Use{ComponentName}DataProps): Use{ComponentName}DataReturn {{
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {{
    setIsLoading(true);
    setError(null);
    try {{
      // Implement data fetching logic following API patterns
      const response = await fetch('/api/tools/{tool-name}/{endpoint}');
      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
    }} catch (err) {{
      setError('An error occurred while loading data');
      console.error('Data fetch error:', err);
    }} finally {{
      setIsLoading(false);
    }}
  }}, []);

  const refresh = useCallback(async () => {{
    await fetchData();
  }}, [fetchData]);

  useEffect(() => {{
    if (props.refreshInterval && props.refreshInterval > 0) {{
      const interval = setInterval(fetchData, props.refreshInterval);
      return () => clearInterval(interval);
    }}
  }}, [fetchData, props.refreshInterval]);

  useEffect(() => {{
    fetchData(); // Initial load
  }}, [fetchData]);

  return {{
    data,
    isLoading,
    error,
    refresh,
    lastUpdated
  }};
}}
</content>
</write_to_file>
```

### Step 4: Implement Main Component

Create component following "Presentation vs Logic" separation:

```xml
<read_file>
<path>app/components/MetricCard.tsx</path>
<offset>1</offset>
<length>30</length>
</read_file>
```

```xml
<write_to_file>
<path>app/components/{ComponentName}.tsx</path>
<content>
// Following component architecture patterns and shadcn/ui usage
"use client";

import React from "react";
import {{ Card, CardContent, CardHeader, CardTitle }} from "@/components/ui/card";
import {{ Button }} from "@/components/ui/button";
import {{ Skeleton }} from "@/components/ui/skeleton";
import {{ use{ComponentName}Data }} from "./hooks/use{ComponentName}Data";

interface {ComponentName}Props {{
  title?: string;
  className?: string;
  refreshInterval?: number;
  // Add component-specific props
}}

export const {ComponentName}: React.FC<{ComponentName}Props> = ({{
  title = "{Component Name}",
  className,
  refreshInterval = 300000, // 5 minutes default
  ...props
}}) => {{
  const {{ data, isLoading, error, refresh, lastUpdated }} = use{ComponentName}Data({{
    refreshInterval,
    ...props
  }});

  // Following "React.memo Optimization" for frequently re-rendering components
  return (
    <Card className={{`animate-fade-in-up ${{className || ""}}`}}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">{{title}}</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={{refresh}}
          disabled={{isLoading}}
        >
          {{isLoading ? "Refreshing..." : "Refresh"}}
        </Button>
      </CardHeader>
      <CardContent>
        {{error && (
          <div className="text-red-600 dark:text-red-400 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {{error}}
          </div>
        )}}

        {{isLoading && !data.length && (
          <div className="space-y-3">
            <Skeleton className="animate-shimmer h-4 w-full" />
            <Skeleton className="animate-shimmer h-4 w-3/4" />
            <Skeleton className="animate-shimmer h-4 w-1/2" />
          </div>
        )}}

        {{!isLoading && !error && (
          <div className="space-y-4">
            {/* Component-specific content following widget system patterns */}
            {{data.map((item, index) => (
              <div key={{item.id || index}} className="p-3 border rounded-lg">
                {/* Render component data following established patterns */}
              </div>
            ))}}
          </div>
        )}}

        {{lastUpdated && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Last updated: {{lastUpdated.toLocaleString()}}
          </div>
        )}}
      </CardContent>
    </Card>
  );
}};

// Apply React.memo for performance optimization per coding-principles.md
export default React.memo({ComponentName});
</content>
</write_to_file>
```

### Step 5: DARK MODE & RESPONSIVE TESTING

Test component appearance and behavior:

```xml
<execute_command>
<command>npm run dev</command>
<requires_approval>false</requires_approval>
</execute_command>
```

Validation checklist:
- [ ] Dark mode: Colors adapt properly using CSS custom properties
- [ ] Responsive: Works on mobile (< 768px), tablet, and desktop layouts
- [ ] Loading states: Shimmer animations and skeleton screens
- [ ] Error states: Clear error messaging without sensitive data
- [ ] Accessibility: Proper ARIA labels and keyboard navigation

### Step 6: INTEGRATION TESTING

Following "Component Size Limit" - verify component stays under 100 lines:

```xml
<execute_command>
<command>wc -l app/components/{ComponentName}.tsx</command>
<requires_approval>false</requires_approval>
</execute_command>
```

Performance check - ensure no unnecessary re-renders:

```xml
<execute_command>
<command>npm run build</command>
<requires_approval>true</requires_approval>
</execute_command>
```

### Step 7: TYPE SAFETY VALIDATION

```xml
<execute_command>
<command>npx tsc --noEmit</command>
<requires_approval>false</requires_approval>
</execute_command>
```

Confirm TypeScript compilation:
- [ ] No type errors
- [ ] Proper interface usage
- [ ] Generic types correctly applied
- [ ] Component props fully typed

### FINAL VALIDATION CHECKLIST

```xml
<ask_followup_question>
<question>Does the component pass all architectural requirements?</question>
<options>["All checks pass - production ready", "Minor style issues - easily fixable", "Requires architectural changes", "Component too large - needs decomposition"]</options>
</ask_followup_question>
```

If all validations pass, component is ready for integration following the project's workflow patterns.
