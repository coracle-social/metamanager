import { config } from 'dotenv'
import { Nip01Signer } from '@welshman/signer'
import { parseJson } from '@welshman/lib'
import type { StampedEvent } from '@welshman/util'
import { normalizeRelayUrl } from '@welshman/util'
import type { Socket } from '@welshman/net'
import { defaultSocketPolicies, makeSocketPolicyAuth } from '@welshman/net'
import { fromCsv } from './util.js'

// Load .env.template first for defaults, then .env for overrides
config({ path: '.env.template' })
config({ path: '.env', override: true })

if (!process.env.PORT) throw new Error('PORT is not defined.')
if (!process.env.CONFIG_DIR) throw new Error('CONFIG_DIR is not defined.')
if (!process.env.DATABASE_PATH) throw new Error('DATABASE_PATH is not defined.')
if (!process.env.SECRET_KEY) throw new Error('SECRET_KEY is not defined.')
if (!process.env.ADMIN_ROOM) throw new Error('ADMIN_ROOM is not defined.')
if (!process.env.ADMIN_RELAY) throw new Error('ADMIN_RELAY is not defined.')
if (!process.env.RELAY_DOMAIN) throw new Error('RELAY_DOMAIN is not defined.')
if (!process.env.INDEXER_RELAYS) throw new Error('INDEXER_RELAYS is not defined.')
if (!process.env.BOT_META) throw new Error('BOT_META is not defined.')
if (!parseJson(process.env.BOT_META)) throw new Error('BOT_META is not valid JSON.')
if (!process.env.BOT_RELAYS) throw new Error('BOT_RELAYS is not defined.')
if (!process.env.BOT_DM_RELAYS) throw new Error('BOT_DM_RELAYS is not defined.')

export const PORT = process.env.PORT
export const NWC_URL = process.env.NWC_URL || ''
export const SATS_PER_MONTH = parseInt(process.env.SATS_PER_MONTH || '0')
export const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '0')
export const CONFIG_DIR = process.env.CONFIG_DIR
export const DATABASE_PATH = process.env.DATABASE_PATH
export const ADMIN_ROOM = process.env.ADMIN_ROOM
export const ADMIN_RELAY = normalizeRelayUrl(process.env.ADMIN_RELAY)
export const ADMIN_PUBKEYS = fromCsv(process.env.ADMIN_PUBKEYS || "")
export const RELAY_DOMAIN = fromCsv(process.env.RELAY_DOMAIN)
export const INDEXER_RELAYS = fromCsv(process.env.INDEXER_RELAYS).map(normalizeRelayUrl)
export const REQUIRE_APPROVAL = process.env.REQUIRE_APPROVAL === 'true'
export const BOT_META = process.env.BOT_META
export const BOT_RELAYS = fromCsv(process.env.BOT_RELAYS).map(normalizeRelayUrl)
export const BOT_DM_RELAYS = fromCsv(process.env.BOT_DM_RELAYS).map(normalizeRelayUrl)

export const appSigner = Nip01Signer.fromSecret(process.env.SECRET_KEY)

appSigner.getPubkey().then((pubkey) => {
  console.log(`Running as ${pubkey}`)
})

defaultSocketPolicies.push(
  makeSocketPolicyAuth({
    sign: (event: StampedEvent) => appSigner.sign(event),
    shouldAuth: (socket: Socket) => true,
  })
)
