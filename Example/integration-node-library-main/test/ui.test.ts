import test from "ava";
import { UiPage, Size, createUiText, EntityCommand, createUiIcon } from "../lib/entities/ui.js";

test("Size sets default size if not specified", (t) => {
  const result = new Size();

  t.is(result.height, 1);
  t.is(result.width, 1);
});

test("UiPage sets default grid size if not specified", (t) => {
  const result = new UiPage("test", "Page");

  t.deepEqual(JSON.parse(JSON.stringify(result)), {
    page_id: "test",
    name: "Page",
    grid: { width: 4, height: 6 },
    items: []
  });
});

test("createUiText with a text command creates a simple command", (t) => {
  const result = createUiText("test", 2, 3, "my_command");

  t.deepEqual(JSON.parse(JSON.stringify(result)), {
    type: "text",
    location: { x: 2, y: 3 },
    text: "test",
    command: { cmd_id: "my_command" }
  });
});

test("createUiText with an EntityCommand creates a command with params", (t) => {
  const result = createUiText(
    "test",
    2,
    3,
    new EntityCommand("my_command", { param1: "test", param2: 42, param3: ["foo", "bar"] })
  );

  t.deepEqual(JSON.parse(JSON.stringify(result)), {
    type: "text",
    location: { x: 2, y: 3 },
    text: "test",
    command: {
      cmd_id: "my_command",
      params: {
        param1: "test",
        param2: 42,
        param3: ["foo", "bar"]
      }
    }
  });
});

test("createUiIcon with a text command creates a simple command", (t) => {
  const result = createUiIcon("uc:star", 2, 3, "my_command");

  t.deepEqual(JSON.parse(JSON.stringify(result)), {
    type: "icon",
    location: { x: 2, y: 3 },
    icon: "uc:star",
    command: { cmd_id: "my_command" }
  });
});

test("createUiIcon with an EntityCommand creates a command with params", (t) => {
  const result = createUiIcon(
    "uc:star",
    2,
    3,
    new EntityCommand("my_command", { param1: "test", param2: 42, param3: ["foo", "bar"] })
  );

  t.deepEqual(JSON.parse(JSON.stringify(result)), {
    type: "icon",
    location: { x: 2, y: 3 },
    icon: "uc:star",
    command: {
      cmd_id: "my_command",
      params: {
        param1: "test",
        param2: 42,
        param3: ["foo", "bar"]
      }
    }
  });
});
