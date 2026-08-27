import type { ITelegramClient } from '../../client.types.js'
import type { InputPeerLike } from '../../types/index.js'

import { assertTrue } from '../../../utils/type-assertions.js'
import { resolvePeer } from '../users/resolve-peer.js'

// @available=user
/**
 * Delete a welcome message configured for a chat
 *
 * @param chatId  Chat where the welcome message is configured
 * @param messageId  ID of the welcome message to delete
 */
export async function deleteWelcomeMessage(
  client: ITelegramClient,
  chatId: InputPeerLike,
  messageId: number,
): Promise<void> {
  const r = await client.call({
    _: 'ephemeral.deleteWelcomeMessage',
    peer: await resolvePeer(client, chatId),
    id: messageId,
  })

  assertTrue('ephemeral.deleteWelcomeMessage', r)
}
