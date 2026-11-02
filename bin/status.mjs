#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"
import os from "node:os"
import { SLOT_DIR, STATUS_FILE, SIDEBAR_FILE, DEFAULT_STATUS, DEFAULT_LABEL } from "../common/constants.js"

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const V1_ENTRY = path.join(PKG_ROOT, "v1", "entry.tsx")
const V2_ENTRY = path.join(PKG_ROOT, "tui.tsx")
const CONFIG_DIR = process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), ".config", "opencode")
const V1_CONFIG = process.env.OPENCODE_TUI_CONFIG || path.join(CONFIG_DIR, "tui.json")
const V2_CONFIG = path.join(CONFIG_DIR, "cli.json")
const MARKER = path.join(CONFIG_DIR, "opencode-tui-extension.loaded.json")

function sh(cmd, args, options = {}) {
  try {
    if (process.platform === "win32") {
      return execFileSync("cmd.exe", ["/c", cmd, ...args], { encoding: "utf8", timeout: 15000, ...options })
    }
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 15000, ...options })
  } catch {
    return ""
  }
}

function npmBin() {
  return process.platform === "win32" ? "npm.cmd" : "npm"
}

function ensureLinked() {
  const root = sh(npmBin(), ["root", "-g"]).trim()
  if (!root) return "npm not found; install manually via npm i -g or npm link"
  const target = path.join(root, "opencode-tui-extension")
  if (existsSync(target)) return `already available: ${target}`
  sh(npmBin(), ["install", "-g", "opencode-tui-extension"], { timeout: 120000 })
  if (existsSync(target)) return `installed: ${target}`
  sh(npmBin(), ["link"], { cwd: PKG_ROOT, timeout: 120000 })
  return existsSync(target) ? `linked: ${target}` : "install failed; run npm i -g or npm link manually"
}

function probeShims() {
  const names = process.platform === "win32" ? ["opencode.cmd", "opencode2.cmd"] : ["opencode", "opencode2"]
  const found = []
  for (const name of names) {
    const out = sh(name, ["--version"])
    const m = out.match(/(\d+)\.(\d+)\.(\d+)/)
    if (m) found.push({ name, version: m[0], major: Number(m[1]) })
  }
  return found
}

function readJson(file) {
  if (!existsSync(file)) return {}
  const raw = readFileSync(file, "utf8")
  try {
    return JSON.parse(raw)
  } catch {}
  const stripped = raw
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,(\s*[}\]])/g, "$1")
  return JSON.parse(stripped)
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  if (existsSync(file)) writeFileSync(file + ".bak", readFileSync(file))
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n")
}

function statusFile(name) {
  return path.join(process.cwd(), SLOT_DIR, name)
}

