# Telegram templates

Concord never sends messages. It builds the text; Admin copies it and pastes it into Telegram.

**Placeholders:** `[Staff Name]` (the discussion owner), `[Topic]` (discussion title), `[Checklist Item]` (one message per unfinished item; "the overall status" if there are none).

**When prompts appear** (⚙ Settings → Telegram prompts, with a number badge on the gear)

| Prompt | Appears when | Setting that controls it |
|---|---|---|
| Gathering check | Status is Gathering and today ≥ D-date − 2 days | `gather_prompt_days_before` |
| Implementation check | Status is Agreed/Approved and today ≥ decision date + 7 days | `impl_check_days_after` |

A prompt disappears by itself when the status changes. If the D-date changes, the due date moves with it.

**Default texts** (edit them in Settings → App settings and templates)

Gathering check:
```
Good day [Staff Name],

Just checking in on [Topic], specifically: [Checklist Item].
Are we on track with this? Is there anything I can help with?
```

Implementation check:
```
Good day [Staff Name],

Following up on [Topic], specifically: [Checklist Item].
It has been a week since this was agreed/approved. Has it been implemented or resolved? Is there anything I can help with?
```
