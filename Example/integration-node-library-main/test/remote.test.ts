import test from "ava";
import {
  createRemoteSequenceCmd,
  createRemoteSendCmd,
  RemoteFeatures,
  RemoteStates,
  RemoteAttributes
} from "../lib/entities/remote.js";
import { AssertionError } from "node:assert";
import { Remote } from "../lib/entities/remote.js";
import { EntityType } from "../lib/entities/entity.js";

test("createSequenceCmd with an undefined sequence throws an assert", (t) => {
  t.throws(
    () => {
      // force an invalid type for old JS integration drivers
      const jsTest: any = undefined;
      createRemoteSequenceCmd(jsTest);
    },
    { instanceOf: AssertionError }
  );
});

test("createSequenceCmd with an empty sequence array throws an assert", (t) => {
  t.throws(
    () => {
      createRemoteSequenceCmd([]);
    },
    { instanceOf: AssertionError }
  );
});

test("createSequenceCmd without optional params doesn't include fields", (t) => {
  const result = createRemoteSequenceCmd(["foo", "bar"]);

  t.is(result.cmd_id, "send_cmd_sequence");
  t.deepEqual(result.params, { sequence: ["foo", "bar"] });
});

test("createSequenceCmd with value 0 for delay and repeat returns values", (t) => {
  const result = createRemoteSequenceCmd(["foo", "bar"], { delay: 0, repeat: 0 });

  t.is(result.cmd_id, "send_cmd_sequence");
  t.deepEqual(result.params, { sequence: ["foo", "bar"], delay: 0, repeat: 0 });
});

test("createSequenceCmd with delay returns parameter field", (t) => {
  const result = createRemoteSequenceCmd(["foo", "bar"], { delay: 100 });

  t.is(result.cmd_id, "send_cmd_sequence");
  t.deepEqual(result.params, { sequence: ["foo", "bar"], delay: 100 });
});

test("createSequenceCmd with repeat returns parameter field", (t) => {
  const result = createRemoteSequenceCmd(["foo", "bar"], { repeat: 2 });

  t.is(result.cmd_id, "send_cmd_sequence");
  t.deepEqual(result.params, { sequence: ["foo", "bar"], repeat: 2 });
});

test("createSendCmd with an undefined command throws an assert", (t) => {
  t.throws(
    () => {
      // force an invalid type for old JS integration drivers
      const jsTest: any = undefined;
      createRemoteSendCmd(jsTest);
    },
    { instanceOf: AssertionError }
  );
});

test("createSendCmd with an empty command throws an assert", (t) => {
  t.throws(
    () => {
      createRemoteSendCmd("");
    },
    { instanceOf: AssertionError }
  );
});

test("createSendCmd without optional params doesn't include fields", (t) => {
  const result = createRemoteSendCmd("foobar");

  t.is(result.cmd_id, "send_cmd");
  t.deepEqual(result.params, { command: "foobar" });
});

test("createSendCmd with optional params returns fields", (t) => {
  const result = createRemoteSendCmd("foobar", { delay: 1, repeat: 2, hold: 3 });

  t.is(result.cmd_id, "send_cmd");
  t.deepEqual(result.params, { command: "foobar", delay: 1, repeat: 2, hold: 3 });
});

test("Remote constructor without parameter object creates default remote class", (t) => {
  const remote = new Remote("test", "Test Remote");

  t.is(remote.id, "test");
  t.deepEqual(remote.name, { en: "Test Remote" });
  t.is(remote.entity_type, EntityType.Remote);
  t.is(remote.device_id, undefined);
  t.deepEqual(remote.features, []);
  t.deepEqual(remote.attributes, { [RemoteAttributes.State]: RemoteStates.Unknown });
  t.is(remote.device_class, undefined);
  t.deepEqual(remote.options, {}); //
  t.is(remote.area, undefined);
  t.is(remote.hasCmdHandler, false);
});

test("Remote constructor with parameter object", (t) => {
  const attributes: Partial<Record<RemoteAttributes, RemoteStates>> = {
    [RemoteAttributes.State]: RemoteStates.On
  };

  const remote = new Remote("test", "Test Remote", {
    features: [RemoteFeatures.SendCmd],
    attributes,
    simpleCommands: ["foobar", "foo", "bar"],
    area: "Test lab"
  });

  t.is(remote.id, "test");
  t.deepEqual(remote.name, { en: "Test Remote" });
  t.is(remote.entity_type, EntityType.Remote);
  t.is(remote.device_id, undefined);
  t.deepEqual(remote.features, ["send_cmd"]);
  t.deepEqual(remote.attributes, { state: "ON" });
  t.is(remote.device_class, undefined);
  t.deepEqual(remote.options, { simple_commands: ["foobar", "foo", "bar"] }); //
  t.is(remote.area, "Test lab");
  t.is(remote.hasCmdHandler, false);
});

test("Remote constructor with Object attributes", (t) => {
  const entity = new Remote("test", "Test Remote", {
    attributes: { state: RemoteStates.Unavailable }
  });

  t.is(entity.id, "test");
  t.deepEqual(entity.name, { en: "Test Remote" });
  t.is(entity.entity_type, EntityType.Remote);
  t.deepEqual(entity.attributes, { state: "UNAVAILABLE" });
});
