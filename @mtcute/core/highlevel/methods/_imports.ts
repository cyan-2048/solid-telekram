/* eslint-disable unused-imports/no-unused-imports */

// @copy
import { tdFileId } from '@mtcute/file-id'
// @copy
import { tl } from '@mtcute/tl'

// @copy
import { RpcCallOptions } from '../../network/index.js'
// @copy
import { MaybeArray, MaybePromise, MtUnsupportedError, PartialExcept, PartialOnly } from '../../types/index.js'
// @copy
import { BaseTelegramClient, BaseTelegramClientOptions } from '../base.js'
// @copy
import { ITelegramClient } from '../client.types.js'
// @copy
import {
    AllStories,
    ArrayPaginated,
    ArrayWithTotal,
    Boost,
    BoostSlot,
    BoostStats,
    BotChatJoinRequestUpdate,
    BotCommands,
    BotReactionCountUpdate,
    BotReactionUpdate,
    BotStoppedUpdate,
    BusinessCallbackQuery,
    BusinessChatLink,
    BusinessConnection,
    BusinessMessage,
    BusinessWorkHoursDay,
    CallbackQuery,
    Chat,
    ChatEvent,
    ChatInviteLink,
    ChatInviteLinkMember,
    ChatJoinRequestUpdate,
    ChatMember,
    ChatMemberUpdate,
    ChatPreview,
    ChatlistPreview,
    ChosenInlineResult,
    CollectibleInfo,
    DeleteBusinessMessageUpdate,
    DeleteMessageUpdate,
    DeleteStoryUpdate,
    Dialog,
    FactCheck,
    FileDownloadLocation,
    FileDownloadParameters,
    ForumTopic,
    FullChat,
    GameHighScore,
    HistoryReadUpdate,
    InlineCallbackQuery,
    InlineQuery,
    InputChatEventFilters,
    InputDialogFolder,
    InputFileLike,
    InputInlineResult,
    InputMediaLike,
    InputMediaSticker,
    InputMessageId,
    InputPeerLike,
    InputPrivacyRule,
    InputReaction,
    InputStickerSet,
    InputStickerSetItem,
    InputText,
    MaybeDynamic,
    Message,
    MessageEffect,
    MessageMedia,
    MessageReactions,
    ParametersSkip2,
    ParsedUpdate,
    PeerReaction,
    PeerStories,
    PeersIndex,
    Photo,
    Poll,
    PollUpdate,
    PollVoteUpdate,
    PreCheckoutQuery,
    RawDocument,
    ReplyMarkup,
    SentCode,
    StarGift,
    StarsStatus,
    StarsTransaction,
    Sticker,
    StickerSet,
    StickerSourceType,
    StickerType,
    StoriesStealthMode,
    Story,
    StoryInteractions,
    StoryUpdate,
    StoryViewer,
    StoryViewersList,
    TakeoutSession,
    TextWithEntities,
    TypingStatus,
    UploadFileLike,
    UploadedFile,
    User,
    UserStarGift,
    UserStatusUpdate,
    UserTypingUpdate,
} from '../types/index.js'
// @copy
import { StringSessionData } from '../utils/string-session.js'
