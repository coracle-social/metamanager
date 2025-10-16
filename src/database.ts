/* eslint @typescript-eslint/no-unused-vars: 0 */

import sqlite3 from 'sqlite3'
import { instrument } from 'succinct-async'
import type {
  ApplicationParams,
  ApplicationApprovalParams,
  ApplicationRejectionParams,
  Application,
} from './domain.js'
import { DATABASE_PATH } from './env.js'

const db = new sqlite3.Database(DATABASE_PATH)

type Param = number | string | boolean

type Row = Record<string, any>

const run = (query: string, params: Param[] = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      return err ? reject(err) : resolve(this.changes > 0)
    })
  })

// prettier-ignore
const all = <T=Row>(query: string, params: Param[] = []) =>
  new Promise<T[]>((resolve, reject) => {
    db.all(query, params, (err, rows: T[]) => (err ? reject(err) : resolve(rows)))
  })

// prettier-ignore
const get = <T=Row>(query: string, params: Param[] = []) =>
  new Promise<T | undefined>((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err)
      } else if (row) {
        resolve(row as T)
      } else {
        resolve(undefined)
      }
    })
  })

const exists = (query: string, params: Param[] = []) =>
  new Promise<boolean>((resolve, reject) => {
    db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows.length > 0)))
  })

async function assertResult<T>(p: T | Promise<T>) {
  return (await p)!
}

// Migrations

const addColumnIfNotExists = async (tableName: string, columnName: string, columnDef: string) => {
  try {
    const tableInfo = await all(`PRAGMA table_info(${tableName})`)
    const columnExists = tableInfo.some((col: any) => col.name === columnName)

    if (!columnExists) {
      await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`)
    }
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      throw err
    }
  }
}

const migrate = () =>
  new Promise<void>(async (resolve, reject) => {
    try {
      db.serialize(async () => {
        await run(
          `
          CREATE TABLE IF NOT EXISTS application (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pubkey TEXT NOT NULL,
            city TEXT NOT NULL,
            pin TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            approved_at INTEGER,
            approved_message TEXT,
            rejected_at INTEGER,
            rejected_message TEXT
          )
        `
        )
        resolve()
      })
    } catch (err) {
      reject(err)
    }
  })

// Applications

const getApplication = instrument(
  'database.getApplication',
  (id: string) => get<Application>(`SELECT * FROM application WHERE ID = ?`, [id])
)

const createApplication = instrument(
  'database.createApplication',
  async ({ pubkey, city, pin }: ApplicationParams) => {
    return assertResult(
      await get<Application>(
        `INSERT INTO application (pubkey, city, pin, created_at)
         VALUES (?, ?, ?, unixepoch()) RETURNING *`,
        [pubkey, city, pin]
      )
    )
  }
)

const approveApplication = instrument(
  'database.approveApplication',
  async ({ id, message }: ApplicationApprovalParams) => {
    return assertResult(
      await get<Application>(
        `UPDATE application SET rejected_at = null, rejected_message = null, approved_at = unixepoch(), approved_message = ?
         WHERE id = ? RETURNING *`,
        [message, id]
      )
    )
  }
)

const rejectApplication = instrument(
  'database.rejectApplication',
  async ({ id, message }: ApplicationRejectionParams) => {
    return assertResult(
      await get<Application>(
        `UPDATE application SET approved_at = null, approved_message = null, rejected_at = unixepoch(), rejected_message = ?
         WHERE id = ? RETURNING *`,
        [message, id]
      )
    )
  }
)

export const database = {
  migrate,
  getApplication,
  createApplication,
  approveApplication,
  rejectApplication,
}
