import type { IKeyValueRepository } from '@mtcute/core'

import type { IdbStorageDriver } from '../driver.js'
import { reqToPromise } from '../utils.js'

const KV_TABLE = 'kv'
interface KeyValueDto {
  key: string
  value: Uint8Array
}

// <deno-insert>
// declare type IDBTransactionMode = any
// declare type IDBObjectStore = any
// declare type IDBRequest<T> = { result: T }
// </deno-insert>

export class IdbKvRepository implements IKeyValueRepository {
  constructor(readonly _driver: IdbStorageDriver) {
    _driver.registerMigration(KV_TABLE, 1, (db) => {
      db.createObjectStore(KV_TABLE, { keyPath: 'key' })
    })
  }

  set(key: string, value: Uint8Array): void {
    this._driver.writeLater(KV_TABLE, { key, value } satisfies KeyValueDto)
  }

  private os(mode?: IDBTransactionMode): IDBObjectStore {
    return this._driver.db.transaction(KV_TABLE, mode).objectStore(KV_TABLE)
  }

  get(key: string): Promise<Uint8Array | null> {
    const os = this.os()
    // <deno-tsignore>
    return reqToPromise<KeyValueDto>(os.get(key) as IDBRequest<KeyValueDto>).then((res) => {
      if (res === undefined) return null

      return res.value
    })
  }

  delete(key: string): Promise<void> {
    return reqToPromise(this.os('readwrite').delete(key))
  }

  deleteAll(): Promise<void> {
    return reqToPromise(this.os('readwrite').clear())
  }
}
