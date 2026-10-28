# skills/learnharness

## Overview

A shipped, self-contained agent skill (AGPL-3.0-only, see `LICENSE`) that
teaches an AI assistant how to read and interpret a person's local
LearnHarness learning data: teaching and practice sessions, answers,
confidence, learner thinking, and the knowledge graph of propositions and
reasoning chains. `SKILL.md` is the field guide and the entry point; it
documents the two kinds of evidence (sessions vs. graph), the strict read-only
boundary, how to locate the data folder per OS, and how to invoke the bundled
readers. `references/data-format.md` describes the on-disk file map and
record shapes. `scripts/` holds the stdlib-only Python readers.

This directory has no code of its own and no dependency on the application
in `src/`; it must keep working from a copy placed anywhere on disk. The
skill must never modify, migrate, index, or write back to the data folder.

## Subdirectories & Boundaries

- SKILL.md: [./SKILL.md](./SKILL.md) - frontmatter (`name: learnharness`,
  `compatibility: Python 3.10+`, stdlib only) plus the usage guide, the
  read-only boundary, per-OS data-folder defaults, and reader examples.
- scripts: [./scripts/CLAUDE.md](./scripts/CLAUDE.md) - `_data.py`
  (data-dir resolution, safe paths, JSON loading), `sessions.py`
  (`list`, `read`), `graph.py` (`sessions`, `propositions`, `find`,
  `chains`); Markdown or JSON to stdout, read-only, format v1 only.
- references: `data-format.md` - file map, message/answer shapes, graph
  merging rules, and interpretation pitfalls (documentation only; no
  contract).
- LICENSE: GNU AGPL v3 text covering the skill.
