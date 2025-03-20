/**
 * Media-player-entity definitions.
 * See <https://github.com/unfoldedcircle/core-api/tree/main/doc/entities> for more information.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */

import { Entity, EntityType, CommandHandler, EntityName } from "./entity.js";
import log from "../loggers.js";

/**
 * Media-player entity states.
 */
export enum MediaPlayerStates {
  Unavailable = "UNAVAILABLE",
  Unknown = "UNKNOWN",
  On = "ON",
  Off = "OFF",
  Playing = "PLAYING",
  Paused = "PAUSED",
  Standby = "STANDBY",
  Buffering = "BUFFERING"
}

/**
 * Media-player entity features.
 */
export enum MediaPlayerFeatures {
  OnOff = "on_off",
  Toggle = "toggle",
  Volume = "volume",
  VolumeUpDown = "volume_up_down",
  MuteToggle = "mute_toggle",
  Mute = "mute",
  Unmute = "unmute",
  PlayPause = "play_pause",
  Stop = "stop",
  Next = "next",
  Previous = "previous",
  FastForward = "fast_forward",
  Rewind = "rewind",
  Repeat = "repeat",
  Shuffle = "shuffle",
  Seek = "seek",
  MediaDuration = "media_duration",
  MediaPosition = "media_position",
  MediaTitle = "media_title",
  MediaArtist = "media_artist",
  MediaAlbum = "media_album",
  MediaImageUrl = "media_image_url",
  MediaType = "media_type",
  Dpad = "dpad",
  Numpad = "numpad",
  Home = "home",
  Menu = "menu",
  ContextMenu = "context_menu",
  Guide = "guide",
  Info = "info",
  ColorButtons = "color_buttons",
  ChannelSwitcher = "channel_switcher",
  SelectSource = "select_source",
  SelectSoundMode = "select_sound_mode",
  Eject = "eject",
  OpenClose = "open_close",
  AudioTrack = "audio_track",
  Subtitle = "subtitle",
  Record = "record",
  Settings = "settings"
}

/**
 * Media-player entity attributes.
 */
export enum MediaPlayerAttributes {
  State = "state",
  Volume = "volume",
  Muted = "muted",
  MediaDuration = "media_duration",
  MediaPosition = "media_position",
  MediaType = "media_type",
  MediaImageUrl = "media_image_url",
  MediaTitle = "media_title",
  MediaArtist = "media_artist",
  MediaAlbum = "media_album",
  Repeat = "repeat",
  Shuffle = "shuffle",
  Source = "source",
  SourceList = "source_list",
  SoundMode = "sound_mode",
  SoundModeList = "sound_mode_list"
}

/**
 * Media-player entity commands.
 */
export enum MediaPlayerCommands {
  On = "on",
  Off = "off",
  Toggle = "toggle",
  PlayPause = "play_pause",
  Stop = "stop",
  Previous = "previous",
  Next = "next",
  FastForward = "fast_forward",
  Rewind = "rewind",
  Seek = "seek",
  Volume = "volume",
  VolumeUp = "volume_up",
  VolumeDown = "volume_down",
  MuteToggle = "mute_toggle",
  Mute = "mute",
  Unmute = "unmute",
  Repeat = "repeat",
  Shuffle = "shuffle",
  ChannelUp = "channel_up",
  ChannelDown = "channel_down",
  CursorUp = "cursor_up",
  CursorDown = "cursor_down",
  CursorLeft = "cursor_left",
  CursorRight = "cursor_right",
  CursorEnter = "cursor_enter",
  Digit0 = "digit_0",
  Digit1 = "digit_1",
  Digit2 = "digit_2",
  Digit3 = "digit_3",
  Digit4 = "digit_4",
  Digit5 = "digit_5",
  Digit6 = "digit_6",
  Digit7 = "digit_7",
  Digit8 = "digit_8",
  Digit9 = "digit_9",
  FunctionRed = "function_red",
  FunctionGreen = "function_green",
  FunctionYellow = "function_yellow",
  FunctionBlue = "function_blue",
  Home = "home",
  Menu = "menu",
  ContextMenu = "context_menu",
  Guide = "guide",
  Info = "info",
  Back = "back",
  SelectSource = "select_source",
  SelectSoundMode = "select_sound_mode",
  Record = "record",
  MyRecordings = "my_recordings",
  Live = "live",
  Eject = "eject",
  OpenClose = "open_close",
  AudioTrack = "audio_track",
  Subtitle = "subtitle",
  Settings = "settings",
  Search = "search"
}

/**
 * Media-player entity device classes.
 */
export enum MediaPlayerDeviceClasses {
  Receiver = "receiver",
  SetTopBox = "set_top_box",
  Speaker = "speaker",
  StreamingBox = "streaming_box",
  TV = "tv"
}

/**
 * Media-player entity options.
 */
export enum MediaPlayerOptions {
  SimpleCommands = "simple_commands",
  VolumeSteps = "volume_steps"
}

/**
 * Media types.
 */
export enum MediaType {
  Music = "MUSIC",
  Radio = "RADIO",
  TVShow = "TVSHOW",
  Movie = "MOVIE",
  Video = "VIDEO"
}

/**
 * Repeat modes.
 */
export enum RepeatMode {
  Off = "OFF",
  All = "ALL",
  One = "ONE"
}

//export type CmdHandler = (entity: Entity, command: string, options?: Record<string, unknown>) => Promise<string>;

export interface MediaPlayerParams {
  features?: MediaPlayerFeatures[];
  attributes?: Partial<
    Record<MediaPlayerAttributes, MediaPlayerStates | RepeatMode | string | string[] | number | boolean>
  >;
  deviceClass?: MediaPlayerDeviceClasses;
  options?: Partial<Record<MediaPlayerOptions, string[] | number>>;
  area?: string;
  cmdHandler?: CommandHandler;
}

/**
 * See {@link https://github.com/unfoldedcircle/core-api/blob/main/doc/entities/entity_media_player.md media-player entity documentation}
 * for more information.
 */

export class MediaPlayer extends Entity {
  /**
   * Constructs a new media-player entity.
   *
   * @param {string} id The entity identifier. Must be unique inside the integration driver.
   * @param name The human-readable name of the entity.
   *        Either a string, which will be mapped to English, or a Map / Object containing multiple language strings.
   * @param {MediaPlayerParams} [params] Entity parameters.
   * @throws AssertionError if invalid parameters are specified.
   */
  constructor(
    id: string,
    name: EntityName,
    { features, attributes, deviceClass, options, area, cmdHandler }: MediaPlayerParams = {}
  ) {
    super(id, name, EntityType.MediaPlayer, { features, attributes, deviceClass, options, area, cmdHandler });

    log.debug(`MediaPlayer entity created with id: ${this.id}`);
  }
}
