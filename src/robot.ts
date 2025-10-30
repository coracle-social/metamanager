import { formatTimestamp, sleep } from '@welshman/lib'
import type { TrustedEvent } from '@welshman/util'
import { DIRECT_MESSAGE, INBOX_RELAYS, MESSAGE, makeEvent, getRelayTagValues } from '@welshman/util'
import { load, request, publish } from '@welshman/net'
import { Nip59 } from '@welshman/signer'
import * as nip19 from 'nostr-tools/nip19'
import { actions } from './actions.js'
import { getMetadata } from './domain.js'
import { database } from './database.js'
import { render } from './templates.js'
import { ADMIN_RELAY, INDEXER_RELAYS, ADMIN_ROOM, RELAY_DOMAIN, appSigner } from './env.js'
import { getPublishError, toTitleCase } from './util.js'

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
    const [_, limit = "10"] = event.content.match(/\/list\s*(\d+)/) || []

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
  sendToAdmin: async (content: string) => {
    // Make sure messages show up in order
    await sleep(1000)

    console.log(`Sending message to admin: ${content.slice(0, 50).replace('\n', ' ')}...`)

    const template = makeEvent(MESSAGE, { content, tags: [['h', ADMIN_ROOM]] })
    const event = await appSigner.sign(template)
    const results = await publish({ relays: [ADMIN_RELAY], event })

    return getPublishError(results, `Failed to message to admin`)
  },
  listenToAdmin: () => {
    console.log(`Listening to messages at ${ADMIN_RELAY}'${ADMIN_ROOM}`)

    request({
      relays: [ADMIN_RELAY],
      filters: [{ kinds: [MESSAGE], '#h': [ADMIN_ROOM], limit: 0 }],
      onEvent: (event: TrustedEvent) => {
        for (const [command, handler] of Object.entries(commands)) {
          if (event.content.startsWith(command)) {
            console.log(`Received message from admin: ${event.content.slice(0, 50).replace('\n', '')}`)
            handler(event)
          }
        }
      },
    })
  },
  sendDirectMessage: async (pubkey: string, content: string, relays: string[]) => {
    // Make sure messages show up in order
    await sleep(1000)

    console.log(`Sending DM to pubkey: ${content.slice(0, 50).replace('\n', ' ')}...`)

    const nip59 = Nip59.fromSigner(appSigner)
    const template = makeEvent(DIRECT_MESSAGE, { content, tags: [['p', pubkey]] })
    const event = await nip59.wrap(pubkey, template)
    const results = await publish({ relays, event: event.wrap })

    return getPublishError(results, `Failed to send DM to ${pubkey}`)
  },
  loadMessagingRelays: async (pubkey: string) => {
    let relays = ['wss://auth.nostr1.com/', 'wss://inbox.nostr.wine/']

    await load({
      relays: INDEXER_RELAYS,
      filters: [{ kinds: [INBOX_RELAYS], authors: [pubkey] }],
      onEvent: (event: TrustedEvent) => {
        relays = getRelayTagValues(event.tags)
      },
    })

    return relays
  },
}
