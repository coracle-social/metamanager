import * as nip19 from 'nostr-tools/nip19'
import { makeSecret } from '@welshman/signer'
import { instrument } from 'succinct-async'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomId } from '@welshman/lib'
import { ADMIN_PUBKEYS, CONFIG_DIR, RELAY_DOMAIN } from './env.js'
import { slugify } from './util.js'
import { getMetadata } from './domain.js'
import type {
  ApplicationParams,
  ApplicationApprovalParams,
  ApplicationRejectionParams,
} from './domain.js'
import { render } from './templates.js'
import { database } from './database.js'
import { robot } from './robot.js'

export class ActionError extends Error {
  toString() {
    return this.message
  }
}

const createApplication = instrument(
  'actions.createApplication',
  async (params: ApplicationParams) => {
    const schema = slugify(`${params.name}_${randomId().slice(0, 4)}`)

    const application = await database.createApplication({
      ...params,
      schema,
    })

    const error = await robot.sendToAdmin(
      await render('templates/new-application.txt', {
        Name: application.name,
        Schema: application.schema,
        Npub: nip19.npubEncode(application.pubkey),
        Metadata: getMetadata(application),
      })
    )

    if (error) {
      console.error(error)
    } else {
      console.log(`Created application ${schema}`)
    }

    return application
  }
)

const approveApplication = instrument(
  'actions.approveApplication',
  async (params: ApplicationApprovalParams) => {
    const application = await database.approveApplication(params)

    // Configure relay

    const host = application.schema + '.' + RELAY_DOMAIN
    const config = await render('templates/config.toml', {
      Host: host,
      Secret: makeSecret(),
      Schema: application.schema,
      Name: `BitcoinWalk ${application.name}`,
      Description: `A BitcoinWalk community for ${application.name}`,
      AdminPubkeys: JSON.stringify(ADMIN_PUBKEYS),
      Pubkey: application.pubkey,
    })

    await writeFile(join(CONFIG_DIR, `${application.schema}.toml`), config, 'utf-8')

    // Notify organizer

    const content = await render('templates/approved.txt', { Host: host, Message: params.message })
    const relays = await robot.loadMessagingRelays(application.pubkey)
    const error = await robot.sendDirectMessage(application.pubkey, content, relays)

    if (error) {
      const adminError = await robot.sendToAdmin(error)

      if (adminError) {
        console.error(adminError)
      }
    } else {
      console.log(`Approved application ${application.schema}`)
    }

    return application
  }
)

const rejectApplication = instrument(
  'actions.rejectApplication',
  async (params: ApplicationRejectionParams) => {
    const application = await database.rejectApplication(params)
    const content = await render('templates/rejected.txt', { Message: params.message })
    const relays = await robot.loadMessagingRelays(application.pubkey)
    const error = await robot.sendDirectMessage(application.pubkey, content, relays)

    if (error) {
      const adminError = await robot.sendToAdmin(error)

      if (adminError) {
        console.error(adminError)
      }
    } else {
      console.log(`Rejected application ${application.schema}`)
    }

    return application
  }
)

export const actions = {
  createApplication,
  approveApplication,
  rejectApplication,
}
