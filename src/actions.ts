import * as nip19 from 'nostr-tools/nip19'
import {randomId} from '@welshman/lib'
import {makeSecret} from '@welshman/signer'
import { instrument } from 'succinct-async'
import {writeFile} from 'fs/promises'
import {join} from 'path'
import {ADMIN_PUBKEYS, CONFIG_DIR} from './env.js'
import {slugify, dedent} from './util.js'
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

    // Configure relay

    const secret = makeSecret()
    const schema = slugify(`bitcoinwalk_${application.city}_${randomId().slice(0, 4)}`)
    const host = `${schema}.coracle.chat`
    const name = `BitcoinWalk ${application.city}`
    const zooidConfig = dedent(`
    host = "${host}"
    schema = "${schema}"
    secret = "${secret}"

    [info]
    name = "${name}"
    icon = "https://bitcoinwalk.org/wp-content/uploads/2025/04/cropped-Bitcoin-Walk-Logo-avatar.png"
    pubkey = "${application.pubkey}"
    description = "A BitcoinWalk community for ${application.city}"

    [management]
    enabled = true

    [roles.member]
    can_invite = true

    [roles.admin]
    can_manage = true
    pubkeys = ${JSON.stringify(ADMIN_PUBKEYS)}
    `)

    await writeFile(join(CONFIG_DIR, `${schema}.toml`), zooidConfig, 'utf-8')

    // Notify organizer

    const content = dedent(`
    Congratulations! Your application to start a BitcoinWalk meetup has been approved.

    To access your community, visit https://app.flotilla.social/spaces/${host} and log in with nostr.

    From there, you can generate an invite code that you can share with people interested in joining your group!

    To manage your community, please visit https://landlubber.coracle.social and enter your relay URL: wss://${host}.

    Thanks for participating in BitcoinWalk! Don't hesitate to get in touch if you need anything.
    `)

    const relays = await robot.loadMessagingRelays(application.pubkey)

    await robot.sendDirectMessage(application.pubkey, content, relays)

    // TODO:
    // - Set up DNS
    // - Update website

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
