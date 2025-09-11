import { instrument } from 'succinct-async'
import type {
  ApplicationParams,
  ApplicationApprovalParams,
  ApplicationRejectionParams,
} from './domain.js'
import * as db from './database.js'

export class ActionError extends Error {
  toString() {
    return this.message
  }
}

export const createApplication = instrument(
  'actions.createApplication',
  async (params: ApplicationParams) => {
    const application = await db.createApplication(params)

    // TODO: send message to admin using admin relays/room

    return application
  }
)

export const approveApplication = instrument(
  'actions.approveApplication',
  async (params: ApplicationApprovalParams) => {
    const application = await db.approveApplication(params)

    // TODO:
    // - Set up DNS
    // - Update website
    // - Notify organizer
    // - Configure and start relay

    return application
  }
)

export const rejectApplication = instrument(
  'actions.rejectApplication',
  async (params: ApplicationRejectionParams) => {
    const application = await db.rejectApplication(params)

    // TODO:
    // - Notify organizer

    return application
  }
)
