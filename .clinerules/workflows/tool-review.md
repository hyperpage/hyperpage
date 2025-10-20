# Tool Review Workflow

This workflow validates newly added tools against project requirements and architectural standards from coding-principles.md.

## Prerequisites
- Tool has been added via add-new-tool.md workflow
- Environment variables configured in .env.local
- Basic tool structure exists

## Validation Checklist

### Architecture Compliance

```xml
<read_file>
<path>tools/{tool-name}/index.ts</path>
</read_file>
```

Verify tool follows registry-driven pattern:
- [ ] Exports tool object with required properties (name, isEnabled, capabilities, handlers, widgets)
- [ ] Environment-controlled enablement check
- [ ] Server-side API client with error handling
- [ ] Generic error messages (no implementation details exposed)

### TypeScript Standards

```xml
<read_file>
<path>tools/{tool-name}/types.ts</path>
</read_file>
```

Check type definitions:
- [ ] Tool-specific interfaces defined in tools/[tool]/types.ts
- [ ] ApiParams, Response, ActivityItem interfaces present
- [ ] Capabilities type correctly defined as union of 'dashboard' | 'activity'
- [ ] Proper TypeScript typing without any

### Handler Implementation

```xml
<search_files>
<path>.</path>
<regex>const handlers =</regex>
<file_pattern>tools/{tool-name}/index.ts</file_pattern>
</search_files>
```

Validate handlers structure:
- [ ] Handler functions match capability declarations
- [ ] Error boundaries with try/catch blocks
- [ ] Server-side credential access only
- [ ] No hardcoded logic - leverages configurations

### Widget System Compliance

```xml
<read_file>
<path>tools/{tool-name}/index.ts</path>
<offset>100</offset>
<length>50</length>
</read_file>
```

Check widget definitions:
- [ ] Dynamic flag appropriately set
- [ ] refreshInterval configured (reasonable values)
- [ ] Loading states and error handling
- [ ] Data binding follows component patterns

### Activity System Integration (If Applicable)

```xml
<search_files>
<path>.</path>
<regex>ActivityItem</regex>
<file_pattern>tools/{tool-name}/types.ts</file_pattern>
</search_files>
```

Validate activity events (if tool supports activity):
- [ ] Required fields: id, type, title, author, url, displayId, timestamp
- [ ] Optional metadata: repository, branch, status, labels, assignee
- [ ] Proper data transformation from API response
- [ ] URL construction per tool-specific patterns

### Registration Verification

```xml
<read_file>
<path>tools/index.ts</path>
</read_file>
```

Confirm proper registration:
- [ ] Tool imported in tools/index.ts
- [ ] Added to registry array
- [ ] Follows import naming conventions

### Environment Configuration

```xml
<read_file>
<path>.env.local.sample</path>
</read_file>
```

Validate environment setup:
- [ ] ENABLE_TOOL_NAME=false variable present
- [ ] API credentials placeholders added
- [ ] Web URL and token configurations
- [ ] Security-aware variable naming

### API Endpoint Testing

Test the tool endpoints (requires environment config):

```xml
<execute_command>
<command>curl -X GET "http://localhost:3000/api/tools/{tool-name}/dashboard" -H "Content-Type: application/json"</command>
<requires_approval>false</requires_approval>
</execute_command>
```

Verify API responses:
- [ ] Endpoint returns 200 status
- [ ] Response matches expected structure
- [ ] Data accessible at configured dataKey
- [ ] No sensitive information leaked

### Widget Rendering

```xml
<execute_command>
<command>npm run dev</command>
<requires_approval>false</requires_approval>
</execute_command>
```

Validate UI integration:
- [ ] Tool appears in enabled tools list
- [ ] Widgets render in dashboard
- [ ] Sidebar shows tool status
- [ ] Dark mode compatibility
- [ ] Responsive behavior (mobile/desktop)

## Final Checklist Status

Use this workflow to mark completion and document any findings:

```xml
<ask_followup_question>
<question>Does the new tool pass all validation checks? If not, what issues were identified?</question>
<options>["Passes all validations - ready for production", "Minor issues found - needs fixes", "Major issues found - requires architectural revision", "Blocked - environment configuration missing"]</options>
</ask_followup_question>
```

### Documentation Updates

If tool passes validation, update documentation:

```xml
<ask_followup_question>
<question>Does this tool require README.md configuration documentation updates?</question>
<options>["Yes - add to configuration examples", "No - already documented"]</options>
</ask_followup_question>
```

### Integration Testing

```xml
<execute_command>
<command>npm run build</command>
<requires_approval>true</requires_approval>
</execute_command>
```

Validate production readiness:
- [ ] Build completes without errors
- [ ] TypeScript compilation successful
- [ ] No security vulnerabilities introduced
- [ ] Performance impact acceptable
