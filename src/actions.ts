import * as nip19 from 'nostr-tools/nip19'
import { randomId } from '@welshman/lib'
import type { StampedEvent } from '@welshman/util'
import {
  makeSecret,
  makeEvent,
  ROOM_CREATE,
  ROOM_EDIT_META,
  normalizeRelayUrl,
} from '@welshman/util'
import { defaultSocketPolicies, makeSocketPolicyAuth, Socket, Pool } from '@welshman/net'
import { Nip01Signer } from '@welshman/signer'
import { publish } from '@welshman/net'
import { instrument } from 'succinct-async'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { NWCClient } from '@getalby/sdk/nwc'
import { Invoice } from '@getalby/lightning-tools/bolt11'
import {
  ADMIN_PUBKEYS,
  REQUIRE_APPROVAL,
  CONFIG_DIR,
  RELAY_DOMAIN,
  NWC_URL,
  SATS_PER_MONTH,
  TRIAL_DAYS,
} from './env.js'
import { slugify, editConfigFile } from './util.js'
import { getMetadata } from './domain.js'
import type {
  Application,
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
  async (params: Partial<ApplicationParams>) => {
    if (!params.name) return 'A name for your space is required'
    if (!params.schema) return 'A schema name is required'
    if (params.schema.match(/^[0-9]/)) return 'Schema must not begin with a number'
    if (!params.schema.match(/^[a-z][0-9a-z_]*$/)) return 'Schema is invalid'
    if (params.pubkey?.length !== 64) return 'A valid pubkey is required'
    if (!params.description) return 'A description is required'
    if (!params.metadata) return 'A metadata object is required'
    if (params.schema !== slugify(params.schema)) return 'That is an invalid schema'

    if (params.invoice) {
      try {
        const { paymentHash } = new Invoice({ pr: params.invoice })

        if (!paymentHash) {
          return 'Invalid invoice provided'
        }

        if (!NWC_URL) {
          return 'Payment system not configured'
        }

        const nwc = new NWCClient({ nostrWalletConnectUrl: NWC_URL })
        const result = await nwc.lookupInvoice({ payment_hash: paymentHash })

        if (result.state !== 'settled') {
          return 'Invoice has not been paid yet'
        }
      } catch (error: any) {
        console.error('Failed to verify invoice:', error)
        return 'Failed to verify invoice payment'
      }
    } else if (SATS_PER_MONTH > 0 && TRIAL_DAYS === 0) {
      return 'Payment is required. Please provide a paid invoice.'
    }

    let application: Application

    try {
      application = await database.createApplication(params as ApplicationParams)
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT') {
        return 'that schema is already in use'
      }

      throw e
    }

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
      console.log(`Created application ${application.schema}`)
    }

    if (!REQUIRE_APPROVAL) {
      await approveApplication({ schema: application.schema, message: '' })

      console.log(`Automatically approved application ${application.schema}`)
    }
  }
)

const assignApplication = instrument(
  'actions.assignApplication',
  async (schema: string, pubkey: string) => {
    const application = await database.assignApplication(schema, pubkey)

    if (application) {
      await editConfigFile(application.schema, { 'info.pubkey': pubkey })

      console.log(`Assigned application ${application.schema} to ${pubkey}`)
    } else {
      console.log(`Application not found: ${schema}`)
    }
  }
)

const approveApplication = instrument(
  'actions.approveApplication',
  async (params: ApplicationApprovalParams) => {
    const application = await database.approveApplication(params)

    // Configure relay

    const secret = makeSecret()
    const host = application.schema.replace('_', '-') + '.' + RELAY_DOMAIN
    const config = await render('templates/config.toml', {
      Host: host,
      Secret: secret,
      Schema: application.schema,
      Name: application.name,
      Image: application.image || '',
      Description: application.description,
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

    // Create #general room

    const signer = Nip01Signer.fromSecret(secret)

    const authPolicy = makeSocketPolicyAuth({
      sign: (event: StampedEvent) => signer.sign(event),
      shouldAuth: (socket: Socket) => true,
    })

    const pool = new Pool({
      makeSocket: (url: string) => {
        const socket = new Socket(url)

        for (const applyPolicy of defaultSocketPolicies) {
          applyPolicy(socket)
        }

        authPolicy(socket)

        return socket
      },
    })

    const context = { pool }
    const h = randomId()

    await publish({
      context,
      relays: [normalizeRelayUrl(host)],
      event: await signer.sign(makeEvent(ROOM_CREATE, { tags: [['d', h]] })),
    })

    await publish({
      context,
      relays: [normalizeRelayUrl(host)],
      event: await signer.sign(
        makeEvent(ROOM_EDIT_META, {
          tags: [
            ['h', h],
            ['name', 'general'],
          ],
        })
      ),
    })

    pool.clear()
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

const deleteApplication = instrument('actions.deleteApplication', async (schema: string) => {
  const application = await database.deleteApplication(schema)

  if (application) {
    // Delete config file if it exists
    try {
      await unlink(join(CONFIG_DIR, `${application.schema}.toml`))
      console.log(`Deleted config file for ${application.schema}`)
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error(`Failed to delete config file for ${application.schema}:`, err)
      }
    }

    console.log(`Deleted application ${application.schema}`)
  } else {
    console.log(`Application not found: ${schema}`)
  }
})

export const actions = {
  createApplication,
  assignApplication,
  approveApplication,
  rejectApplication,
  deleteApplication,
}
