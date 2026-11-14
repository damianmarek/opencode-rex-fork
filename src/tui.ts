import { Plugin } from '@opencode/plugin/tui'
import type { Context } from '@opencode/plugin/tui/context'
import type { ToastVariant } from '@opencode/plugin/tui/context'
import { FORK_COMMANDS, commandArguments, errorMessage, runRexTab, type ForkCommand } from './rex'

const TITLE = 'rex-fork'

type ForkedSession = Awaited<ReturnType<Context['client']['session']['fork']>>
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

async function forkSession(context: Context, sessionID: string): Promise<ForkedSession | undefined> {
  try {
    return await context.client.session.fork({ sessionID })
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

async function sendPrompt(context: Context, sessionID: string, text: string) {
  if (!text) return
  try {
    await context.client.session.prompt({ sessionID, text })
  } catch (error) {
    toast(context, `could not send the prompt: ${errorMessage(error)}`, 'error', sessionID)
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

async function runCommand(context: Context, command: ForkCommand, input: string | undefined) {
  const sessionID = currentSessionID(context)
  if (!sessionID) {
    toast(context, `open a session before running /${command}`, 'warning')
    return
  }

  const argument = commandArguments(command, input)
  const forked = await forkSession(context, sessionID)
  if (!forked) return

  if (command === 'branch' && argument) {
    await nameSession(context, forked.id, argument)
  }

  const rex = await openInRex(context, command, forked)
  if (rex === 'failed') return

  if (rex === 'opened') {
    if (command === 'fork') await sendPrompt(context, forked.id, argument)
    toast(context, 'Forked to new Rex tab.', 'success')
    return
  }

  // Outside Rex: open the fork in this TUI, like the built-in command would.
  if (!context.ui.tabs.focus(forked.id)) {
    context.ui.router.navigate({ type: 'session', sessionID: forked.id })
  }
  if (command === 'fork') await sendPrompt(context, forked.id, argument)
  toast(context, 'Forked session.', 'success')
}

export default Plugin.define({
  id: 'rex-fork.tui',
  setup(context: Context) {
    context.keymap.layer(() => ({
      mode: 'global',
      commands: FORK_COMMANDS.map(command => ({
        id: `rex-fork.${command}`,
        title:
          command === 'fork'
            ? 'Fork conversation in a new Rex tab'
            : 'Branch conversation in a new Rex tab',
        group: 'Rex',
        slash: { name: command, arguments: true as const },
        run: (input?: string) => runCommand(context, command, input),
      })),
    }))
  },
})
