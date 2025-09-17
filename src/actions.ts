import * as nip19 from 'nostr-tools/nip19'
import { instrument } from 'succinct-async'
import type {
  ApplicationParams,
  ApplicationApprovalParams,
  ApplicationRejectionParams,
} from './domain.js'
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
    const npub = nip19.npubEncode(application.pubkey)

    robot.send(`New application (ID: ${application.id}) "${application.city}" from nostr:${npub}\n${application.pin}`)

    return application
  }
)

const approveApplication = instrument(
  'actions.approveApplication',
  async (params: ApplicationApprovalParams) => {
    const application = await database.approveApplication(params)

    // TODO:
    // - Set up DNS
    // - Update website
    // - Notify organizer
    // - Configure and start relay

    return application
  }
)

const rejectApplication = instrument(
  'actions.rejectApplication',
  async (params: ApplicationRejectionParams) => {
    const application = await database.rejectApplication(params)

    // TODO:
    // - Notify organizer

    return application
  }
)

export const actions = {
  createApplication,
  approveApplication,
  rejectApplication,
}
