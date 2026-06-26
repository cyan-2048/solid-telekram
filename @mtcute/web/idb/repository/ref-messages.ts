import type { IReferenceMessagesRepository } from '@mtcute/core'

import type { IdbStorageDriver } from '../driver.js'
import { reqToPromise, txToPromise } from '../utils.js'

const TABLE = 'messageRefs'

interface MessageRefDto {
  peerId: number
  chatId: number
  msgId: number
}

// <deno-insert>
// declare type IDBTransactionMode = any
// declare type IDBObjectStore = any
// declare type IDBValidKey = any
// declare type IDBRequest<T> = { result: T }
// declare type IDBCursorWithValue = { delete: () => void, continue: () => void }
// </deno-insert>

export class IdbRefMsgRepository implements IReferenceMessagesRepository {
  constructor(readonly _driver: IdbStorageDriver) {
    _driver.registerMigration(TABLE, 1, (db) => {
      const os = db.createObjectStore(TABLE, { keyPath: ['peerId', 'chatId', 'msgId'] })
      os.createIndex('by_peer', 'peerId')
      os.createIndex('by_msg', ['chatId', 'msgId'])
    })
  }

  private os(mode?: IDBTransactionMode): IDBObjectStore {
    return this._driver.db.transaction(TABLE, mode).objectStore(TABLE)
  }

  store(peerId: number, chatId: number, msgId: number): Promise<void> {
    const os = this.os('readwrite')

    return reqToPromise(os.put({ peerId, chatId, msgId } satisfies MessageRefDto)).then(() => {})
  }

  getByPeer(peerId: number): Promise<[number, number] | null> {
    const os = this.os()
    const index = os.index('by_peer')

    // <deno-tsignore>
    return reqToPromise<MessageRefDto>(index.get(peerId) as IDBRequest<MessageRefDto>).then((it) => {
      if (!it) return null

      return [it.chatId, it.msgId]
    })
  }

  delete(chatId: number, msgIds: number[]): Promise<void> {
    const tx = this._driver.db.transaction(TABLE, 'readwrite')
    const os = tx.objectStore(TABLE)
    const index = os.index('by_msg')

    let idx = 0
    const processNext = () => {
      if (idx >= msgIds.length) return

      const req = index.getAllKeys([chatId, msgIds[idx++]])
      req.onsuccess = () => {
        const keys = req.result as IDBValidKey[]
        for (const key of keys) {
          os.delete(key)
        }

        processNext()
      }
    }

    processNext()

    return txToPromise(tx)
  }

  deleteByPeer(peerId: number): Promise<void> {
    const tx = this._driver.db.transaction(TABLE, 'readwrite')
    const os = tx.objectStore(TABLE)
    const index = os.index('by_peer')

    const req = index.openCursor(peerId)

    req.onsuccess = () => {
      const cursor = req.result as IDBCursorWithValue | null
      if (!cursor) return

      cursor.delete()
      cursor.continue()
    }

    return txToPromise(tx)
  }

  deleteAll(): Promise<void> {
    return reqToPromise(this.os('readwrite').clear())
  }
}
