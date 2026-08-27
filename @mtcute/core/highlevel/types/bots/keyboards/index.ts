import * as BotKeyboard from './factories.js'

export * from './builder.js'
export * from './types.js'

export {
  /**
   * Convenience methods wrapping TL
   * objects creation for bot keyboard buttons.
   *
   * You can also use the type-discriminated objects directly.
   *
   * > **Note**: Buttons are split into inline-only and reply-only ones
   * > (see the description of each function), and passing one where the
   * > other is expected is a type error.
   */
  BotKeyboard,
}
