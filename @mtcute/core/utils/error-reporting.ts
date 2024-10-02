import type { tl } from '@mtcute/tl'

import type { Logger } from './logger.js'

export function reportUnknownError(log: Logger, error: tl.RpcError, method: string): void {
    if (typeof fetch !== 'function') return

    fetch(`https://report-rpc-error.madelineproto.xyz/?code=${error.code}&method=${method}&error=${error.text}`)
        .then(r => r.json())
        .then((r) => {
            if (r.result) {
                log.info('telerpc responded with error info for %s: %s', error.text, r.result)
            } else {
                log.info(
                    'Reported error %s to telerpc. You can disable this using `enableErrorReporting: false`',
                    error.text,
                )
            }
        })
        .catch((e) => {
            log.debug('failed to report error %s to telerpc: %e', error.text, e)
        })
}
