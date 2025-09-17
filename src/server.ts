import { instrument } from 'succinct-async'
import express, { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { render } from './templates.js'
import * as actions from './actions.js'
import type { ApplicationParams } from './domain.js'

// Endpoints

export const server = express()

server.use(express.urlencoded({ extended: true }))

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

addRoute('get', '/', async (req: Request, res: Response) => {
  return res.send(await render('pages/signup.html'))
})

addRoute('post', '/application/create', async (req: Request, res: Response) => {
  console.log(req.body)
  await actions.createApplication(req.body as ApplicationParams)

  res.send(await render('pages/signup-complete.html'))
})

server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err) {
    if (err instanceof actions.ActionError) {
      res.status(400).send({ error: err.message })
    } else {
      console.log('Unhandled error', err)
      res.status(500).send({ error: 'Internal server error' })
    }
  } else {
    next()
  }
})
