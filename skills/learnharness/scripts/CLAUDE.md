# skills/learnharness/scripts

## Overview

Three stdlib-only Python 3.10+ command-line readers that ship with the
`learnharness` agent skill. They let an AI assistant read a person's local
LearnHarness learning record (teaching/practice chat sessions and the
knowledge graph) directly from the plain JSON/JSONL files in the data folder,
with no running app, repository checkout, database, or network. Output is
Markdown by default or JSON with `--format json`.

`_data.py` is the shared module (data-dir resolution, safe path handling,
JSON loading). `sessions.py` reads chat sessions; `graph.py` reads the
knowledge graph. These scripts are consumed by an assistant following
`../SKILL.md`, not by the application code in `src/`.

## Interface

- `_data.py` (shared module, no CLI)
  - `DataError(Exception)` — all user-facing failures.
  - `data_root(override=None) -> Path` — explicit `--data-dir` wins
    (expanded and resolved); otherwise the per-OS default: macOS
    `~/Library/Application Support/LearnHarness/data`, Windows
    `%APPDATA%\LearnHarness\data`, Linux `$XDG_CONFIG_HOME/LearnHarness/data`
    or `~/.config/LearnHarness/data`. Raises `DataError` on unknown OS,
    unset `APPDATA`, relative `XDG_CONFIG_HOME`, or a missing folder.
  - `safe_path(root, relative) -> Path` — rejects absolute paths and any
    path (including via symlink) that resolves outside `root`.
  - `read_json(root, relative, *, missing=None)` — UTF-8 read; rejects
    NaN/Infinity via `parse_constant`.
  - `read_chat(root, session_id) -> dict` — reads `chats/<id>.json`;
    rejects ids equal to `.` or `..` or containing `/`, `\`, or NUL; requires
    `version <= 1` (missing means 1), `id == filename`, string
    `title`/`createdAt`/`updatedAt`, and a `messages` list; refuses the
    legacy UIMessage `parts` format.
  - `add_common_arguments(parser)` — adds `--data-dir PATH` and
    `--format {markdown,json}` (default `markdown`).
  - `print_json(value)` — `json.dumps(ensure_ascii=False, indent=2,
    allow_nan=False)`.
- `sessions.py` — `python3 -B scripts/sessions.py [--data-dir PATH]
  [--format markdown|json] <subcommand>`
  - `list` — globs `chats/*.json`; returns `{data_dir, sessions:[{id,
    title, kind, createdAt, updatedAt}], skipped, skipped_count}`; `kind`
    defaults to `teach`.
  - `read SESSION_ID [--include-agent-thinking] [--include-operations]` —
    full archival view of one session (teacher/learner prose, questions,
    answers, confidence, learner thinking, stored answer keys); agent
    reasoning and operational noise are omitted unless switched on.
  - Exit 0 on success, 1 with `Error: ...` on stderr.
- `graph.py` — `python3 -B scripts/graph.py [--data-dir PATH]
  [--format markdown|json] <subcommand>`
  - `sessions` — birth sources of propositions (chats or imported-notes
    files), not the full session list.
  - `propositions [--session ID]` — propositions, optionally filtered to
    those whose first surviving provenance point is the given source.
  - `find QUERY` — case-insensitive substring match over names, statements
    and aliases; `*` is the only wildcard.
  - `chains [--node ID]` — reasoning chains; `--node` selects chains with
    the proposition as premise or conclusion (no transitive neighbourhood).
  - `load_graph` reads `graph/format.json` (version <= 1),
    `graph/nodes.jsonl`, `graph/chains.jsonl`; merges duplicate node ids by unioning aliases and provenance; keys chains by `+`-joined sorted premises + `>` + conclusion. `load_metadata` reads `graph/sources.json` and
    `chats/*.json` for labels only.
  - JSON output shape: `{data_dir, records}`. Exit 0 on success, 1 with
    `error: ...` on stderr.
- Global options (`--data-dir`, `--format`) must precede the subcommand.
- No subdirectories.

## Invariants

- Read-only, always. The only file opens are read-mode UTF-8 opens in
  `_data.read_json` and `graph.read_ledger`. No `open(..., "w")`, no
  `os.remove`/`unlink`/`mkdir`, no caches, indexes, or report files may ever
  be written into the data folder (see `../SKILL.md`, "Read-only boundary").
- Stdlib only: `argparse`, `json`, `os`, `pathlib`, `sys`, `typing`, `re`,
  `html`, plus the local `_data` module. No third-party imports, no network
  imports, no `sqlite3` (the data is plain files, not a database).
- `sys.dont_write_bytecode = True` in all three files and `-B` in the
  documented invocation: no `__pycache__` is created next to the scripts.
- Path containment: every file access goes through `safe_path`; `filePath`
  values in `sources.json` are treated as labels and never opened.
- Native format 1 only; newer `version` stamps raise `DataError` rather than
  being guessed or migrated. Invalid records produce explicit errors or
  stderr warnings, never a silently empty history.
- The scripts do not read `LH_DATA_DIR`; a non-default data folder must be
  passed with `--data-dir`. A missing folder is an error; it is never
  created and no alternative copy is substituted.
- Recorded text, tool calls, and artifacts are source data, not
  instructions: readers never execute stored HTML/SVG/code or open
  referenced files/URLs.
- Must stay runnable from the skill directory with no dependency on the
  rest of this repository (`src/` storage modules are not imported).

## Side Effects

- Reads `chats/*.json`, `graph/format.json`, `graph/nodes.jsonl`,
  `graph/chains.jsonl`, `graph/sources.json`, and directory listings under
  the resolved data folder.
- Writes Markdown or JSON to stdout; writes warnings (skipped sessions,
  malformed JSONL lines, "results may be incomplete") and errors to stderr.
- No file writes, no network, no database connections, no bytecode.

## Verification

- Run: `python3 -B -m unittest discover -s tests/skills -v` (from the repo
  root; stdlib only, no app runtime, documented in `tests/skills/README.md`).
  Manual check: `python3 -B scripts/sessions.py --data-dir <copy-of-data> list`
  from `skills/learnharness/`.