function writeSlot(name, text) {
  const file = statusFile(name)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

function doSetup(forceV1, forceV2) {
  const probes = probeShims()
  const lines = []
  for (const p of probes) lines.push(`detected ${p.name} -> v${p.version}`)
  if (probes.length === 0) lines.push("no opencode binary detected (use --v1 / --v2 to force)")
  const wantV1 = forceV1 || (!forceV2 && probes.some((p) => p.major === 1))
  const wantV2 = forceV2 || (!forceV1 && probes.some((p) => p.major === 2))
  if (wantV1) {
    const url = pathToFileURL(V1_ENTRY).href
    const cfg = readJson(V1_CONFIG)
    cfg.plugin = Array.isArray(cfg.plugin) ? cfg.plugin : []
    if (cfg.plugin.includes(url)) {
      lines.push(`v1: already registered (${V1_CONFIG})`)
    } else {
      cfg.plugin.push(url)
      writeJson(V1_CONFIG, cfg)
      lines.push(`v1: registered ${url} -> ${V1_CONFIG}`)
    }
  } else {
    lines.push("v1: not detected, skipped")
  }
  if (wantV2) {
    const url = pathToFileURL(PKG_ROOT).href
    const cfg = readJson(V2_CONFIG)
    cfg.plugins = Array.isArray(cfg.plugins) ? cfg.plugins : []
    if (cfg.plugins.includes(url)) {
      lines.push(`v2: already registered (${V2_CONFIG})`)
    } else {
      cfg.plugins.push(url)
      writeJson(V2_CONFIG, cfg)
      lines.push(`v2: registered ${url} -> ${V2_CONFIG}`)
    }
  } else {
    lines.push("v2: not detected, skipped")
  }
  if (!existsSync(V1_ENTRY)) lines.push(`WARN v1 entry missing: ${V1_ENTRY}`)
  if (!existsSync(V2_ENTRY)) lines.push(`WARN v2 entry missing: ${V2_ENTRY}`)
  lines.push("restart opencode (each version) to activate")
  return lines
}

function cmdSetup(args) {
  console.log(doSetup(args.includes("--v1"), args.includes("--v2")).join("\n"))
}

function cmdInit(args) {
  const forceV1 = args.includes("--v1")
  const forceV2 = args.includes("--v2")
  const text = args.filter((a) => !a.startsWith("--")).join(" ").trim()
  const lines = []
  lines.push(`link: ${ensureLinked()}`)
  lines.push(...doSetup(forceV1, forceV2))
  const banner = text || DEFAULT_STATUS
  writeSlot(STATUS_FILE, banner + "\n")
  writeSlot(SIDEBAR_FILE, "")
  lines.push(`banner: ${STATUS_FILE} <- ${banner}`)
  lines.push(`sidebar: ${SIDEBAR_FILE} <- (empty, hidden by default)`)
  console.log(lines.join("\n"))
}

function cmdSet(args) {
  const rest = [...args]
  let label = DEFAULT_LABEL
  const labelIndex = rest.indexOf("--label")
  if (labelIndex !== -1) {
    label = rest[labelIndex + 1]
    if (!label || label.startsWith("--")) {
      console.error("usage: opencode-tui-extension set [--label <text>|--no-label] <text>")
      process.exit(1)
    }
    rest.splice(labelIndex, 2)
  }
  if (rest.includes("--no-label")) {
    label = ""
    rest.splice(rest.indexOf("--no-label"), 1)
  }
  const text = rest.filter((a) => !a.startsWith("--")).join(" ").trim()
  if (!text) {
    console.error("usage: opencode-tui-extension set [--label <text>|--no-label] <text>")
    process.exit(1)
  }
  const body = label ? `${label}: ${text}` : text
  writeSlot(STATUS_FILE, body + "\n")
  console.log(`${STATUS_FILE} <- ${body}`)
}

function cmdSidebar(args) {
  const text = args.join(" ").trim()
  if (!text) {
    console.error("usage: opencode-tui-extension sidebar <text> (\\n for newline)")
    process.exit(1)
  }
  const body = text.replace(/\\n/g, "\n")
  writeSlot(SIDEBAR_FILE, body + "\n")
  console.log(`${SIDEBAR_FILE} <- ${body.split("\n").length} line(s)`)
}

function cmdClear(args) {
  const target = args[0] || "all"
  if (target === "status" || target === "all") writeSlot(STATUS_FILE, "")
  if (target === "sidebar" || target === "all") writeSlot(SIDEBAR_FILE, "")
  console.log(`cleared: ${target}`)
}

function cmdDoctor() {
  const lines = []
  lines.push(`package: ${PKG_ROOT}`)
  lines.push(`v1 entry: ${existsSync(V1_ENTRY) ? "ok" : "MISSING " + V1_ENTRY}`)
  lines.push(`v2 entry: ${existsSync(V2_ENTRY) ? "ok" : "MISSING " + V2_ENTRY}`)
  for (const p of probeShims()) lines.push(`binary: ${p.name} -> v${p.version}`)
  const tui = readJson(V1_CONFIG)
  const v1Url = pathToFileURL(V1_ENTRY).href
  lines.push(`v1 config: ${V1_CONFIG} plugin=${JSON.stringify(tui.plugin ?? [])} registered=${(tui.plugin || []).includes(v1Url)}`)
  const cli = readJson(V2_CONFIG)
  const v2Url = pathToFileURL(PKG_ROOT).href
  lines.push(`v2 config: ${V2_CONFIG} plugins=${JSON.stringify(cli.plugins ?? [])} registered=${(cli.plugins || []).includes(v2Url)}`)
  for (const name of [STATUS_FILE, SIDEBAR_FILE]) {
    const file = statusFile(name)
    let content = "(absent -> default)"
    if (existsSync(file)) {
      const text = readFileSync(file, "utf8").trim()
      content = text === "" ? "(empty -> hidden)" : text.split(/\r?\n/)[0]
    }
    lines.push(`slot ${name}: ${content}`)
  }
  if (existsSync(MARKER)) {
    try {
      const m = JSON.parse(readFileSync(MARKER, "utf8"))
      lines.push(`tui load marker: ${new Date(m.time).toISOString()}`)
    } catch {
      lines.push("tui load marker: unreadable")
    }
  } else {
    lines.push("tui load marker: none (tui not restarted since registration?)")
  }
  console.log(lines.join("\n"))
}

function cmdHelp() {
  console.log(`opencode-tui-extension
  init [text] [--v1 --v2]  one command: npm link + setup + show bottom banner by default
  setup [--v1 --v2]        register plugin, auto-detect versions; --v1/--v2 restrict to that version
  set [--label <text>|--no-label] <text>   write banner text (default label prefix "${DEFAULT_LABEL}")
  sidebar <text>           write sidebar lines (.opencode/sidebar.txt, \\n = newline)
  clear [status|sidebar|all]   hide banner/sidebar (default all)
  doctor                   show install/registration/slot status`)
}

const [cmd, ...args] = process.argv.slice(2)
switch (cmd) {
  case "init":
    cmdInit(args)
    break
  case "setup":
    cmdSetup(args)
    break
  case "set":
    cmdSet(args)
    break
  case "sidebar":
    cmdSidebar(args)
    break
  case "clear":
    cmdClear(args)
    break
  case "doctor":
    cmdDoctor()
    break
  default:
    cmdHelp()
    if (cmd && cmd !== "help") process.exit(1)
}
