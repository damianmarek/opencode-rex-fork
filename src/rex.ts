import { spawn } from 'node:child_process'

export const FORK_COMMANDS = ['fork', 'branch'] as const

export type ForkCommand = (typeof FORK_COMMANDS)[number]

export interface RexTabInput {
  readonly session: string
  readonly directory: string
  readonly label: ForkCommand
  readonly opencodeSession: string
}

export interface RexTabResult {
  readonly exitCode: number | null
  readonly stderr: string
}

/** `/fork fix the tests` -> `fix the tests` */
export function commandArguments(command: ForkCommand, input: string | undefined): string {
  const text = (input ?? '').trim()
  const prefix = `/${command}`
  return text.startsWith(prefix) ? text.slice(prefix.length).trim() : text
}

/** Builds the argv that opens the forked OpenCode session in a new Rex tab. */
export function rexTabArguments(input: RexTabInput): string[] {
  return [
    'run',
    '-s',
    input.session,
    '-c',
    input.directory,
    '--label',
    input.label,
    '--',
    'opencode',
    '--session',
    input.opencodeSession,
  ]
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Opens the forked session in a new Rex tab and waits for `rex run` to exit. */
export function runRexTab(input: RexTabInput): Promise<RexTabResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('rex', rexTabArguments(input), {
      env: process.env,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('close', exitCode => resolve({ exitCode, stderr: stderr.trim() }))
  })
}
