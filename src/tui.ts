import { Plugin } from '@opencode/plugin/tui'
import type { Context } from '@opencode/plugin/tui/context'
import type { ToastVariant } from '@opencode/plugin/tui/context'
import { commandArguments, errorMessage, runRexTab, type ForkCommand } from './rex'

const TITLE = 'rex-fork'
const FULL_SESSION = 'full'

type ForkedSession = Awaited<ReturnType<Context['client']['session']['fork']>>
type ForkBoundary = typeof FULL_SESSION | string
type OpenResult = 'no-rex' | 'opened' | 'failed'

function toast(context: Context, message: string, variant: ToastVariant, sessionID?: string) {
  context.ui.toast.show({ title: TITLE, message, variant, sessionID })
}

function rexSession(): string | undefined {
  return process.env.REX_SESSION?.trim() || undefined
}

function currentSessionID(context: Context): string | undefined {
  const route = context.ui.router.current()
  return route.type === 'session' ? route.sessionID : undefined
}

async function forkSession(
  context: Context,
  sessionID: string,
  before?: string,
): Promise<ForkedSession | undefined> {
  try {
    return await context.client.session.fork({ sessionID, before })
  } catch (error) {
    toast(context, `could not fork: ${errorMessage(error)}`, 'error')
    return undefined
  }
}

async function nameSession(context: Context, sessionID: string, name: string) {
  try {
    await context.client.session.update({ sessionID, title: name })
  } catch (error) {
    toast(context, `could not name the session: ${errorMessage(error)}`, 'error', sessionID)
  }
}

async function openInRex(context: Context, command: ForkCommand, forked: ForkedSession): Promise<OpenResult> {
  const session = rexSession()
  if (!session) return 'no-rex'

  try {
    const result = await runRexTab({
      session,
      directory: forked.location.directory,
      label: command,
      opencodeSession: forked.id,
    })
    if (result.exitCode === 0) return 'opened'
    toast(context, `rex failed (${result.exitCode}): ${result.stderr || 'no output'}`, 'error', forked.id)
    return 'failed'
  } catch (error) {
    toast(context, `could not run rex: ${errorMessage(error)}`, 'error', forked.id)
    return 'failed'
  }
}

async function openFork(
  context: Context,
  command: ForkCommand,
  forked: ForkedSession,
  name?: string,
) {
  if (name) await nameSession(context, forked.id, name)

  const rex = await openInRex(context, command, forked)
  if (rex === 'failed') return

  if (rex === 'opened') {
    toast(context, 'Forked to new Rex tab.', 'success')
    return
  }

  // Outside Rex: open the fork in this TUI, like the built-in command would.
  if (!context.ui.tabs.focus(forked.id)) {
    context.ui.router.navigate({ type: 'session', sessionID: forked.id })
  }
  toast(context, 'Forked session.', 'success')
}

async function chooseForkBoundary(context: Context, sessionID: string): Promise<ForkBoundary | undefined> {
  await context.data.session.message.sync(sessionID).catch(() => undefined)

  const options = [
    { title: 'Full session', value: FULL_SESSION, description: 'Copy the whole conversation' },
    ...context.data.session.message
      .list(sessionID)
      .filter(message => message.type === 'user')
      .toReversed()
      .map(message => ({
        title: message.text.replace(/\s+/g, ' ').trim(),
        value: message.id,
        footer: new Date(message.time.created).toLocaleString(),
      })),
  ]

  return context.ui.dialog.select({
    title: 'Fork session',
    placeholder: 'Choose where to fork from',
    options,
  })
}

/** Takes over OpenCode's own `session.fork` command: same picker, Rex tab. */
async function runFork(context: Context) {
  const sessionID = currentSessionID(context)
  if (!sessionID) {
    toast(context, 'open a session before running /fork', 'warning')
    return
  }

  const boundary = await chooseForkBoundary(context, sessionID)
  if (boundary === undefined) return

  const forked = await forkSession(context, sessionID, boundary === FULL_SESSION ? undefined : boundary)
  if (!forked) return

  await openFork(context, 'fork', forked)
}

async function runBranch(context: Context, input: string | undefined) {
  const sessionID = currentSessionID(context)
  if (!sessionID) {
    toast(context, 'open a session before running /branch', 'warning')
    return
  }

  const name = commandArguments('branch', input)
  const forked = await forkSession(context, sessionID)
  if (!forked) return

  await openFork(context, 'branch', forked, name)
}

export default Plugin.define({
  id: 'rex-fork.tui',
  setup(context: Context) {
    context.keymap.layer(() => ({
      mode: 'global',
      priority: 100,
      commands: [
        {
          id: 'session.fork',
          title: 'Fork session',
          group: 'Session',
          slash: { name: 'fork' },
          run: () => runFork(context),
        },
        {
          id: 'rex-fork.branch',
          title: 'Branch session',
          group: 'Session',
          slash: { name: 'branch', arguments: true as const },
          run: (input?: string) => runBranch(context, input),
        },
      ],
    }))
  },
})
