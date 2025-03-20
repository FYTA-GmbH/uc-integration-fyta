// use integration library in a client project:
// import * as uc from "@unfoldedcircle/integration-api";
import * as uc from "../../dist/cjs/index.js";
import { Remote, RemoteStates, RemoteCommands, RemoteAttributes, RemoteFeatures } from "../../dist/cjs/index.js";

import fs from "fs";

const driver = new uc.IntegrationAPI();

// Simple commands supported by this example remote entity
const supportedCommands = [
  "VOLUME_UP",
  "VOLUME_DOWN",
  "HOME",
  "GUIDE",
  "CONTEXT_MENU",
  "CURSOR_UP",
  "CURSOR_DOWN",
  "CURSOR_LEFT",
  "CURSOR_RIGHT",
  "CURSOR_ENTER",
  "MY_RECORDINGS",
  "MY_APPS",
  "REVERSE",
  "PLAY",
  "PAUSE",
  "FORWARD",
  "RECORD"
];

/**
 * Remote-entity command handler.
 *
 * Called by the integration-API if a command is sent to a configured entity.
 *
 * @param {Entity} entity remote entity
 * @param {string} cmdId command
 * @param {?Object<string, *>} [params] optional command parameters
 * @return {Promise<uc.StatusCodes>} status of the command
 */
const cmdHandler = async function (entity, cmdId, params = {}) {
  console.log(`Got ${entity.id} command request: ${cmdId}`);

  let state = null;
  switch (cmdId) {
    case RemoteCommands.On:
      state = RemoteStates.On;
      break;
    case RemoteCommands.Off:
      state = RemoteStates.Off;
      break;
    case RemoteCommands.Toggle:
      state = entity.attributes?.[RemoteAttributes.State] === RemoteStates.Off ? RemoteStates.On : RemoteStates.Off;
      break;
    case RemoteCommands.SendCmd: {
      const command = params.command ?? "";
      if (!supportedCommands.includes(command)) {
        console.error(`Unknown command: ${command}`);
        return uc.StatusCodes.BadRequest;
      }
      const repeat = params.repeat || 1;
      const delay = params.delay || 0;
      const hold = params.hold || 0;
      console.log(`Command: ${command} (repeat=${repeat}, delay=${delay}, hold=${hold})`);
      break;
    }
    case RemoteCommands.SendCmdSequence: {
      const sequence = params.sequence;
      const seqRepeat = params.repeat || 1;
      const seqDelay = params.delay || 0;
      console.log(`Command sequence: ${sequence} (repeat=${seqRepeat}, delay=${seqDelay})`);
      break;
    }
    default:
      console.error(`Unsupported command: ${cmdId}`);
      return uc.StatusCodes.BadRequest;
  }

  if (state) {
    const newState = {
      [RemoteAttributes.State]: state
    };
    driver.getConfiguredEntities().updateEntityAttributes(entity.id, newState);
  }

  return uc.StatusCodes.Ok;
};

// Event listener for connection event
driver.on(uc.Events.Connect, async () => {
  await driver.setDeviceState(uc.DeviceStates.Connected);
});

driver.on(uc.Events.Disconnect, async () => {
  await driver.setDeviceState(uc.DeviceStates.Disconnected);
});

// Create button mappings
const createButtonMappings = () => {
  return [
    uc.ui.createBtnMapping(uc.ui.Buttons.Home, "HOME", "GUIDE"),
    uc.ui.createBtnMapping(uc.ui.Buttons.ChannelDown, "VOLUME_DOWN"),
    uc.ui.createBtnMapping(uc.ui.Buttons.ChannelUp, "VOLUME_UP"),
    uc.ui.createBtnMapping(uc.ui.Buttons.DpadUp, "CURSOR_UP"),
    uc.ui.createBtnMapping(uc.ui.Buttons.DpadDown, "CURSOR_DOWN"),
    uc.ui.createBtnMapping(uc.ui.Buttons.DpadLeft, "CURSOR_LEFT"),
    uc.ui.createBtnMapping(uc.ui.Buttons.DpadRight, "CURSOR_RIGHT"),
    uc.ui.createBtnMapping(uc.ui.Buttons.DpadMiddle, uc.createRemoteSendCmd("CONTEXT_MENU", { hold: 100 })),
    uc.ui.createBtnMapping(
      uc.ui.Buttons.Blue,
      uc.createRemoteSequenceCmd(["CURSOR_UP", "CURSOR_RIGHT", "CURSOR_DOWN", "CURSOR_LEFT"], { delay: 200 })
    ),
    uc.ui.createBtnMapping(uc.ui.Buttons.Power, new uc.ui.EntityCommand("remote.toggle"))
  ];
};

// Create UI pages
const createUi = () => {
  const mainPage = JSON.parse(fs.readFileSync("remote_ui_page.json", "utf-8"));

  const uiPage1 = new uc.ui.UiPage("page1", "Main");
  uiPage1.add(uc.ui.createUiText("Hello remote entity", 0, 0, undefined, new uc.ui.Size(4, 1)));
  uiPage1.add(uc.ui.createUiIcon("uc:home", 0, 2, "HOME"));
  uiPage1.add(uc.ui.createUiIcon("uc:up-arrow-bold", 2, 2, "CURSOR_UP"));
  uiPage1.add(uc.ui.createUiIcon("uc:down-arrow-bold", 2, 4, "CURSOR_DOWN"));
  uiPage1.add(uc.ui.createUiIcon("uc:left-arrow", 1, 3, "CURSOR_LEFT"));
  uiPage1.add(uc.ui.createUiIcon("uc:right-arrow", 3, 3, "CURSOR_RIGHT"));
  uiPage1.add(uc.ui.createUiIcon("Ok", 2, 3, "CURSOR_ENTER"));

  const uiPage2 = new uc.ui.UiPage("page2", "Page 2");
  uiPage2.add(
    uc.ui.createUiText(
      "Pump up the volume!",
      0,
      0,
      uc.createRemoteSendCmd("VOLUME_UP", { repeat: 5 }),
      new uc.ui.Size(4, 2)
    )
  );
  uiPage2.add(
    uc.ui.createUiText(
      "Test sequence",
      0,
      4,
      uc.createRemoteSequenceCmd(["CURSOR_UP", "CURSOR_RIGHT", "CURSOR_DOWN", "CURSOR_LEFT"], { delay: 200 }),
      new uc.ui.Size(4, 1)
    )
  );
  uiPage2.add(uc.ui.createUiText("On", 0, 5, "on"));
  uiPage2.add(uc.ui.createUiText("Off", 1, 5, "off"));

  return [mainPage, uiPage1, uiPage2];
};

// -- startup driver

const entity = new Remote("remote1", "Demo remote", {
  features: [RemoteFeatures.OnOff, RemoteFeatures.Toggle],
  attributes: { [RemoteAttributes.State]: RemoteStates.Off },
  simpleCommands: supportedCommands,
  buttonMapping: createButtonMappings(),
  uiPages: createUi(),
  cmdHandler
});

driver.addAvailableEntity(entity);
driver.init("remote.json");
