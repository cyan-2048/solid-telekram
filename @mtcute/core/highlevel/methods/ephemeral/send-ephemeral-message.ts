import type { tl } from '../../../tl/index.js'
import type { ITelegramClient } from '../../client.types.js'
import type { ReplyMarkup } from '../../types/bots/keyboards/index.js'
import type { EphemeralMessage, InputMediaLike, InputPeerLike, InputText } from '../../types/index.js'
import type { InputRichMessage, RichMediaUploadCache } from '../../types/messages/rich/types.js'

import { MtArgumentError } from '../../../types/errors.js'
import { randomLong } from '../../../utils/long-utils.js'
import { BotKeyboard } from '../../types/bots/keyboards/index.js'
import { _normalizeInputMedia } from '../files/normalize-input-media.js'
import { _normalizeInputRichMessage } from '../messages/normalize-rich-message.js'
import { _normalizeInputText } from '../misc/normalize-text.js'
import { resolvePeer, resolveUser } from '../users/resolve-peer.js'
import { _findEphemeralMessageInUpdate } from './find-in-update.js'

/**
 * Send an ephemeral message — a message that is only visible
 * to a single user in a chat and is not persisted in the chat history.
 *
 * @param chatId  ID of the chat to send the message to (`null` for guest chats, where `queryId` is used instead)
 * @param receiverId  ID of the user the message should be visible to
 * @param text  Text of the message
 */
export async function sendEphemeralMessage(
  client: ITelegramClient,
  chatId: InputPeerLike | null,
  receiverId: InputPeerLike,
  text: InputText,
  params?: {
    /** Media to be attached to the message */
    media?: InputMediaLike

    /** Rich message content to be sent instead of the plain text */
    richMessage?: InputRichMessage

    /** Message to reply to */
    replyTo?: number

    /** Ephemeral message to reply to */
    replyToEphemeral?: number

    /** Reply markup to be attached to the message */
    replyMarkup?: ReplyMarkup

    /** For guest chat bots, ID of the query that this message is sent in response to */
    queryId?: tl.Long

    /** Whether to send this message as a welcome message template for the chat */
    welcome?: boolean

    /** Whether to anchor this message to the message it replies to */
    anchor?: boolean

    /**
     * Whether to invert the media position.
     *
     * Currently only supported for web previews and makes the
     * client render the preview above the caption and not below.
     */
    invertMedia?: boolean

    /** Whether to forbid forwarding this message */
    forbidForwards?: boolean

    /** Cache for the uploaded rich message media, see {@link createRichStreamingDraft} */
    uploadCache?: RichMediaUploadCache

    /**
     * Whether to dispatch the returned updates
     * to the client's update handler.
     */
    shouldDispatch?: true
  },
): Promise<EphemeralMessage> {
  const { media, richMessage, replyTo, replyToEphemeral, queryId, shouldDispatch, uploadCache } = params ?? {}

  const [message, entities] = await _normalizeInputText(client, text)

  const peer = chatId !== null ? await resolvePeer(client, chatId) : undefined

  if (richMessage && !peer) {
    throw new MtArgumentError('richMessage requires chatId to be passed')
  }

  let replyToTl: tl.TypeInputReplyTo | undefined
  if (replyTo !== undefined) {
    replyToTl = { _: 'inputReplyToMessage', replyToMsgId: replyTo }
  } else if (replyToEphemeral !== undefined) {
    replyToTl = { _: 'inputReplyToEphemeralMessage', id: replyToEphemeral }
  }

  const res = await client.call({
    _: 'ephemeral.sendMessage',
    peer,
    receiverId: await resolveUser(client, receiverId),
    queryId,
    message,
    entities,
    media: media ? await _normalizeInputMedia(client, media, { uploadPeer: peer }) : undefined,
    richMessage: richMessage
      ? await _normalizeInputRichMessage(client, peer!, richMessage, { uploadCache })
      : undefined,
    replyMarkup: BotKeyboard._convertToTl(params?.replyMarkup),
    randomId: randomLong(),
    replyTo: replyToTl,
    welcome: params?.welcome,
    anchor: params?.anchor,
    invertMedia: params?.invertMedia,
    noforwards: params?.forbidForwards,
  })

  return _findEphemeralMessageInUpdate(client, res, false, !shouldDispatch)
}
