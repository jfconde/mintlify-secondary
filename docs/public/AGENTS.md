> For Mintlify product knowledge (components, configuration, writing standards),
> install the Mintlify skill: `npx skills add https://mintlify.com/docs`

# Documentation project instructions

## About this project

- This is part of a documentation site built on [Mintlify](https://mintlify.com)
  - The main repo lives at https://github.com/jfconde/mintlify-burner
  - Configuration lives in `docs.json`
  - `docs.json` is used for preview and generation. For generation, the elements with a "refId" field are extracted
  and merged in the target repository's docs.json, replacing the existing/original hierarchy for that "refId".
  - Guides in ./web-sdk and images in ./images/web-sdk are copied to the same paths in the target repository.
- Pages are MDX files with YAML frontmatter
- Use the Mintlify MCP server, `https://mcp.mintlify.com`, to edit content and settings via MCP
- Use the Mintlify docs MCP server, `https://www.mintlify.com/docs/mcp`, to query information about using Mintlify via MCP

## Terminology

{/* Add product-specific terms and preferred usage */}
{/* Example: Use "workspace" not "project", "member" not "user" */}

## Style preferences

{/* Add any project-specific style rules below */}

- Use active voice and second person ("you")
- Keep sentences concise — one idea per sentence
- Use sentence case for headings
- Bold for UI elements: Click **Settings**
- Code formatting for file names, commands, paths, and code references

## Content boundaries

{/* Define what should and shouldn't be documented */}
{/* Example: Don't document internal admin features */}
