import { Plugin } from '@opencode/plugin'

// The server part is intentionally empty. It exists so one `plugins` entry in
// opencode.json(c) loads the TUI part that implements /fork and /branch.
export default Plugin.define({
  id: 'rex-fork',
  setup() {},
})
