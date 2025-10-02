import * as nip19 from 'nostr-tools/nip19'
import {makeSecret} from '@welshman/signer'
import { instrument } from 'succinct-async'
import {writeFile} from 'fs/promises'
import {join} from 'path'
import {sha256, hexToBytes} from '@welshman/lib'
import {ADMIN_PUBKEYS, CONFIG_DIR, RELAY_DOMAIN} from './env.js'
import {slugify} from './util.js'
import type {
  ApplicationParams,
  ApplicationApprovalParams,
  ApplicationRejectionParams,
} from './domain.js'
import { render } from './templates.js'
import { database } from './database.js'
import { robot} from './robot.js'

export class ActionError extends Error {
  toString() {
    return this.message
  }
}

const createApplication = instrument(
  'actions.createApplication',
  async (params: ApplicationParams) => {
    const application = await database.createApplication(params)
    const error = await robot.sendToAdmin(
      await render('templates/new-application.txt', {
        ID: application.id,
        Pin: application.pin,
        City: application.city,
        Npub: nip19.npubEncode(application.pubkey),
      })
    )

    if (error) {
      console.error(error)
    }

    return application
  }
)

const approveApplication = instrument(
  'actions.approveApplication',
  async (params: ApplicationApprovalParams) => {
    const application = await database.approveApplication(params)

    // Configure relay

    const hash = await sha256(hexToBytes(application.pubkey))
    const schema = slugify(`${application.city}_${hash.slice(0, 4)}`)
    const host = schema + '.' + RELAY_DOMAIN
    const config = await render('templates/config.toml', {
      Secret: makeSecret(),
      Schema: schema,
      Host: host,
      Name: `BitcoinWalk ${application.city}`,
      AdminPubkeys: JSON.stringify(ADMIN_PUBKEYS),
      Pubkey: application.pubkey,
      City: application.city,
    })

    await writeFile(join(CONFIG_DIR, `${schema}.toml`), config, 'utf-8')

    // Notify organizer

    const content = await render('templates/approved.txt', {Host: host, Message: params.message})
    const relays = await robot.loadMessagingRelays(application.pubkey)
    const error = await robot.sendDirectMessage(application.pubkey, content, relays)

    if (error) {
      const adminError = await robot.sendToAdmin(error)

      if (adminError) {
        console.error(adminError)
      }
    }

    return application
  }
)

const rejectApplication = instrument(
  'actions.rejectApplication',
  async (params: ApplicationRejectionParams) => {
    const application = await database.rejectApplication(params)
    const content = await render('templates/rejected.txt', {Message: params.message})
    const relays = await robot.loadMessagingRelays(application.pubkey)
    const error = await robot.sendDirectMessage(application.pubkey, content, relays)

    if (error) {
      const adminError = await robot.sendToAdmin(error)

      if (adminError) {
        console.error(adminError)
      }
    }

    return application
  }
)

export const actions = {
  createApplication,
  approveApplication,
  rejectApplication,
}
