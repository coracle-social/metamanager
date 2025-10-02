import { config } from 'dotenv'
import { Nip01Signer } from '@welshman/signer'
import type { StampedEvent } from '@welshman/util'
import type { Socket } from '@welshman/net'
import { defaultSocketPolicies, makeSocketPolicyAuth } from '@welshman/net'
import {fromCsv} from './util.js'

// Load .env.template first for defaults, then .env for overrides
config({ path: '.env.template' })
config({ path: '.env', override: true })

if (!process.env.PORT) throw new Error('PORT is not defined.')
if (!process.env.CONFIG_DIR) throw new Error('CONFIG_DIR is not defined.')
if (!process.env.SECRET_KEY) throw new Error('SECRET_KEY is not defined.')
if (!process.env.ADMIN_ROOM) throw new Error('ADMIN_ROOM is not defined.')
if (!process.env.ADMIN_RELAY) throw new Error('ADMIN_RELAY is not defined.')
if (!process.env.ADMIN_PUBKEYS) throw new Error('ADMIN_PUBKEYS is not defined.')
if (!process.env.RELAY_DOMAIN) throw new Error('RELAY_DOMAIN is not defined.')
if (!process.env.INDEXER_RELAYS) throw new Error('INDEXER_RELAYS is not defined.')

export const PORT = process.env.PORT
export const CONFIG_DIR = process.env.CONFIG_DIR
export const ADMIN_ROOM = process.env.ADMIN_ROOM
export const ADMIN_RELAY = process.env.ADMIN_RELAY
export const ADMIN_PUBKEYS = fromCsv(process.env.ADMIN_PUBKEYS)
export const RELAY_DOMAIN = fromCsv(process.env.RELAY_DOMAIN)
export const INDEXER_RELAYS = fromCsv(process.env.INDEXER_RELAYS)

export const appSigner = Nip01Signer.fromSecret(process.env.SECRET_KEY)

appSigner.getPubkey().then((pubkey) => {
  console.log(`Running as ${pubkey}`)
})

defaultSocketPolicies.push(
  makeSocketPolicyAuth({
    sign: (event: StampedEvent) => appSigner.sign(event),
    shouldAuth: (socket: Socket) => true,
  }),
)
