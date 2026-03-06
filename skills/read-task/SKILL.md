---
name: read-task
description: Read a task markdown file and return its contents as structured JSON for a worker agent
triggers:
  - read task
  - parse task
  - load task
  - task file
argument-hint: "<task_file_path>"
---

# Read Task

## Purpose

Read a single task markdown file and return its contents as structured JSON. Designed to be the first thing a worker agent calls when it receives a task delegation.

## When to Activate

- Agent receives a task delegation with a path to a task markdown file
- Agent needs to understand task requirements before starting implementation

## Workflow

Read the task markdown file at: $ARGUMENTS

1. Read the file at the path provided above. If the file does not exist or the path is empty, return this JSON and stop:
   ```json
   {"error": "File not found or no path provided", "path": "<the path>"}
   ```

2. Parse the markdown file to extract these sections. Match headings case-insensitively and flexibly (e.g., "## Acceptance Criteria", "## acceptance criteria", "# Acceptance Criteria" all match). Extract content from under each heading until the next heading.

3. Extract these fields:
   - **task_id**: From a "Task ID" heading, frontmatter `task_id:` field, or a line like `**Task ID:** XXXX` near the top
   - **title**: The first `#` heading, or a `**Title:**` field
   - **phase**: From a "Phase" heading or `**Phase:**` field
   - **feature_area**: From a "Feature Area" heading or `**Feature Area:**` field
   - **priority**: From a "Priority" heading or `**Priority:**` field
   - **dependencies**: From a "Dependencies" heading or `**Dependencies:**` field. Parse as an array of task ID strings. If the value is "None", "N/A", or empty, return `[]`
   - **description**: From a "Description" heading. Return as a single string preserving paragraph breaks
   - **acceptance_criteria**: From an "Acceptance Criteria" heading. Parse bullet points / numbered items into an array of strings. Strip leading `- `, `* `, or `1. ` prefixes
   - **testing_requirements**: From a "Testing Requirements" or "Testing" heading. Parse bullet points into an array of strings, same as acceptance criteria
   - **relevant_context**: From a "Relevant Context", "Context", or "Notes" heading. Return as a single string

4. For any field not found in the file, use `null` for strings, `[]` for arrays.

5. Return ONLY the JSON object below with no additional commentary, no markdown code fences, no explanation. Raw JSON only:

```
{
  "task_id": "string or null",
  "title": "string or null",
  "phase": "string or null",
  "feature_area": "string or null",
  "priority": "string or null",
  "dependencies": ["array", "of", "task_ids"],
  "description": "string or null",
  "acceptance_criteria": ["array", "of", "strings"],
  "testing_requirements": ["array", "of", "strings"],
  "relevant_context": "string or null"
}
```

## Notes

- This is a READ-ONLY operation. Never modify the task file.
- Keep the output lean. Do not add fields beyond what is specified above.
- Preserve the original text content faithfully. Do not summarize or rephrase.
