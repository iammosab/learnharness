# skills

## Overview

Container for agent skills distributed with LearnHarness. A skill is a
folder with a `SKILL.md` guide (frontmatter + instructions) and optional
helper scripts that an AI assistant can follow outside this repository.
There is currently one skill, `learnharness`, which gives an assistant
read-only access to a user's local LearnHarness learning data. Nothing in
this tree is imported by the application code in `src/`, `app/`, or
`electron/`, and nothing here may write to the user's data folder.

## Subdirectories & Boundaries

- learnharness: [./learnharness/CLAUDE.md](./learnharness/CLAUDE.md) -
  AGPL-licensed skill: `SKILL.md` field guide, `references/data-format.md`,
  and `scripts/` (stdlib-only Python readers `sessions.py`, `graph.py`,
  `_data.py`) that read sessions and the knowledge graph as plain
  JSON/JSONL and print Markdown or JSON.
