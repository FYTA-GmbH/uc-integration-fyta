import test from "ava";
import { Button, ButtonStates } from "../lib/entities/button.js";
import { EntityType } from "../lib/entities/entity.js";

test("Button constructor without parameter object creates default Button class", (t) => {
  const entity = new Button("test", "Test Button");

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Button" });
  t.is(entity.entity_type, EntityType.Button);
  t.is(entity.device_id, undefined);
  t.deepEqual(entity.features, ["press"]);
  t.deepEqual(entity.attributes, { state: "AVAILABLE" });
  t.is(entity.device_class, undefined);
  t.is(entity.options, undefined);
  t.is(entity.area, undefined);
  t.is(entity.hasCmdHandler, false);
});

test("Button constructor with parameter object", (t) => {
  const entity = new Button("test", "Test Button", {
    state: ButtonStates.Unavailable,
    area: "Test lab"
  });

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Button" });
  t.is(entity.entity_type, EntityType.Button);
  t.is(entity.device_id, undefined);
  t.deepEqual(entity.features, ["press"]);
  t.deepEqual(entity.attributes, { state: "UNAVAILABLE" });
  t.is(entity.device_class, undefined);
  t.is(entity.options, undefined);
  t.is(entity.area, "Test lab");
  t.is(entity.hasCmdHandler, false);
});
