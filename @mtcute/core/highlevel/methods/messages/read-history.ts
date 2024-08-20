import { assertTrue } from '../../../utils/type-assertions.js'
import type { ITelegramClient } from '../../client.types.js'
import type { InputPeerLike } from '../../types/index.js'
import { createDummyUpdate } from '../../updates/utils.js'
import { isInputPeerChannel, toInputChannel } from '../../utils/peer-utils.js'
import { resolvePeer } from '../users/resolve-peer.js'

/**
 * Mark chat history as read.
 *
 * @param chatId  Chat ID
 */
export async function readHistory(
    client: ITelegramClient,
    chatId: InputPeerLike,
    params?: {
        /**
         * Message up until which to read history
         *
         * @default  0, i.e. read everything
         */
        maxId?: number

        /**
         * Whether to also clear all mentions in the chat
         */
        clearMentions?: boolean

        /**
         * Whether to dispatch updates that will be generated by this call.
         * Doesn't follow `disableNoDispatch`
         */
        shouldDispatch?: true
    },
): Promise<void> {
    const { maxId = 0, clearMentions, shouldDispatch } = params ?? {}

    const peer = await resolvePeer(client, chatId)

    if (clearMentions) {
        const res = await client.call({
            _: 'messages.readMentions',
            peer,
        })

        if (!shouldDispatch) {
            if (isInputPeerChannel(peer)) {
                client.handleClientUpdate(createDummyUpdate(res.pts, res.ptsCount, peer.channelId))
            } else {
                client.handleClientUpdate(createDummyUpdate(res.pts, res.ptsCount))
            }
        }
    }

    if (isInputPeerChannel(peer)) {
        const r = await client.call({
            _: 'channels.readHistory',
            channel: toInputChannel(peer),
            maxId,
        })

        assertTrue('channels.readHistory', r)
    } else {
        const res = await client.call({
            _: 'messages.readHistory',
            peer,
            maxId,
        })

        if (!shouldDispatch) {
            client.handleClientUpdate(createDummyUpdate(res.pts, res.ptsCount))
        }
    }
}
