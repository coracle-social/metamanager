import {toTitleCase} from './util.js'

export type ApplicationParams = {
  name: string
  pubkey: string
  metadata: Record<string, string>
}

export type Application = ApplicationParams & {
  schema: string
  created_at: number
  approved_at: number
  rejected_at: number
}

export type ApplicationApprovalParams = {
  schema: string
  message: string
}

export type ApplicationRejectionParams = {
  schema: string
  message: string
}

export const getMetadata = (application: Application) =>
  Object.entries(application.metadata)
    .map(([key, value]) => ({Key: toTitleCase(key), Value: value}))
