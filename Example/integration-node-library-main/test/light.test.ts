import test from "ava";
import { Light, LightFeatures, LightStates, LightAttributes } from "../lib/entities/light.js";
import { EntityType } from "../lib/entities/entity.js";

test("Light constructor without parameter object creates default Light class", (t) => {
  const entity = new Light("test", "Test Light");

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Light" });
  t.is(entity.entity_type, EntityType.Light);
  t.is(entity.device_id, undefined);
  t.deepEqual(entity.features, []);
  t.deepEqual(entity.attributes, { [LightAttributes.State]: LightStates.Unknown });
  t.is(entity.device_class, undefined);
  t.is(entity.options, undefined);
  t.is(entity.area, undefined);
  t.is(entity.hasCmdHandler, false);
});

test("Light constructor with parameter object", (t) => {
  const attributes: Partial<Record<LightAttributes, LightStates | number>> = {
    [LightAttributes.State]: LightStates.Unavailable
  };

  const entity = new Light("test", "Test Light", {
    features: [LightFeatures.ColorTemperature],
    attributes,
    options: {},
    area: "Test lab"
  });

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Light" });
  t.is(entity.entity_type, EntityType.Light);
  t.is(entity.device_id, undefined);
  t.deepEqual(entity.features, ["color_temperature"]);
  t.deepEqual(entity.attributes, { state: "UNAVAILABLE" });
  t.is(entity.device_class, undefined);
  t.deepEqual(entity.options, {});
  t.is(entity.area, "Test lab");
  t.is(entity.hasCmdHandler, false);
});

test("Light constructor with Object attributes", (t) => {
  const entity = new Light("test", "Test Light", {
    attributes: { brightness: 33 }
  });

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Light" });
  t.is(entity.entity_type, EntityType.Light);
  t.deepEqual(entity.attributes, { brightness: 33 });
});
