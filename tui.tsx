/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { Show, For } from "solid-js"
import { DEFAULT_STATUS, DEFAULT_SIDEBAR, STATUS_FILE, SIDEBAR_FILE } from "./common/constants.js"
import { firstLine, useSlotLines } from "./common/utils.ts"

export default Plugin.define({
  id: "opencode-tui-extension",
  setup(context) {
    const disposers: (() => void)[] = []
    const directory = () => {
      const loc = context.location ?? context.data.location.default()
      return loc.directory || process.cwd()
    }
    const theme = context.theme as {
      text?: { base?: string; muted?: string }
      textMuted?: string
      text?: string
    }
    const muted = () => theme?.text?.muted ?? theme?.textMuted
    const base = () => theme?.text?.base ?? theme?.text

    const onDispose = (fn: () => void) => {
      disposers.push(fn)
    }
    const statusLines = useSlotLines(directory, STATUS_FILE, DEFAULT_STATUS, onDispose)
    const sidebarLines = useSlotLines(directory, SIDEBAR_FILE, DEFAULT_SIDEBAR, onDispose)

    const banner = () => (
      <Show when={firstLine(statusLines())}>
        {(text) => (
          <box flexDirection="row" flexShrink={0} gap={1}>
            <text fg={muted()}>status:</text>
            <text fg={base()}>{text()}</text>
          </box>
        )}
      </Show>
    )
    const sidebar = () => (
      <Show when={sidebarLines().length > 0}>
        {() => (
          <box>
            <text fg={base()}>
              <b>Extension</b>
            </text>
            <For each={sidebarLines()}>{(line) => <text fg={muted()}>{line}</text>}</For>
          </box>
        )}
      </Show>
    )

    const slots = [
      context.ui.slot({ append: "prompt.footer.status", render: banner }),
      context.ui.slot({ append: "sidebar.content", render: sidebar }),
    ]
    for (const un of slots) if (typeof un === "function") disposers.push(un)

    return () => {
      for (const dispose of disposers) dispose()
    }
  },
})
