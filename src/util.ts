import { identity } from '@welshman/lib'
import { PublishResultsByRelay, PublishStatus } from '@welshman/net'
import { displayRelayUrl } from '@welshman/util'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import * as TOML from '@iarna/toml'
import { CONFIG_DIR } from './env.js'

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[0-9_]+|_+$/g, '')

export const fromCsv = (s: string) => (s || '').split(',').filter(identity)

export const dedent = (s: string) => {
  const lines = s.split('\n')
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0)

  if (nonEmptyLines.length === 0) return s

  const minIndent = Math.min(...nonEmptyLines.map((line) => line.match(/^\s*/)?.[0].length ?? 0))

  return lines
    .map((line) => line.slice(minIndent))
    .join('\n')
    .trim()
}

export const getPublishError = (results: PublishResultsByRelay, message: string) => {
  const items = Object.values(results)
  const errors: string[] = []

  for (const result of items) {
    if (result.status !== PublishStatus.Success) {
      errors.push(`${result.detail} (${displayRelayUrl(result.relay)})`)
    }
  }

  if (errors.length === items.length) {
    return `${message}: ${errors.join('; ')}`
  }
}

export const toTitleCase = (s: string) =>
  s.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase())

export const editConfigFile = async (schema: string, updates: Record<string, any>) => {
  const configPath = join(CONFIG_DIR, `${schema}.toml`)
  const content = await readFile(configPath, 'utf-8')
  const config = TOML.parse(content) as any

  // Support nested paths like "info.pubkey"
  for (const [key, value] of Object.entries(updates)) {
    const path = key.split('.')
    let target = config

    for (let i = 0; i < path.length - 1; i++) {
      if (!target[path[i]]) {
        target[path[i]] = {}
      }
      target = target[path[i]]
    }

    target[path[path.length - 1]] = value
  }

  const updatedContent = TOML.stringify(config)
  await writeFile(configPath, updatedContent, 'utf-8')
}
