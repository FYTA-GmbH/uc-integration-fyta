import test from "ava";
import {
  Climate,
  ClimateOptions,
  ClimateFeatures,
  ClimateStates,
  ClimateAttributes,
  TemperatureUnit
} from "../lib/entities/climate.js";
import { EntityType } from "../lib/entities/entity.js";

test("Climate constructor without parameter object creates default Climate class", (t) => {
  const entity = new Climate("test", "Test Climate");

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Climate" });
  t.is(entity.entity_type, EntityType.Climate);
  t.is(entity.device_id, undefined);
  t.deepEqual(entity.features, []);
  t.deepEqual(entity.attributes, { [ClimateAttributes.State]: ClimateStates.Unknown });
  t.is(entity.device_class, undefined);
  t.is(entity.options, undefined);
  t.is(entity.area, undefined);
  t.is(entity.hasCmdHandler, false);
});

test("Climate constructor with parameter object", (t) => {
  const options: Partial<Record<ClimateOptions, TemperatureUnit | number>> = {
    [ClimateOptions.TemperatureUnit]: TemperatureUnit.Celsius
  };

  const entity = new Climate("test", "Test Climate", {
    features: [ClimateFeatures.Cool],
    attributes: {
      [ClimateAttributes.State]: ClimateStates.Unavailable
    },
    options,
    area: "Test lab"
  });

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Climate" });
  t.is(entity.entity_type, EntityType.Climate);
  t.is(entity.device_id, undefined);
  t.deepEqual(entity.features, ["cool"]);
  t.deepEqual(entity.attributes, { state: "UNAVAILABLE" });
  t.is(entity.device_class, undefined);
  t.deepEqual(entity.options, { temperature_unit: "CELSIUS" });
  t.is(entity.area, "Test lab");
  t.is(entity.hasCmdHandler, false);
});

test("Climate constructor with Object attributes", (t) => {
  const entity = new Climate("test", "Test Climate", {
    attributes: {
      [ClimateAttributes.State]: ClimateStates.Cool
    }
  });

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Climate" });
  t.is(entity.entity_type, EntityType.Climate);
  t.deepEqual(entity.attributes, { state: "COOL" });
});
