import { PORT } from './env.js'
import { server } from './server.js'
import { robot } from './robot.js'
import { database } from './database.js'

process.on('unhandledRejection', (error: Error) => {
  console.log(error.stack)
})

process.on('uncaughtException', (error: Error) => {
  console.log(error.stack)
})

database.migrate().then(async () => {
  robot.listenToAdmin()
  server.listen(PORT, () => {
    console.log('Running on port', PORT)
  })
})
