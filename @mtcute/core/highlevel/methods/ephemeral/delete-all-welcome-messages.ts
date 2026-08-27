import type { ITelegramClient } from '../../client.types.js'
import type { InputPeerLike } from '../../types/index.js'

import { assertTrue } from '../../../utils/type-assertions.js'
import { resolvePeer } from '../users/resolve-peer.js'

// @available=user
/**
 * Delete all welcome messages configured for a chat
 *
 * @param chatId  Chat to delete the welcome messages for
 */
export async function deleteAllWelcomeMessages(client: ITelegramClient, chatId: InputPeerLike): Promise<void> {
  const r = await client.call({
    _: 'ephemeral.deleteAllWelcomeMessages',
    peer: await resolvePeer(client, chatId),
  })

  assertTrue('ephemeral.deleteAllWelcomeMessages', r)
}
