import { identity } from '@welshman/lib'
import { PublishResultsByRelay, PublishStatus } from '@welshman/net'
import { displayRelayUrl, makeHttpAuth, makeHttpAuthHeader } from '@welshman/util'
import { RELAY_API, appSigner } from './env.js'

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

// Helper to make NIP 98 authenticated API requests
export const apiRequest = async (
  method: string,
  endpoint: string,
  body?: object
): Promise<{ success: boolean; error?: string }> => {
  const url = `${RELAY_API}${endpoint}`
  const payload = body ? JSON.stringify(body) : undefined
  const authEventTemplate = await makeHttpAuth(url, method, payload)
  const signedAuthEvent = await appSigner.sign(authEventTemplate)
  const authHeader = makeHttpAuthHeader(signedAuthEvent)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: payload,
    })

    const data = await response.json().catch(() => null)

    if (data?.error) {
      return { success: false, error: data.error || `API error (${response.status})` }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: `Request failed: ${error.message}` }
  }
}
