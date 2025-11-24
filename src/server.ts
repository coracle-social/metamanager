import { instrument } from 'succinct-async'
import express, { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { NWCClient } from '@getalby/sdk/nwc'
import { actions, ActionError } from './actions.js'
import { NWC_URL, SATS_PER_MONTH } from './env.js'

// Endpoints

export const server = express()

server.use(express.json())
server.use('/assets', express.static('src/assets'))

server.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }

  next()
})

server.use(
  rateLimit({
    limit: 30,
    windowMs: 5 * 60 * 1000,
    validate: { xForwardedForHeader: false },
  })
)

type Handler = (req: Request, res: Response) => Promise<any>

const addRoute = (method: 'get' | 'post', path: string, handler: Handler) => {
  server[method](
    path,
    instrument(path, async (req: Request, res: Response, next: NextFunction) => {
      try {
        await handler(req, res)
      } catch (e) {
        next(e)
      }
    })
  )
}

addRoute('get', '/invoice', async (req: Request, res: Response) => {
  if (SATS_PER_MONTH === 0) {
    return res.json({ invoice: null })
  }

  if (!NWC_URL) {
    return res.status(500).json({ error: 'Payment system not configured' })
  }

  try {
    const nwc = new NWCClient({ nostrWalletConnectUrl: NWC_URL })

    const result = await nwc.makeInvoice({
      amount: SATS_PER_MONTH * 1000, // Convert sats to millisats
      description: 'Relay subscription payment',
    })

    res.json({ invoice: result.invoice })
  } catch (error: any) {
    console.error('Failed to generate invoice:', error)
    res.status(500).json({ error: 'Failed to generate invoice' })
  }
})

addRoute('post', '/apply', async (req: Request, res: Response) => {
  const error = await actions.createApplication(req.body)

  res.json({ error })
})

server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err) {
    if (err instanceof ActionError) {
      res.status(400).send({ error: err.message })
    } else {
      console.log('Unhandled error', err)
      res.status(500).send({ error: 'Internal server error' })
    }
  } else {
    next()
  }
})
