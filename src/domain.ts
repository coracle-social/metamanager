export type ApplicationParams = {
  pubkey: string
  city: string
  pin: string
}

export type Application = ApplicationParams & {
  id: string
  created_at: number
  approved_at: number
  rejected_at: number
}

export type ApplicationApprovalParams = {
  id: string
  message: string
}

export type ApplicationRejectionParams = {
  id: string
  message: string
}
