/**
 * Climate-entity definitions.
 * See <https://github.com/unfoldedcircle/core-api/tree/main/doc/entities> for more information.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */

import { CommandHandler, Entity, EntityType, EntityName } from "./entity.js";
import log from "../loggers.js";

// Climate entity states
export enum ClimateStates {
  Unavailable = "UNAVAILABLE",
  Unknown = "UNKNOWN",
  Off = "OFF",
  Heat = "HEAT",
  Cool = "COOL",
  HeatCool = "HEAT_COOL",
  Fan = "FAN",
  Auto = "AUTO"
}

// Climate entity features
export enum ClimateFeatures {
  OnOff = "on_off",
  Heat = "heat",
  Cool = "cool",
  CurrentTemperature = "current_temperature",
  TargetTemperature = "target_temperature",
  TargetTemperatureRange = "target_temperature_range",
  Fan = "fan"
}

// Climate entity attributes
export enum ClimateAttributes {
  State = "state",
  CurrentTemperature = "current_temperature",
  TargetTemperature = "target_temperature",
  TargetTemperatureHigh = "target_temperature_high",
  TargetTemperatureLow = "target_temperature_low",
  FanMode = "fan_mode"
}

// Climate entity commands
export enum ClimateCommands {
  On = "on",
  Off = "off",
  HvacMode = "hvac_mode",
  TargetTemperature = "target_temperature",
  TargetTemperatureRange = "target_temperature_range",
  FanMode = "fan_mode"
}

// Climate entity device classes
export enum ClimateDeviceClasses {}

// Climate entity options
export enum ClimateOptions {
  TemperatureUnit = "temperature_unit",
  TargetTemperatureStep = "target_temperature_step",
  MaxTemperature = "max_temperature",
  MinTemperature = "min_temperature",
  FanModes = "fan_modes"
}

export enum TemperatureUnit {
  Celsius = "CELSIUS",
  Fahrenheit = "FAHRENHEIT"
}

// Define types for the parameters in the constructor
export interface ClimateParams {
  features?: ClimateFeatures[];
  attributes?: Partial<Record<ClimateAttributes, ClimateStates | number>>;
  deviceClass?: string;
  options?: Partial<Record<ClimateOptions, TemperatureUnit | number>>;
  area?: string;
  cmdHandler?: CommandHandler;
}

export class Climate extends Entity {
  /**
   * Constructs a new climate entity.
   *
   * @param {string} id The entity identifier. Must be unique inside the integration driver.
   * @param {EntityName} name The human-readable name of the entity.
   *        Either a string, which will be mapped to English, or a Map / Object containing multiple language strings.
   * @param {ClimateParams} [params] Entity parameters.
   * @throws AssertionError if invalid parameters are specified.
   */
  constructor(
    id: string,
    name: EntityName,
    { features, attributes, deviceClass, options, area, cmdHandler }: ClimateParams = {}
  ) {
    super(id, name, EntityType.Climate, { features, attributes, deviceClass, options, area, cmdHandler });

    log.debug(`Climate entity created with id: ${this.id}`);
  }
}
