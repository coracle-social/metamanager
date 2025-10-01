import {identity} from '@welshman/lib'

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

export const fromCsv = (s: string) => (s || "").split(",").filter(identity)

export const dedent = (s: string) => {
  const lines = s.split('\n')
  const nonEmptyLines = lines.filter(line => line.trim().length > 0)

  if (nonEmptyLines.length === 0) return s

  const minIndent = Math.min(
    ...nonEmptyLines.map(line => line.match(/^\s*/)?.[0].length ?? 0)
  )

  return lines
    .map(line => line.slice(minIndent))
    .join('\n')
    .trim()
}

