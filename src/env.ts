import 'dotenv/config'
import { Nip01Signer } from '@welshman/signer'
import type { StampedEvent } from '@welshman/util'
import type { Socket } from '@welshman/net'
import { defaultSocketPolicies, makeSocketPolicyAuth } from '@welshman/net'

if (!process.env.PORT) throw new Error('PORT is not defined.')
if (!process.env.SECRET_KEY) throw new Error('SECRET_KEY is not defined.')
if (!process.env.ADMIN_ROOM) throw new Error('ADMIN_ROOM is not defined.')
if (!process.env.ADMIN_RELAY) throw new Error('ADMIN_RELAY is not defined.')

export const PORT = process.env.PORT
export const ADMIN_ROOM = process.env.ADMIN_ROOM
export const ADMIN_RELAY = process.env.ADMIN_RELAY

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
