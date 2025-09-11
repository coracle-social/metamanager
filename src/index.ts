import { PORT } from './env.js'
import { server } from './server.js'
import { robot } from './robot.js'
import { migrate } from './database.js'

process.on('unhandledRejection', (error: Error) => {
  console.log(error.stack)
})

process.on('uncaughtException', (error: Error) => {
  console.log(error.stack)
})

migrate().then(async () => {
  robot.listen()
  server.listen(PORT, () => {
    console.log('Running on port', PORT)
  })
})
