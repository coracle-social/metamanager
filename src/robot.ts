import type { TrustedEvent } from '@welshman/util'
import { DIRECT_MESSAGE, MESSAGE, makeEvent, getRelayTagValues } from '@welshman/util'
import { request, publish } from '@welshman/net'
import { Nip59 } from '@welshman/signer'
import { actions } from './actions.js'
import { database } from './database.js'
import { ADMIN_RELAY, INDEXER_RELAYS, ADMIN_ROOM, appSigner } from './env.js'

const commands = {
  '/help': async (event: TrustedEvent) => {
    robot.send(`\n- \`/help\` - display this message\n- \`/approve [id] [optional message]\` - approve an application\n- \`/reject [id] [optional message]\` - reject an application\n- \`/info [id]\` - displays information for the given application`)
  },
  '/approve': async (event: TrustedEvent) => {
    const [_, id, message] = event.content.match(/\/approve (\w+) ?(.*)/) || []

    const application = await database.getApplication(id)

    if (application) {
      await actions.approveApplication({ id, message })

      robot.send(`Successfully approved application ${id}`)
    } else {
      robot.send(`Invalid application id: ${id}`)
    }
  },
  '/reject': async (event: TrustedEvent) => {
    const [_, id, message] = event.content.match(/\/reject (\w+) ?(.*)/) || []

    const application = await database.getApplication(id)

    if (application) {
      await actions.rejectApplication({ id, message })

      robot.send(`Successfully rejected application ${id}`)
    } else {
      robot.send(`Invalid application id: ${id}`)
    }
  },
  '/info': async (event: TrustedEvent) => {
    const [_, id] = event.content.match(/\/info (\w+)/) || []

    const application = await database.getApplication(id)

    if (application) {
      robot.send("```" + Object.entries(application).map(([k, v]) => `${k}: ${v}`).join('\n') + "```")
    } else {
      robot.send(`Invalid application id: ${id}`)
    }
  }
}

export const robot = {
  send: async (content: string) => {
    const template = makeEvent(MESSAGE, { content, tags: [['h', ADMIN_ROOM]] })
    const event = await appSigner.sign(template)

    return publish({ relays: [ADMIN_RELAY], event })
  },
  listen: () => {
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

    return publish({ relays, event: event.wrap })
  },
  loadMessagingRelays: async (pubkey: string) => {
    let relays = ['wss://auth.nostr1.com/', 'wss://inbox.nostr.wine/']

    await request({
      autoClose: true,
      relays: INDEXER_RELAYS,
      filters: [{ kinds: [MESSAGE], '#h': [ADMIN_ROOM], limit: 0 }],
      onEvent: (event: TrustedEvent) => {
        relays = getRelayTagValues(event.tags)
      },
    })

    return relays
  }
}
