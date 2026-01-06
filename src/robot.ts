import { formatTimestamp, uniq, sleep } from '@welshman/lib'
import type { TrustedEvent, StampedEvent } from '@welshman/util'
import {
  DIRECT_MESSAGE,
  MESSAGING_RELAYS,
  MESSAGE,
  RELAYS,
  PROFILE,
  makeEvent,
  getRelayTagValues,
  normalizeRelayUrl,
} from '@welshman/util'
import {
  request,
  publish,
  Pool,
  Socket,
  defaultSocketPolicies,
  makeSocketPolicyAuth,
} from '@welshman/net'
import { Nip59 } from '@welshman/signer'
import * as nip19 from 'nostr-tools/nip19'
import { actions } from './actions.js'
import { getMetadata } from './domain.js'
import { database } from './database.js'
import { render } from './templates.js'
import {
  ADMIN_RELAY,
  INDEXER_RELAYS,
  ADMIN_ROOM,
  RELAY_DOMAIN,
  BOT_META,
  BOT_RELAYS,
  BOT_DM_RELAYS,
  appSigner,
} from './env.js'
import { getPublishError } from './util.js'

const authPolicy = makeSocketPolicyAuth({
  sign: (event: StampedEvent) => appSigner.sign(event),
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

const commands = {
  '/help': async (event: TrustedEvent) => {
    robot.sendToAdmin(await render('templates/help.txt'))
  },
  '/approve': async (event: TrustedEvent) => {
    const [_, schema, message] = event.content.match(/\/approve (\w+) ?(.*)/) || []

    const application = await database.getApplication(schema)

    if (application) {
      await actions.approveApplication({ schema, message })

      robot.sendToAdmin(`Successfully approved application ${schema}`)
    } else {
      robot.sendToAdmin(`Invalid application id: ${schema}`)
    }
  },
  '/reject': async (event: TrustedEvent) => {
    const [_, schema, message] = event.content.match(/\/reject (\w+) ?(.*)/) || []

    const application = await database.getApplication(schema)

    if (application) {
      await actions.rejectApplication({ schema, message })

      robot.sendToAdmin(`Successfully rejected application ${schema}`)
    } else {
      robot.sendToAdmin(`Invalid application id: ${schema}`)
    }
  },
  '/info': async (event: TrustedEvent) => {
    const [_, schema] = event.content.match(/\/info (\w+)/) || []

    const application = await database.getApplication(schema)

    if (application) {
      robot.sendToAdmin(
        await render('templates/info.txt', {
          ...application,
          Host: application.schema + '.' + RELAY_DOMAIN,
          Npub: nip19.npubEncode(application.pubkey),
          Metadata: getMetadata(application),
          CreatedDate: formatTimestamp(application.created_at),
          ApprovedDate: formatTimestamp(application.approved_at),
          RejectedDate: formatTimestamp(application.rejected_at),
          IsApproved: !!application.approved_at,
          IsRejected: !!application.rejected_at,
        })
      )
    } else {
      robot.sendToAdmin(`Invalid application id: ${schema}`)
    }
  },
  '/list': async (event: TrustedEvent) => {
    const [_, limit = '10'] = event.content.match(/\/list\s*(\d+)/) || []

    const applications = await database.listApplications(parseInt(limit))

    robot.sendToAdmin(
      await render('templates/list.txt', {
        Applications: applications.map((app) => ({
          Name: app.name,
          Schema: app.schema,
          Status: app.approved_at ? 'approved' : app.rejected_at ? 'rejected' : 'pending',
        })),
      })
    )
  },
  '/delete': async (event: TrustedEvent) => {
    const [_, schema] = event.content.match(/\/delete (\w+)/) || []

    const application = await database.getApplication(schema)

    if (application) {
      await actions.deleteApplication(schema)

      robot.sendToAdmin(`Successfully deleted application ${schema}`)
    } else {
      robot.sendToAdmin(`Invalid application id: ${schema}`)
    }
  },
}

export const robot = {
  publishMeta: async () => {
    const relays = uniq([ADMIN_RELAY, ...INDEXER_RELAYS, ...BOT_RELAYS])

    await publish({
      relays,
      context,
      event: await appSigner.sign(
        makeEvent(RELAYS, {
          tags: BOT_RELAYS.map((url) => ['r', url]),
        })
      ),
    })

    await publish({
      relays,
      context,
      event: await appSigner.sign(
        makeEvent(MESSAGING_RELAYS, {
          tags: BOT_DM_RELAYS.map((url) => ['relay', url]),
        })
      ),
    })

    await publish({
      relays,
      context,
      event: await appSigner.sign(makeEvent(PROFILE, { content: BOT_META })),
    })
  },
  sendToAdmin: async (content: string) => {
    // Make sure messages show up in order
    await sleep(1000)

    console.log(`Sending message to admin: ${content.slice(0, 50).replace(/\n/g, ' ')}...`)

    const template = makeEvent(MESSAGE, { content, tags: [['h', ADMIN_ROOM]] })
    const event = await appSigner.sign(template)
    const results = await publish({ relays: [ADMIN_RELAY], context, event })

    return getPublishError(results, `Failed to message admin`)
  },
  listenToAdmin: () => {
    console.log(`Listening to messages at ${ADMIN_RELAY}'${ADMIN_ROOM}`)

    request({
      context,
      relays: [ADMIN_RELAY],
      filters: [{ kinds: [MESSAGE], '#h': [ADMIN_ROOM], limit: 0 }],
      onEvent: (event: TrustedEvent) => {
        for (const [command, handler] of Object.entries(commands)) {
          if (event.content.startsWith(command)) {
            console.log(
              `Received message from admin: ${event.content.slice(0, 50).replace(/\n/g, '')}`
            )
            handler(event)
          }
        }
      },
    })
  },
  sendDirectMessage: async (pubkey: string, content: string, relays: string[]) => {
    // Make sure messages show up in order
    await sleep(1000)

    console.log(`Sending DM to pubkey: ${content.slice(0, 50).replace(/\n/g, ' ')}...`)

    const nip59 = Nip59.fromSigner(appSigner)
    const template = makeEvent(DIRECT_MESSAGE, { content, tags: [['p', pubkey]] })
    const event = await nip59.wrap(pubkey, template)
    const results = await publish({ relays, context, event })

    return getPublishError(results, `Failed to send DM to ${pubkey}`)
  },
  loadMessagingRelays: async (pubkey: string) => {
    let relays = ['wss://auth.nostr1.com/', 'wss://inbox.nostr.wine/']

    await request({
      context,
      autoClose: true,
      relays: INDEXER_RELAYS,
      filters: [{ kinds: [MESSAGING_RELAYS], authors: [pubkey] }],
      onEvent: (event: TrustedEvent) => {
        relays = getRelayTagValues(event.tags)
      },
    })

    return relays
  },
}
