/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { Show, For, type Accessor } from "solid-js"
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { DEFAULT_STATUS, DEFAULT_SIDEBAR, STATUS_FILE, SIDEBAR_FILE } from "../common/constants.js"
import { firstLine, useSlotLines } from "../common/utils.ts"

function Banner(props: { api: TuiPluginApi; lines: Accessor<string[]> }) {
  const theme = () => props.api.theme.current
  return (
    <Show when={firstLine(props.lines())}>
      {(text) => (
        <box flexDirection="row" flexShrink={0} paddingLeft={2} gap={1}>
          <text fg={theme().textMuted}>status:</text>
          <text fg={theme().text}>{text()}</text>
        </box>
      )}
    </Show>
  )
}

function SidebarBlock(props: { api: TuiPluginApi; lines: Accessor<string[]> }) {
  const theme = () => props.api.theme.current
  return (
    <Show when={props.lines().length > 0}>
      {() => (
        <box>
          <text fg={theme().text}>
            <b>Extension</b>
          </text>
          <For each={props.lines()}>
            {(line) => <text fg={theme().textMuted}>{line}</text>}
          </For>
        </box>
      )}
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  try {
    const dir = join(homedir(), ".config", "opencode")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "opencode-tui-extension.loaded.json"), JSON.stringify({ time: Date.now() }))
  } catch {}
  const onDispose = (fn: () => void) => {
    api.lifecycle.onDispose(fn)
  }
  const directory = () => api.state.path.directory || process.cwd()
  const statusLines = useSlotLines(directory, STATUS_FILE, DEFAULT_STATUS, onDispose)
  const sidebarLines = useSlotLines(directory, SIDEBAR_FILE, DEFAULT_SIDEBAR, onDispose)
  api.slots.register({
    order: 100,
    slots: {
      app_bottom() {
        return <Banner api={api} lines={statusLines} />
      },
      sidebar_content() {
        return <SidebarBlock api={api} lines={sidebarLines} />
      },
    },
  })
}

export default { id: "opencode-tui-extension", tui }
