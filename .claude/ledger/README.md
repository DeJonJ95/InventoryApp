# InventoryApp — Step Ledger

Each atomic task step is recorded here instead of kept in chat context.
This keeps context small and makes work resumable across sessions.

## File format
```markdown
# Step NNN: <action>

## Context
<what and why — 1-2 sentences>

## Input
<files changed, commands run, data referenced>

## Result
<pass | fail | partial — what happened>

## Next
<what to do next — if partial, what's left>
```

## Conventions
- Sequential numbering per session (reset each major feature cycle)
- Date prefix for chronological sorting: `YYYY-MM-DD--NNN--short-desc.md`
- Close each entry with result + next step before moving on