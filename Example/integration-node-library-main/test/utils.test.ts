import test from "ava";
import { toLanguageObject, getDefaultLanguageString, filterBase64Images } from "../lib/utils.js";

const toLanguageObjectTest = test.macro(
  (t, input: string | Record<string, string> | Map<string, string> | null | undefined, expected) => {
    const result = toLanguageObject(input);
    t.deepEqual(result, expected);
  }
);

test("toLanguageObject with undefined input returns null", toLanguageObjectTest, undefined, null);
test("toLanguageObject with null input returns null", toLanguageObjectTest, null, null);
test("toLanguageObject with empty string returns null", toLanguageObjectTest, "", null);

test("toLanguageObject with string returns english text", toLanguageObjectTest, "foobar", { en: "foobar" });

test(
  "toLanguageObject with Map returns language text",
  toLanguageObjectTest,
  new Map([
    ["en", "foobar"],
    ["fr", "toto"],
    ["de-CH", "gugus"],
    ["de", "dingsbums"]
  ]),
  { en: "foobar", fr: "toto", "de-CH": "gugus", de: "dingsbums" }
);

test(
  "toLanguageObject with object returns language text",
  toLanguageObjectTest,
  { en: "foobar", fr: "toto", "de-CH": "gugus", de: "dingsbums" },
  { en: "foobar", fr: "toto", "de-CH": "gugus", de: "dingsbums" }
);

const defaultLanguageString = test.macro((t, input: Record<string, string> | undefined | null, expected) => {
  const result = getDefaultLanguageString(input);
  t.deepEqual(result, expected);
});

const languageTexts = { en: "foobar", fr: "toto", "de-CH": "gugus", de: "dingsbums" };

test(
  "getDefaultLanguageString with undefined input returns default text",
  defaultLanguageString,
  undefined,
  "Undefined"
);
test("getDefaultLanguageString with null input returns default text", defaultLanguageString, null, "Undefined");

test("getDefaultLanguageString with non-English input returns default text", defaultLanguageString, {}, "Undefined");
test("getDefaultLanguageString returns English text", defaultLanguageString, languageTexts, "foobar");

test("filterBase64Images removes base64 image data", (t) => {
  const msg = {
    kind: "event",
    msg: "entity_change",
    msg_data: {
      entity_id: "123",
      entity_type: "media_player",
      attributes: { media_image_url: "data:image/png;base64,iVBORw0KGgoAAAANS........." }
    },
    cat: "ENTITY"
  };
  const result = filterBase64Images(msg);

  t.deepEqual(result, {
    kind: "event",
    msg: "entity_change",
    msg_data: { entity_id: "123", entity_type: "media_player", attributes: { media_image_url: "data:..." } },
    cat: "ENTITY"
  });
});
