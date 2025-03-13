/**
 * Entity Manager for FYTA integration
 * Manages the creation and updating of sensor entities
 */
class EntityManager {
  constructor() {
    this.entities = new Map();
    this.entityDefinitions = new Map();
  }

  /**
   * Create a sensor entity definition
   * @param {string} sensorId - FYTA sensor ID
   * @param {string} sensorName - FYTA sensor name
   * @param {string} measurementType - Type of measurement (temperature, moisture, light, fertility)
   * @returns {Object} - Entity definition
   */
  createSensorEntity(sensorId, sensorName, measurementType) {
    const entityId = `${sensorId}_${measurementType}`;
    let entity = {
      entity_id: entityId,
      name: { en: `${sensorName} ${measurementType}` },
      features: {},
      attributes: {}
    };

    switch (measurementType) {
      case 'temperature':
        entity.entity_type = 'sensor';
        entity.features = {
          temperature: { min: -10, max: 50, step: 0.1, unit: '°C' }
        };
        entity.attributes = {
          temperature: 0
        };
        break;
      case 'moisture':
        entity.entity_type = 'sensor';
        entity.features = {
          moisture: { min: 0, max: 100, step: 1, unit: '%' }
        };
        entity.attributes = {
          moisture: 0
        };
        break;
      case 'light':
        entity.entity_type = 'sensor';
        entity.features = {
          light: { min: 0, max: 100000, step: 1, unit: 'lux' }
        };
        entity.attributes = {
          light: 0
        };
        break;
      case 'fertility':
        entity.entity_type = 'sensor';
        entity.features = {
          fertility: { min: 0, max: 1000, step: 1, unit: 'µS/cm' }
        };
        entity.attributes = {
          fertility: 0
        };
        break;
      case 'battery':
        entity.entity_type = 'sensor';
        entity.features = {
          battery: { min: 0, max: 100, step: 1, unit: '%' }
        };
        entity.attributes = {
          battery: 0
        };
        break;
      default:
        throw new Error(`Unknown measurement type: ${measurementType}`);
    }

    this.entityDefinitions.set(entityId, entity);
    return entity;
  }

  /**
   * Get all entity definitions
   * @returns {Array} - Array of entity definitions
   */
  getAllEntityDefinitions() {
    return Array.from(this.entityDefinitions.values());
  }

  /**
   * Get entity definition by ID
   * @param {string} entityId - Entity ID
   * @returns {Object|undefined} - Entity definition or undefined if not found
   */
  getEntityDefinition(entityId) {
    return this.entityDefinitions.get(entityId);
  }

  /**
   * Update entity state
   * @param {string} entityId - Entity ID
   * @param {Object} attributes - Entity attributes to update
   * @returns {Object|null} - Updated entity state or null if entity not found
   */
  updateEntityState(entityId, attributes) {
    if (!this.entities.has(entityId)) {
      // Initialize entity state if it doesn't exist
      this.entities.set(entityId, {});
    }

    const entity = this.entities.get(entityId);
    const updatedEntity = { ...entity, ...attributes };
    this.entities.set(entityId, updatedEntity);
    return updatedEntity;
  }

  /**
   * Get entity state
   * @param {string} entityId - Entity ID
   * @returns {Object|undefined} - Entity state or undefined if not found
   */
  getEntityState(entityId) {
    return this.entities.get(entityId);
  }

  /**
   * Get all entity states
   * @returns {Object} - Object with entity IDs as keys and states as values
   */
  getAllEntityStates() {
    const states = {};
    for (const [entityId, state] of this.entities.entries()) {
      states[entityId] = state;
    }
    return states;
  }

  /**
   * Process sensor data and update entity states
   * @param {Object} sensor - Sensor object
   * @param {Object} data - Sensor data
   * @returns {Array} - Array of updated entities
   */
  processSensorData(sensor, data) {
    const updatedEntities = [];

    // Create or update temperature entity
    if (data.temperature !== undefined) {
      const entityId = `${sensor.id}_temperature`;
      if (!this.entityDefinitions.has(entityId)) {
        this.createSensorEntity(sensor.id, sensor.name, 'temperature');
      }
      const state = this.updateEntityState(entityId, { temperature: data.temperature });
      updatedEntities.push({ entityId, state });
    }

    // Create or update moisture entity
    if (data.moisture !== undefined) {
      const entityId = `${sensor.id}_moisture`;
      if (!this.entityDefinitions.has(entityId)) {
        this.createSensorEntity(sensor.id, sensor.name, 'moisture');
      }
      const state = this.updateEntityState(entityId, { moisture: data.moisture });
      updatedEntities.push({ entityId, state });
    }

    // Create or update light entity
    if (data.light !== undefined) {
      const entityId = `${sensor.id}_light`;
      if (!this.entityDefinitions.has(entityId)) {
        this.createSensorEntity(sensor.id, sensor.name, 'light');
      }
      const state = this.updateEntityState(entityId, { light: data.light });
      updatedEntities.push({ entityId, state });
    }

    // Create or update fertility entity
    if (data.fertility !== undefined) {
      const entityId = `${sensor.id}_fertility`;
      if (!this.entityDefinitions.has(entityId)) {
        this.createSensorEntity(sensor.id, sensor.name, 'fertility');
      }
      const state = this.updateEntityState(entityId, { fertility: data.fertility });
      updatedEntities.push({ entityId, state });
    }

    // Create or update battery entity
    if (sensor.battery_level !== undefined) {
      const entityId = `${sensor.id}_battery`;
      if (!this.entityDefinitions.has(entityId)) {
        this.createSensorEntity(sensor.id, sensor.name, 'battery');
      }
      const state = this.updateEntityState(entityId, { battery: sensor.battery_level });
      updatedEntities.push({ entityId, state });
    }

    return updatedEntities;
  }
}

module.exports = EntityManager; 