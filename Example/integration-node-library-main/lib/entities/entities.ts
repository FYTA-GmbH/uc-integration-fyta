/**
 * Entity pools for available and configured entities during runtime.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */

import { EventEmitter } from "events";
import { Entity } from "./entity.js";
import { Events } from "../api_definitions.js";
import log from "../loggers.js";

export class Entities extends EventEmitter {
  #storage: { [key: string]: Entity };

  constructor(public id: string) {
    super();
    this.#storage = {};
  }

  contains(id: string): boolean {
    return !!this.#storage[id];
  }

  getEntity(id: string): Entity | null {
    if (!this.#storage[id]) {
      log.warn(`ENTITIES(${this.id}): Entity does not exist: ${id}`);
      return null;
    }
    return this.#storage[id];
  }

  addAvailableEntity(entity: Entity): boolean {
    if (this.#storage[entity.id]) {
      log.warn(`ENTITIES(${this.id}): Entity is already in storage: ${entity.id}`);
      return false;
    }
    this.#storage[entity.id] = entity;

    log.debug(`ENTITIES(${this.id}): Entity added: ${entity.id}`);
    return true;
  }

  removeEntity(id: string): boolean {
    if (!this.#storage[id]) {
      log.warn(`ENTITIES(${this.id}): Entity does not exist: ${id}`);
      return false;
    }

    delete this.#storage[id];

    log.debug(`ENTITIES(${this.id}): Entity removed: ${id}`);
    return true;
  }

  /**
   * Update or merge the provided attributes into an entity.
   *
   * @param {string} id The entity_id
   * @param {Record<string, any>} attributes The attributes to merge into the entity's attributes
   * @returns {boolean} false if entity doesn't exist, true if attributes were merged.
   */
  updateEntityAttributes(id: string, attributes: { [key: string]: string | number | boolean }): boolean {
    if (!this.contains(id)) {
      return false;
    }

    if (this.#storage[id] && this.#storage[id].attributes) {
      for (const key in attributes) {
        this.#storage[id].attributes[key] = attributes[key];
      }
    }

    this.emit(Events.EntityAttributesUpdated, id, this.#storage[id].entity_type, attributes);

    return true;
  }

  getEntities(): Array<Record<string, object | string | null | undefined>> {
    const entities: Array<Record<string, object | string | null | undefined>> = [];

    Object.entries(this.#storage).forEach(([, value]) => {
      const entity = {
        entity_id: value.id,
        entity_type: value.entity_type,
        device_id: value.device_id,
        features: value.features,
        name: value.name,
        area: value.area,
        device_class: value.device_class,
        options: value.options
      };

      entities.push(entity);
    });

    return entities;
  }

  getStates(): Array<Record<string, object | string | null | undefined>> {
    const entities: Array<Record<string, object | string | null | undefined>> = [];

    Object.entries(this.#storage).forEach(([, value]) => {
      const entity = {
        entity_id: value.id,
        entity_type: value.entity_type,
        device_id: value.device_id,
        attributes: value.attributes
      };

      entities.push(entity);
    });

    return entities;
  }

  clear(): void {
    this.#storage = {};
  }
}
