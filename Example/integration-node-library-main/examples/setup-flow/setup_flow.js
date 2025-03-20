/**
 * Integration setup flow example.
 */

// use integration library in a client project:
// import * as uc from "@unfoldedcircle/integration-api";
import * as uc from "../../dist/cjs/index.js";

const driver = new uc.IntegrationAPI();

/**
 * Push button command handler.
 *
 * Called by the integration-API if a command is sent to a configured button-entity.
 *
 * @param {Entity} entity button entity
 * @param {string} cmdId command
 * @param {Object<string, *>} [_params] optional command parameters (not used for buttons)
 * @return status of the command
 */
const cmdHandler = async function (entity, cmdId, _params) {
  console.log("Got %s command request: %s", entity.id, cmdId);
  return uc.StatusCodes.Ok;
};

/**
 * Dispatch driver setup requests to corresponding handlers.
 *
 * Either start the setup process or handle the provided user input data.
 * @param {uc.SetupDriver} msg the setup driver request object, either DriverSetupRequest,
 *                 UserDataResponse or UserConfirmationResponse
 * @return the SetupAction on how to continue
 */

const driverSetupHandler = async function (msg) {
  if (msg instanceof uc.DriverSetupRequest) {
    return await handleDriverSetup(msg);
  }
  if (msg instanceof uc.UserDataResponse) {
    return await handleUserDataResponse(msg);
  }

  // user confirmation not used in our demo setup process
  // if (msg instanceof UserConfirmationResponse) {
  //     return handle_user_confirmation(msg)
  // }

  return new uc.SetupError();
};

/**
 * Start driver setup.
 *
 * Initiated by the UC Remote to set up the driver.
 * @param {uc.DriverSetupRequest} msg value(s) of input fields in the first setup screen.
 * @return the SetupAction on how to continue
 */
async function handleDriverSetup(msg) {
  // No support for reconfiguration :-)
  if (msg.reconfigure) {
    console.log("Ignoring driver reconfiguration request");
  }

  // For our demo we simply clear everything!
  // A real driver might have to handle this differently
  driver.clearAvailableEntities();
  driver.clearConfiguredEntities();

  // check if user selected the expert option in the initial setup screen
  // please note that all values are returned as strings!
  if (!("expert" in msg.setupData) || msg.setupData.expert !== "true") {
    // add a single button as default action
    const button = new uc.Button("button", "Button", { cmdHandler });
    driver.addAvailableEntity(button);
    return new uc.SetupComplete();
  }

  // Dropdown selections are usually set dynamically, e.g. with found devices etc.
  const dropdownItems = [
    { id: "red", label: { en: "Red", de: "Rot" } },
    { id: "green", label: { en: "Green", de: "Grün" } },
    { id: "blue", label: { en: "Blue", de: "Blau" } }
  ];

  return new uc.RequestUserInput({ en: "Please choose", de: "Bitte auswählen" }, [
    {
      id: "info",
      label: { en: "Setup flow example", de: "Setup Flow Beispiel" },
      field: {
        label: {
          value: {
            en:
              "This is just some informational text.\n" +
              "Simple **Markdown** is supported!\n" +
              "For example _some italic text_.\n" +
              "#// Or a header text\n~~strikethrough txt~~"
          }
        }
      }
    },
    {
      field: { dropdown: { value: "", items: dropdownItems } },
      id: "step1.choice",
      label: {
        en: "Choose color",
        de: "Wähle Farbe"
      }
    }
  ]);
}

/**
 * Process user data response in a setup process.
 *
 * Driver setup callback to provide requested user data during the setup process.
 * @param {uc.UserDataResponse} msg response data from the requested user data
 * @return the SetupAction on how to continue: SetupComplete if finished.
 */
async function handleUserDataResponse(msg) {
  // values from all screens are returned: check in reverse order
  if ("step2.count" in msg.inputValues) {
    for (let x = 0; x < parseInt(msg.inputValues["step2.count"]); x++) {
      driver.addAvailableEntity(new uc.Button(`button${x}`, `Button ${x + 1}`, { cmdHandler }));
    }

    return new uc.SetupComplete();
  }

  if ("step1.choice" in msg.inputValues) {
    const choice = msg.inputValues["step1.choice"];
    console.log("Chosen color:", choice);
    return new uc.RequestUserInput({ en: "Step 2" }, [
      {
        id: "info",
        label: {
          en: "Selected value from previous step:",
          de: "Selektierter Wert vom vorherigen Schritt:"
        },
        field: {
          label: {
            value: {
              en: choice
            }
          }
        }
      },
      {
        field: { number: { value: 1, min: 1, max: 100, steps: 2 } },
        id: "step2.count",
        label: {
          en: "Button instance count",
          de: "Anzahl Button Instanzen"
        }
      }
    ]);
  }

  console.log("No choice was received");
  return new uc.SetupError();
}

driver.on(uc.Events.Connect, async () => {
  // When the remote connects, we just set the device state. We are ready all the time!
  await driver.setDeviceState(uc.DeviceStates.Connected);
});

driver.init("setup_flow.json", driverSetupHandler);
