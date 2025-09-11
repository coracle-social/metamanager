import type { TrustedEvent } from '@welshman/util'
import { MESSAGE, makeEvent } from '@welshman/util'
import { request, publish } from '@welshman/net'
import * as actions from './actions.js'
import * as db from './database.js'
import { ADMIN_RELAY, ADMIN_ROOM, appSigner } from './env.js'

const commands = {
  '/approve': async (event: TrustedEvent) => {
    const [_, id, message] = event.content.match(/\/approve (\w+) ?(.*)/) || []

    const application = await db.getApplication(id)

    if (application) {
      await actions.approveApplication({ id, message })

      robot.send(`Successfully approved application ${id}`)
    } else {
      robot.send(`Invalid application id: ${id}`)
    }
  },
  '/reject': async (event: TrustedEvent) => {
    const [_, id, message] = event.content.match(/\/reject (\w+) ?(.*)/) || []

    const application = await db.getApplication(id)

    if (application) {
      await actions.rejectApplication({ id, message })

      robot.send(`Successfully rejected application ${id}`)
    } else {
      robot.send(`Invalid application id: ${id}`)
    }
  }
}

export const robot = {
  send: async (content: string) => {
    const template = makeEvent(MESSAGE, { content, tags: [['h', ADMIN_ROOM]] })
    const event = await appSigner.sign(template)

    await publish({ relays: [ADMIN_RELAY], event })
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
}
