// use integration library in a client project:
// import * as uc from "@unfoldedcircle/integration-api";
// This example is also available as a full client project: https://github.com/unfoldedcircle/integration-ts-example
import * as uc from "../../dist/cjs/index.js";
// individual classes and enums can also be imported
import {
  ButtonCommands,
  LightAttributes,
  LightStates,
  LightFeatures,
  LightCommands,
  MediaPlayerAttributes,
  MediaPlayerFeatures,
  MediaPlayerStates,
  MediaPlayerDeviceClasses
} from "../../dist/cjs/index.js";

const driver = new uc.IntegrationAPI();

driver.init("light-driver.json");

driver.on(uc.Events.Connect, async () => {
  await driver.setDeviceState(uc.DeviceStates.Connected);
});

driver.on(uc.Events.Disconnect, async () => {
  await driver.setDeviceState(uc.DeviceStates.Disconnected);
});

driver.on(uc.Events.SubscribeEntities, async (entityIds) => {
  // the integration will configure entities and subscribe for entity update events
  // the UC library automatically adds the subscribed entities
  // from available to configured
  // you can act on this event if you need for your device handling
  entityIds.forEach((entityId) => {
    console.log(`Subscribed entity: ${entityId}`);
  });
});

driver.on(uc.Events.UnsubscribeEntities, async (entityIds) => {
  // when the integration unsubscribed from certain entity updates,
  // the UC library automatically remove the unsubscribed entities
  // from configured
  // you can act on this event if you need for your device handling
  entityIds.forEach((entityId) => {
    console.log(`Unsubscribed entity: ${entityId}`);
  });
});

/**
 * Shared command handler for different entities.
 *
 * Called by the integration-API if a command is sent to a configured entity.
 *
 * @param {Entity} entity button entity
 * @param {string} cmdId command
 * @param {Object<string, *>} [params] optional command parameters
 * @return {Promise<uc.StatusCodes>} status of the command
 */
const sharedCmdHandler = async function (entity, cmdId, params) {
  // let's add some hacky action to the button!
  if (entity.id === "my_button" && cmdId === ButtonCommands.Push) {
    console.log("Got %s push request: toggling light", entity.id);
    // trigger a light command
    const lightEntity = driver.getConfiguredEntities().getEntity("my_unique_light_id");
    if (lightEntity) {
      await lightCmdHandler(lightEntity, LightCommands.Toggle, undefined);
    }
    return uc.StatusCodes.Ok;
  }

  if (entity.id === "test_mediaplayer") {
    console.log("Got %s media-player command request: %s", entity.id, cmdId, params || "");

    return uc.StatusCodes.Ok;
  }

  console.log("Got %s command request: %s", entity.id, cmdId);

  return uc.StatusCodes.Ok;
};

/**
 * Dedicated light entity command handler.
 *
 * Called by the integration-API if a command is sent to a configured light-entity.
 *
 * @param {Entity} entity light entity
 * @param {string} cmdId command
 * @param {Object<string, *>} [params] optional command parameters
 * @return {Promise<uc.StatusCodes>} status of the command
 */
const lightCmdHandler = async function (entity, cmdId, params) {
  console.log("Got %s command request: %s", entity.id, cmdId);

  // in this example we just update the entity, but in reality, you'd turn on the light with your integration
  // and handle the events separately for updating the configured entities
  switch (cmdId) {
    case LightCommands.Toggle:
      if (entity.attributes?.state === LightStates.Off) {
        driver.getConfiguredEntities().updateEntityAttributes(entity.id, {
          [LightAttributes.State]: LightStates.On,
          [LightAttributes.Brightness]: 255
        });
      } else if (entity.attributes?.state === LightStates.On) {
        driver.getConfiguredEntities().updateEntityAttributes(entity.id, {
          [LightAttributes.State]: LightStates.Off,
          [LightAttributes.Brightness]: 0
        });
      }
      break;
    case LightCommands.On:
      // params is optional! Use a default if not provided.
      // A real lamp might store the last brightness value, otherwise the integration could also keep track of the last value.
      driver.getConfiguredEntities().updateEntityAttributes(entity.id, {
        [LightAttributes.State]: LightStates.On,
        [LightAttributes.Brightness]: params && params.brightness ? params.brightness : 127
      });
      driver.getConfiguredEntities().updateEntityAttributes("test_mediaplayer", {
        [MediaPlayerAttributes.Volume]: 24
      });
      break;
    case LightCommands.Off:
      driver.getConfiguredEntities().updateEntityAttributes(entity.id, {
        [LightAttributes.State]: LightStates.Off,
        [LightAttributes.Brightness]: 0
      });
      break;
    default:
      return uc.StatusCodes.NotImplemented;
  }

  return uc.StatusCodes.Ok;
};

// create a light entity
// normally you'd create this where your driver exposed the available entities
// The entity name can either be string (which will be mapped to english), or a Map with multiple language entries.
const name = {
  de: "Mein Lieblingslicht",
  en: "My favorite light"
};

const lightEntity = new uc.Light("my_unique_light_id", name, {
  features: [LightFeatures.OnOff, LightFeatures.Dim],
  attributes: {
    [LightAttributes.State]: LightStates.Off,
    [LightAttributes.Brightness]: 0
  }
});
lightEntity.setCmdHandler(lightCmdHandler);

// add entity as available
// this is important, so the core knows what entities are available
driver.addAvailableEntity(lightEntity);

const buttonEntity = new uc.Button("my_button", "Push the button!", {
  area: "test lab",
  cmdHandler: sharedCmdHandler
});
driver.addAvailableEntity(buttonEntity);

// add a media-player entity
const mediaPlayerEntity = new uc.MediaPlayer(
  "test_mediaplayer",
  { en: "Foobar MediaPlayer" },
  {
    features: [
      MediaPlayerFeatures.OnOff,
      MediaPlayerFeatures.Dpad,
      MediaPlayerFeatures.Home,
      MediaPlayerFeatures.Menu,
      MediaPlayerFeatures.ChannelSwitcher,
      MediaPlayerFeatures.SelectSource,
      MediaPlayerFeatures.ColorButtons,
      MediaPlayerFeatures.PlayPause
    ],
    attributes: {
      [MediaPlayerAttributes.State]: MediaPlayerStates.Off,
      [MediaPlayerAttributes.SourceList]: ["Radio", "Streaming", "Favorite 1", "Favorite 2", "Favorite 3"]
    },
    deviceClass: MediaPlayerDeviceClasses.StreamingBox
  }
);
mediaPlayerEntity.setCmdHandler(sharedCmdHandler);
driver.addAvailableEntity(mediaPlayerEntity);
