import type { TrustedEvent } from '@welshman/util'
import { DIRECT_MESSAGE, INBOX_RELAYS, MESSAGE, makeEvent, getRelayTagValues } from '@welshman/util'
import { request, publish, PublishStatus } from '@welshman/net'
import { Nip59 } from '@welshman/signer'
import { actions } from './actions.js'
import { database } from './database.js'
import { ADMIN_RELAY, INDEXER_RELAYS, ADMIN_ROOM, appSigner } from './env.js'
import {getPublishError, dedent} from './util.js'

const commands = {
  '/help': async (event: TrustedEvent) => {
    robot.sendToAdmin(
      dedent(`
      - \`/help\` - display this message
      - \`/approve [id] [optional message]\` - approve an application
      - \`/reject [id] [optional message]\` - reject an application
      - \`/info [id]\` - displays information for the given application
      `)
    )
  },
  '/approve': async (event: TrustedEvent) => {
    const [_, id, message] = event.content.match(/\/approve (\w+) ?(.*)/) || []

    const application = await database.getApplication(id)

    if (application) {
      await actions.approveApplication({ id, message })

      robot.sendToAdmin(`Successfully approved application ${id}`)
    } else {
      robot.sendToAdmin(`Invalid application id: ${id}`)
    }
  },
  '/reject': async (event: TrustedEvent) => {
    const [_, id, message] = event.content.match(/\/reject (\w+) ?(.*)/) || []

    const application = await database.getApplication(id)

    if (application) {
      await actions.rejectApplication({ id, message })

      robot.sendToAdmin(`Successfully rejected application ${id}`)
    } else {
      robot.sendToAdmin(`Invalid application id: ${id}`)
    }
  },
  '/info': async (event: TrustedEvent) => {
    const [_, id] = event.content.match(/\/info (\w+)/) || []

    const application = await database.getApplication(id)

    if (application) {
      robot.sendToAdmin("```" + Object.entries(application).map(([k, v]) => `${k}: ${v}`).join('\n') + "```")
    } else {
      robot.sendToAdmin(`Invalid application id: ${id}`)
    }
  }
}

export const robot = {
  sendToAdmin: async (content: string) => {
    const template = makeEvent(MESSAGE, { content, tags: [['h', ADMIN_ROOM]] })
    const event = await appSigner.sign(template)
    const results = await publish({ relays: [ADMIN_RELAY], event })

    return getPublishError(results, `Failed to message to admin`)
  },
  listenToAdmin: () => {
    request({
      relays: [ADMIN_RELAY],
      filters: [{ kinds: [MESSAGE], '#h': [ADMIN_ROOM], limit: 0 }],
      onEvent: (event: TrustedEvent) => {
        for (const [command, handler] of Object.entries(commands)) {
          if (event.content.startsWith(command)) {
            handler(event)
          }
        }
      },
    })
  },
  sendDirectMessage: async (pubkey: string, content: string, relays: string[]) => {
    const nip59 = Nip59.fromSigner(appSigner)
    const template = makeEvent(DIRECT_MESSAGE, { content, tags: [['p', pubkey]] })
    const event = await nip59.wrap(pubkey, template)
    const results = await publish({ relays, event: event.wrap })

    return getPublishError(results, `Failed to send DM to ${pubkey}`)
  },
  loadMessagingRelays: async (pubkey: string) => {
    let relays = ['wss://auth.nostr1.com/', 'wss://inbox.nostr.wine/']

    await request({
      autoClose: true,
      relays: INDEXER_RELAYS,
      filters: [{ kinds: [INBOX_RELAYS], authors: [pubkey] }],
      onEvent: (event: TrustedEvent) => {
        relays = getRelayTagValues(event.tags)
      },
    })

    return relays
  }
}
