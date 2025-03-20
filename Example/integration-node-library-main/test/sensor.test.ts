import test from "ava";
import { EntityType } from "../lib/entities/entity.js";
import { Sensor, SensorOptions, SensorStates, SensorAttributes, SensorDeviceClasses } from "../lib/entities/sensor.js";

test("Sensor constructor without parameter object creates default Sensor class", (t) => {
  const entity = new Sensor("test", "Test Sensor");

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Sensor" });
  t.is(entity.entity_type, EntityType.Sensor);
  t.is(entity.device_id, undefined);
  t.deepEqual(entity.features, []);
  t.deepEqual(entity.attributes, { [SensorAttributes.State]: SensorStates.Unknown });
  t.is(entity.device_class, undefined);
  t.is(entity.options, undefined);
  t.is(entity.area, undefined);
  t.is(entity.hasCmdHandler, false);
});

test("Sensor constructor with parameter object", (t) => {
  const options: Partial<Record<SensorOptions, number>> = {
    [SensorOptions.MaxValue]: 42
  };

  const attributes: Partial<Record<SensorAttributes, SensorStates | number>> = {
    [SensorAttributes.State]: SensorStates.Unavailable
  };

  const entity = new Sensor("test", "Test Sensor", {
    attributes,
    options,
    deviceClass: SensorDeviceClasses.Energy,
    area: "Test lab"
  });

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Sensor" });
  t.is(entity.entity_type, EntityType.Sensor);
  t.is(entity.device_id, undefined);
  t.deepEqual(entity.features, []);
  t.deepEqual(entity.attributes, { state: "UNAVAILABLE" });
  t.is(entity.device_class, "energy");
  t.deepEqual(entity.options, { max_value: 42 });
  t.is(entity.area, "Test lab");
  t.is(entity.hasCmdHandler, false);
});

test("Sensor constructor with Object attributes", (t) => {
  const attributes: Partial<Record<SensorAttributes, SensorStates | number | string>> = {
    [SensorAttributes.State]: SensorStates.On,
    [SensorAttributes.Value]: 100,
    [SensorAttributes.Unit]: "%"
  };

  const entity = new Sensor("test", "Test Sensor", {
    attributes
  });

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Sensor" });
  t.is(entity.entity_type, EntityType.Sensor);
  t.deepEqual(entity.attributes, { state: "ON", value: 100, unit: "%" });
});
