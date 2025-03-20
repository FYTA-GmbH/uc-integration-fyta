/**
 * Sensor-entity definitions.
 * See <https://github.com/unfoldedcircle/core-api/tree/main/doc/entities> for more information.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */

import { Entity, EntityType, EntityName } from "./entity.js";
import log from "../loggers.js";

/**
 * Sensor entity states.
 */
export enum SensorStates {
  Unavailable = "UNAVAILABLE",
  Unknown = "UNKNOWN",
  On = "ON"
}

/**
 * Sensor entity features.
 */
export enum SensorFeatures {}

/**
 * Sensor entity attributes.
 */
export enum SensorAttributes {
  State = "state",
  Value = "value",
  Unit = "unit"
}

/**
 * Sensor entity commands.
 */
export enum SensorCommands {}

/**
 * Sensor entity device classes.
 */
export enum SensorDeviceClasses {
  Custom = "custom",
  Battery = "battery",
  Current = "current",
  Energy = "energy",
  Humidity = "humidity",
  Power = "power",
  Temperature = "temperature",
  Voltage = "voltage"
}

/**
 * Sensor entity options.
 */
export enum SensorOptions {
  CustomUnit = "custom_unit",
  NativeUnit = "native_unit",
  Decimals = "decimals",
  MinValue = "min_value",
  MaxValue = "max_value"
}

export interface SensorParams {
  attributes?: Partial<Record<SensorAttributes, SensorStates | number | string>>;
  deviceClass?: SensorDeviceClasses;
  options?: Partial<Record<SensorOptions, string | number>>;
  area?: string;
}

export class Sensor extends Entity {
  /**
   * Constructs a new sensor entity.
   *
   * @param id The entity identifier. Must be unique inside the integration driver.
   * @param name The human-readable name of the entity.
   * @param params Entity parameters.
   * @throws AssertionError if invalid parameters are specified.
   */
  constructor(id: string, name: EntityName, { attributes, deviceClass, options, area }: SensorParams = {}) {
    super(id, name, EntityType.Sensor, { attributes, deviceClass, options, area });

    log.debug(`Sensor entity created with id: ${this.id}`);
  }
}
