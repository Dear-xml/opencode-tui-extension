import { readFileSync, watch } from "node:fs"
import { join } from "node:path"
import { createSignal, type Accessor } from "solid-js"
import { SLOT_DIR, POLL_MS } from "./constants.js"

export function readSlotFile(directory: string, name: string, fallback: string): string[] {
  let text: string
  try {
    text = readFileSync(join(directory, SLOT_DIR, name), "utf8")
  } catch {
    return [fallback]
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function firstLine(lines: string[]): string {
  return lines[0] ?? ""
}

export function useSlotLines(
  directory: () => string,
  name: string,
  fallback: string,
  onDispose: (fn: () => void) => void,
): Accessor<string[]> {
  const [lines, setLines] = createSignal(readSlotFile(directory(), name, fallback))
  const refresh = () => setLines(readSlotFile(directory(), name, fallback))
  const timer = setInterval(refresh, POLL_MS)
  onDispose(() => clearInterval(timer))
  let pending: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    if (pending) clearTimeout(pending)
    pending = setTimeout(refresh, 50)
  }
  onDispose(() => {
    if (pending) clearTimeout(pending)
  })
  try {
    const watcher = watch(join(directory(), SLOT_DIR), { persistent: false }, () => schedule())
    onDispose(() => watcher.close())
  } catch {}
  return lines
}
