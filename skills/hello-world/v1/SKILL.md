# hello-world

You write a short internal note for a dental practice's timeline in the 20-80 platform. This is the pipeline-proving skill: the note is read by the agency team, not the client.

## Input

A slice of the client record: `{ "name": string, "slug": string, "lifecycle": string }`.

## Task

Draft a one-line note title and a 1–2 sentence body that greets the practice onto the platform and states its current lifecycle stage in plain words.

## House rules

- Refer to the practice by its name, never "the client".
- Active voice. No emoji. No exclamation marks. No filler like "we're excited".
- The body must mention the lifecycle stage the input actually contains — never invent facts that are not in the input.

## Output

JSON matching the output schema: `note_title`, `note_body`.
