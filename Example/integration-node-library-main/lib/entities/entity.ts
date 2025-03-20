/**
 * Common entity definitions.
 * See <https://github.com/unfoldedcircle/core-api/tree/main/doc/entities> for more information.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */

import assert from "node:assert";
import { StatusCodes } from "../api_definitions.js";
import log from "../loggers.js";
import { toLanguageObject } from "../utils.js";

/**
 * Available entity types.
 */
export enum EntityType {
  Cover = "cover",
  Button = "button",
  Climate = "climate",
  Light = "light",
  MediaPlayer = "media_player",
  Remote = "remote",
  Sensor = "sensor",
  Switch = "switch"
}

export type EntityName = string | { [key: string]: string };

export type CommandHandler = (
  entity: Entity,
  command: string,
  params?: { [key: string]: string | number | boolean }
) => Promise<StatusCodes>;

export interface EntityParams {
  features?: string[];
  attributes?: { [key: string]: string | string[] | number | boolean };
  deviceClass?: string;
  options?: { [key: string]: string | number | boolean | object };
  area?: string;
  cmdHandler?: CommandHandler;
}

export class Entity {
  public id: string;
  public name: EntityName;
  public entity_type: EntityType;

  public device_id?: string;

  public features?: string[];
  public attributes?: { [key: string]: string | string[] | number | boolean };
  public device_class?: string;
  public options?: { [key: string]: string | number | boolean | object };
  public area?: string;
  #cmdHandler?: CommandHandler;

  /**
   * Constructs a new entity.
   *
   * @param id The entity identifier. Must be unique inside the integration driver.
   * @param name The human-readable name of the entity. Either a string or an object containing multiple language strings.
   * @param entityType One of the defined entity types.
   * @param params Entity parameters.
   */
  constructor(
    id: string,
    name: string | { [key: string]: string },
    entityType: EntityType,
    { features = [], attributes = { state: "UNKNOWN" }, deviceClass, options, area, cmdHandler }: EntityParams = {}
  ) {
    this.id = id;

    const languageName = toLanguageObject(name);
    assert(languageName);
    this.name = languageName || "?";

    this.entity_type = entityType;
    this.features = features;
    this.attributes = attributes;
    this.device_class = deviceClass;
    this.options = options;
    this.area = area;
    this.#cmdHandler = cmdHandler;
  }

  /**
   * Set callback handler for entity command requests.
   * @param cmdHandler Callback handler for entity commands.
   */
  setCmdHandler(cmdHandler: CommandHandler) {
    this.#cmdHandler = cmdHandler;
  }

  /**
   * @return true if a callback handler for entity commands has been installed.
   */
  get hasCmdHandler(): boolean {
    return this.#cmdHandler !== undefined;
  }

  /**
   * Execute entity command with the installed command handler.
   *
   * Returns NOT_IMPLEMENTED if no command handler is installed.
   * @param cmdId the command
   * @param params optional command parameters
   * @return command status code to acknowledge to UC Remote
   */
  async command(cmdId: string, params?: { [key: string]: string | number | boolean }): Promise<StatusCodes> {
    if (this.#cmdHandler) {
      return await this.#cmdHandler(this, cmdId, params);
    }

    log.warn("No command handler for %s: cannot execute command '%s' %s", this.id, cmdId, params || "");

    return StatusCodes.NotImplemented;
  }
}
