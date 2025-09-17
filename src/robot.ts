import type { TrustedEvent } from '@welshman/util'
import { MESSAGE, makeEvent } from '@welshman/util'
import { request, publish } from '@welshman/net'
import { actions } from './actions.js'
import { database } from './database.js'
import { ADMIN_RELAY, ADMIN_ROOM, appSigner } from './env.js'

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
