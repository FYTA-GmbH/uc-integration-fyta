# Integration Driver Examples

See [integration-ts-example](https://github.com/unfoldedcircle/integration-ts-example) for a simple integration driver
project written in TypeScript, implementing the `simulated-light` example. It can be used as a template for writing an
integration driver.

Integrations using the Node.js API wrapper:

- [Global Caché IR integration](https://github.com/unfoldedcircle/integration-globalcache)
- [Roon integration](https://github.com/unfoldedcircle/integration-roon)

The following examples are short JavaScript snippets. Before running any examples, the TypeScript library needs to be
compiled:

```shell
npm install
npm run build
```

Remember to set the `DEBUG` environment variable before starting an example. Otherwise, there won't be much console output.
See [Logging](../README.md#logging).

## Minimum required driver framework

The `minimum-required.js` file contains the minimum required methods and events that needs to be handled in an
integration driver.

- The driver can be discovered and registered in the web-configurator.
- It exposes a media-player entity.
- There are no implemented entity commands, only a stub handler where the commands have to be implemented.

## simulated-light

Simple one light integration example with a push-button to toggle the light.

This example creates one simulated light entity and handles basic commands sent from the `remote-core`.

```shell
cd simulated-light
DEBUG=* node light.js
```

## remote

The [remote-entity example](remote/remote.js) integration shows how to use simple commands, power toggle functionality,
pre-defined physical button mappings and how to define a user-interface.

The user interface is partially created programmatically, and partially loaded from a json file.

## setup-flow

The [setup_flow](setup-flow/setup_flow.js) example shows how to define a dynamic setup flow for the driver setup.

If the user selects the _expert_ option in the main setup screen:

1. An input screen is shown asking to select an item from a dropdown list.
2. The chosen option will be shown in the next input screen with another setting, on how many button entities to create.
3. The number of push buttons are created.

The available input settings are defined in the [Integration-API asyncapi.yaml definition](https://github.com/unfoldedcircle/core-api/tree/main/integration-api)
and are not yet available as classes.

See `Setting` object definition and the referenced SettingTypeNumber, SettingTypeText, SettingTypeTextArea,
SettingTypePassword, SettingTypeCheckbox, SettingTypeDropdown, SettingTypeLabel.

## Driver configuration

Edit `driver.json` if you'd like to change the port or any other information.

- See `driverMetadata` object in the [Integration-API specification](https://github.com/unfoldedcircle/core-api/tree/main/integration-api)
  for all configuration options.
  - ⚠️ This library requires the additional property `port` to configure the WebSocket server port and is not part of
    the `driverMetadata` object.
- If an `icon` is specified in `driver.json`, it needs to be uploaded to the `remote-core` (via the Web Configurator
  or REST Core-API) and referenced by its id.
- The `driver_url` property is optional and offers different behaviour:
  - if specified and value either starts with `ws://` or `wss://`, the given address is used by the remote to connect
    to the driver.
  - if specified and not starting with a WebSocket schema, the library replaces the URL with the hostname and configured
    port. The resulting URL is used by the remote to connect to the driver.
  - if missing, the remote determines the driver URL by the published mDNS data.
    - If the machine running the integration driver has multiple network interfaces, the first address is used, which
      could be random!
  - While configuring an integration driver, the user can also override the driver address.
- The `setup_data_schema` property enables the driver setup flow to configure the driver during registration.
  - The first request sent is `setup_driver` containing the provided input values (if there are input fields).  
    This triggers the (optional) setup handler callback provided in the `init` call.
  - From there on, the integration driver needs to handle the `SetupDriver` instances and return an appropriate action.
  - See [setup-flow/setup_flow.js](setup-flow/setup_flow.js) for an example and the [Integration-API documentation](https://github.com/unfoldedcircle/core-api/tree/main/doc/integration-driver).
  - ⚠️ the `uc.EVENTS.SETUP_DRIVER` event is deprecated and will be removed at the end of 2024!

## Driver registration

Before the `remote-core` can talk to the integration, it needs to be registered. Either through auto-discovery with the
web-configurator or manually through the Core-API.

### mDNS advertisement & auto-discovery

The integration library advertises the driver over mDNS. See [mDNS advertisement](https://github.com/unfoldedcircle/core-api/blob/main/doc/integration-driver/driver-advertisement.md)
in the Core-API documentation.

- The `driver_id` value in `driver.json` is used as instance name and must be unique.
- Use the web-configurator to discover the driver in "Integration & docks"

### Manual registration with Core-API

You can do it via the REST or WebSocket API, by sending the following requests.
Make sure to use the same information as you've defined in `driver.json`.

Edit the curl commands to add your preferred authentication (basic auth or api key).
You can find the documentation here: [https://github.com/unfoldedcircle/core-simulator](https://github.com/unfoldedcircle/core-simulator)

#### Register the driver

Rest:

```
curl -X 'POST' \
  'http://localhost:8080/api/intg/drivers' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
        "driver_id": "uc_node_driver",
        "name": {
          "en": "My Driver"
        },
        "driver_url": "ws://localhost:9988",
        "version": "1.0.0",
        "enabled": true,
        "icon": "custom:my_driver_icon",
        "description": {
          "en": "Adds support for driver devices."
        },
        "developer": {
          "name": "John Doe",
          "email": "john@doe.com",
          "url": "https://www.unfoldedcircle.com/support"
        },
        "home_page": "https://www.unfoldedcircle.com",
        "release_date": "2023-03-03"
}'
```

WebSocket:

```
{
    "kind": "req",
    "id": 3,
    "msg": "register_integration_driver",
    "msg_data": {
        "driver_id": "uc_node_driver",
        "name": {
          "en": "My Driver"
        },
        "driver_url": "ws://localhost:9988",
        "version": "1.0.0",
        "enabled": true,
        "icon": "custom:my_driver_icon",
        "description": {
          "en": "Adds support for driver devices."
        },
        "developer": {
          "name": "John Doe",
          "email": "john@doe.com",
          "url": "https://www.unfoldedcircle.com/support"
        },
        "home_page": "https://www.unfoldedcircle.com",
        "release_date": "2023-03-03"
    }
}
```

#### Create an integration instance

Rest:

```
curl -X 'POST' \
  'http://localhost:8080/api/intg/drivers/uc_node_driver' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
        "name": {
            "en": "My Integration Instance"
        },
        "enabled": true,
        "icon": "custom:my_driver_icon"
}'
```

WebSocket:

```
{
    "kind": "req",
    "id": 4,
    "msg": "create_integration",
    "msg_data": {
        "driver_id": "uc_node_driver",
        "name": {
            "en": "My Integration Instance"
        },
        "enabled": true,
        "icon": "custom:my_driver_icon"
    }
}
```

### Delete the integration

Easiest way to do this is to use the Web Configurator.

If the integration has been configured, the first delete operation in the "Integrations & dock" view will remove the
integration instance (which provides the available entities), the second delete will also remove the driver
configuration.
