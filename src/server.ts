import { instrument } from 'succinct-async'
import express, { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { actions, ActionError } from './actions.js'
import type { ApplicationParams } from './domain.js'

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
