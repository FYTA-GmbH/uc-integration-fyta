/**
 * Cover-entity definitions.
 * See <https://github.com/unfoldedcircle/core-api/tree/main/doc/entities> for more information.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */

import { CommandHandler, Entity, EntityType, EntityName } from "./entity.js";
import log from "../loggers.js";

// Cover entity states
export enum CoverStates {
  Unavailable = "UNAVAILABLE",
  Unknown = "UNKNOWN",
  Opening = "OPENING",
  Open = "OPEN",
  Closing = "CLOSING",
  Closed = "CLOSED"
}

// Cover entity features
export enum CoverFeatures {
  Open = "open",
  Close = "close",
  Stop = "stop",
  Position = "position",
  Tilt = "tilt",
  TiltStop = "tilt_stop",
  TiltPosition = "tilt_position"
}

// Cover entity attributes
export enum CoverAttributes {
  State = "state",
  Position = "position",
  TiltPosition = "tilt_position"
}

// Cover entity commands
export enum CoverCommands {
  Open = "open",
  Close = "close",
  Stop = "stop",
  Position = "position",
  Tilt = "tilt",
  TiltUp = "tilt_up",
  TiltDown = "tilt_down",
  TiltStop = "tilt_stop"
}

// Cover entity device classes
export enum CoverDeviceClasses {
  Blind = "blind",
  Curtain = "curtain",
  Garage = "garage",
  Shade = "shade",
  Door = "door",
  Gate = "gate",
  Window = "window"
}

// Cover entity options
export enum CoverOptions {}

// Define types for the parameters in the constructor
export interface CoverParams {
  features?: CoverFeatures[];
  attributes?: Partial<Record<CoverAttributes, CoverStates | number>>;
  deviceClass?: CoverDeviceClasses;
  options?: { [key: string]: string };
  area?: string;
  cmdHandler?: CommandHandler;
}

export class Cover extends Entity {
  /**
   * Constructs a new cover entity.
   *
   * @param {string} id The entity identifier. Must be unique inside the integration driver.
   * @param {EntityName} name The human-readable name of the entity.
   *        Either a string, which will be mapped to English, or a Map / Object containing multiple language strings.
   * @param {CoverParams} [params] Entity parameters.
   * @throws AssertionError if invalid parameters are specified.
   */
  constructor(
    id: string,
    name: EntityName,
    { features, attributes, deviceClass, options, area, cmdHandler }: CoverParams = {}
  ) {
    super(id, name, EntityType.Cover, { features, attributes, deviceClass, options, area, cmdHandler });

    log.debug(`Cover entity created with id: ${this.id}`);
  }
}
