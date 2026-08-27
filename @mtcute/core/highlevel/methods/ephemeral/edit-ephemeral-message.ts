import type { ITelegramClient } from '../../client.types.js'
import type { ReplyMarkup } from '../../types/bots/keyboards/index.js'
import type { EphemeralMessage, InputMediaLike, InputPeerLike, InputText } from '../../types/index.js'
import type { InputRichMessage, RichMediaUploadCache } from '../../types/messages/rich/types.js'

import { MtArgumentError } from '../../../types/errors.js'
import { BotKeyboard } from '../../types/bots/keyboards/index.js'
import { _normalizeInputMedia } from '../files/normalize-input-media.js'
import { _normalizeInputRichMessage } from '../messages/normalize-rich-message.js'
import { _normalizeInputText } from '../misc/normalize-text.js'
import { resolvePeer, resolveUser } from '../users/resolve-peer.js'
import { _findEphemeralMessageInUpdate } from './find-in-update.js'

/**
 * Edit a previously sent ephemeral message
 */
export async function editEphemeralMessage(
  client: ITelegramClient,
  params: {
    /** Chat where the message was sent (`null` for guest chats) */
    chatId: InputPeerLike | null

    /** User the message is visible to */
    receiverId: InputPeerLike

    /** ID of the message to edit */
    messageId: number

    /** New text of the message */
    text?: InputText

    /** New media of the message */
    media?: InputMediaLike

    /** New rich message content of the message */
    richMessage?: InputRichMessage

    /** New reply markup of the message */
    replyMarkup?: ReplyMarkup

    /** Whether this message is a welcome message template for the chat */
    welcome?: boolean

    /**
     * Whether to invert the media position.
     *
     * Currently only supported for web previews and makes the
     * client render the preview above the caption and not below.
     */
    invertMedia?: boolean

    /** Cache for the uploaded rich message media, see {@link createRichStreamingDraft} */
    uploadCache?: RichMediaUploadCache

    /**
     * Whether to dispatch the returned updates
     * to the client's update handler.
     */
    shouldDispatch?: true
  },
): Promise<EphemeralMessage> {
  const { chatId, receiverId, messageId, text, media, richMessage, replyMarkup, shouldDispatch, uploadCache } = params

  let message: string | undefined
  let entities

  if (text !== undefined) {
    [message, entities] = await _normalizeInputText(client, text)
  }

  const peer = chatId !== null ? await resolvePeer(client, chatId) : undefined

  if (richMessage && !peer) {
    throw new MtArgumentError('richMessage requires chatId to be passed')
  }

  const res = await client.call({
    _: 'ephemeral.editMessage',
    peer,
    receiverId: await resolveUser(client, receiverId),
    id: messageId,
    message,
    entities,
    media: media ? await _normalizeInputMedia(client, media, { uploadPeer: peer }) : undefined,
    richMessage: richMessage
      ? await _normalizeInputRichMessage(client, peer!, richMessage, { uploadCache })
      : undefined,
    replyMarkup: BotKeyboard._convertToTl(replyMarkup),
    welcome: params.welcome,
    invertMedia: params.invertMedia,
  })

  return _findEphemeralMessageInUpdate(client, res, true, !shouldDispatch)
}
