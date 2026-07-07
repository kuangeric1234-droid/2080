/* Connector interfaces for W2 (SPEC-INBOX §4 + MASTER-BUILD-PLAN §3.5).
   Connectors are the only things that will hold vendor credentials; skills
   and pipeline code see these capped surfaces only.

   PROVISIONAL (BLOCKERS.md: gmail-oauth, activecollab-token): the mock
   implementations below stand in behind the real interfaces until
   credentials arrive. They fake nothing outward — sent mail and created
   tasks are recorded locally and clearly mock-prefixed. */

export interface RawEmail {
  messageId: string
  threadId?: string | null
  from: string
  to?: string
  subject: string
  bodyText: string
  headers?: Record<string, string>
  receivedAt?: string
}

export interface OutboundMail {
  to: string
  subject: string
  body: string
  inReplyTo?: string | null // thread id, for correct In-Reply-To/References
}

export interface MailSender {
  send(mail: OutboundMail): Promise<{ providerMessageId: string }>
}

export interface TaskConnector {
  createTask(task: {
    title: string
    clientName: string
    dueAt: Date | null
    assignee: string | null
  }): Promise<{ externalRef: string }>
}

/** Records instead of sending — the real Gmail send-as connector replaces
    this when OAuth credentials land. */
export class MockMailSender implements MailSender {
  sent: OutboundMail[] = []
  async send(mail: OutboundMail): Promise<{ providerMessageId: string }> {
    this.sent.push(mail)
    return { providerMessageId: `mock-gm-${this.sent.length}` }
  }
}

/** Records instead of calling ActiveCollab — replaced when the API token lands. */
export class MockActiveCollab implements TaskConnector {
  created: Array<{ title: string; clientName: string; dueAt: Date | null; assignee: string | null }> = []
  async createTask(task: {
    title: string
    clientName: string
    dueAt: Date | null
    assignee: string | null
  }): Promise<{ externalRef: string }> {
    this.created.push(task)
    return { externalRef: `mock-ac-${this.created.length}` }
  }
}

export interface InboxConnectors {
  mail: MailSender
  tasks: TaskConnector
}

/** SPEC-INBOX §3: never ack an autoreply (loop risk). */
export function isAutoReply(headers: Record<string, string> = {}): boolean {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]))
  return (
    (h['auto-submitted'] != null && h['auto-submitted'] !== 'no') ||
    h['x-autoreply'] === 'yes' ||
    h['x-auto-response-suppress'] != null ||
    h['precedence'] === 'bulk' ||
    h['precedence'] === 'auto_reply'
  )
}

/** SPEC-INBOX §3/§4: classify only the new content — strip quoted replies. */
export function stripQuotedText(body: string): string {
  const lines = body.split(/\r?\n/)
  const kept: string[] = []
  for (const line of lines) {
    if (/^On .{5,80} wrote:\s*$/.test(line.trim())) break
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break
    if (line.trimStart().startsWith('>')) continue
    kept.push(line)
  }
  return kept.join('\n').trim()
}
