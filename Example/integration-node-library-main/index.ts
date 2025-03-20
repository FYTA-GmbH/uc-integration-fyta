/**
 * Integration driver API for Unfolded Circle Remote devices.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */
import os from "os";
import fs from "fs";
import log from "./lib/loggers.js";
import { Bonjour } from "bonjour-service";
import WebSocket, { WebSocketServer } from "ws";
import { EventEmitter } from "events";

import { filterBase64Images, getDefaultLanguageString, toLanguageObject } from "./lib/utils.js";

import * as ui from "./lib/entities/ui.js";
import * as api from "./lib/api_definitions.js";
import { Entities } from "./lib/entities/entities.js";
import { Entity } from "./lib/entities/entity.js";

/**
 * Internal WebSocket handle.
 *
 * This is for legacy integration drivers not yet using the setup handler callback.
 * Do not use for new drivers!
 */
export type WsHandle = {
  // WebSocket ID
  wsId: string;
  // Integration-API request message ID
  reqId: number;
};

// WebSocket client connection metadata.
// More could be added in the future, e.g. authentication info etc
type WsClientMetadata = {
  // unique client identifier
  id: string;
  authenticated: boolean;
};

class IntegrationAPI extends EventEmitter {
  readonly #configDirPath: string;
  #driverInfo!: api.DriverInfo;
  #state: api.DeviceStates;
  #server?: WebSocket.Server;
  #clients: Map<WebSocket, WsClientMetadata>;
  #setupHandler?: (msg: api.SetupDriver) => Promise<api.SetupAction>;
  readonly #availableEntities: Entities;
  readonly #configuredEntities: Entities;

  readonly #requestTimeout: number;

  // store requests sent via WebSocket that need to wait for a response
  readonly #pendingRequests: Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }>;
  #reqId = 1;

  constructor() {
    super();
    // directory to store configuration files
    this.#configDirPath = process.env.UC_CONFIG_HOME || process.env.HOME || "./";

    // set default state
    this.#state = api.DeviceStates.Disconnected;

    this.#clients = new Map();

    // create storage for available and configured entities
    this.#availableEntities = new Entities("available");
    this.#configuredEntities = new Entities("configured");

    // connect to update events for entity attributes
    this.#configuredEntities.on(api.Events.EntityAttributesUpdated, async (entityId, entityType, attributes) => {
      const data = {
        entity_id: entityId,
        entity_type: entityType,
        attributes: attributes instanceof Map ? Object.fromEntries(attributes) : attributes
      };

      await this.#broadcastEvent(api.MsgEvents.EntityChange, data, api.EventCategory.Entity);
    });

    this.#pendingRequests = new Map();
    this.#requestTimeout = 5000;
  }

  /**
   * Initialize the library, start mDNS advertisement and WebSocket server.
   *
   * @param {string|api.DriverInfo} driverConfig either a string to specify the driver configuration file path, or an object holding the configuration
   * @param [setupHandler] optional driver setup handler if the driver metadata contains a setup_data_schema object
   */
  init(driverConfig: string | api.DriverInfo, setupHandler?: (msg: api.SetupDriver) => Promise<api.SetupAction>) {
    this.#setupHandler = setupHandler;
    const integrationInterface = process.env.UC_INTEGRATION_INTERFACE;
    const integrationPort = process.env.UC_INTEGRATION_HTTP_PORT;
    // TODO: implement wss
    // const integrationHttpsEnabled = process.env.UC_INTEGRATION_HTTPS_ENABLED === "true";
    const disableMdnsPublish = process.env.UC_DISABLE_MDNS_PUBLISH === "true";

    // load driver information from either a file path or object.
    if (typeof driverConfig === "string") {
      let raw: Buffer;
      try {
        raw = fs.readFileSync(driverConfig);
      } catch (e) {
        throw Error(`Cannot load ${driverConfig}: ${e}`);
      }

      try {
        this.#driverInfo = JSON.parse(raw.toString());
        log.debug("Driver info loaded");
      } catch (e) {
        log.error(`Error parsing driver info: ${e}`);
        throw Error("Error parsing driver info");
      }
    } else {
      this.#driverInfo = driverConfig;
    }

    let port;
    if (integrationPort) {
      port = parseInt(integrationPort, 10);
    } else {
      port = this.#driverInfo.port || 9090;
    }

    this.#driverInfo.driver_url = this.#getDriverUrl(this.#driverInfo.driver_url, port);

    if (!disableMdnsPublish) {
      let bonjour;
      if (integrationInterface) {
        // TODO open issue, no longer to set advertisement network interface: https://github.com/onlxltd/bonjour-service/issues/58
        // bonjour = new Bonjour({ interface: integrationInterface });
        bonjour = new Bonjour();
      } else {
        bonjour = new Bonjour();
      }

      log.debug("Starting mdns advertising");

      // Make sure to advertise a .local hostname. It seems that bonjour just blindly takes the hostname, short or FQDN.
      // The remote only supports multicast DNS resolution in the .local domain.
      // Test with: avahi-browse -d local _uc-integration._tcp --resolve -t
      const hostname = os.hostname().split(".")[0] + ".local.";

      bonjour.publish({
        name: this.#driverInfo.driver_id,
        host: hostname,
        type: "uc-integration",
        port,
        txt: {
          name: getDefaultLanguageString(this.#driverInfo.name, "Unknown driver"),
          ver: this.#driverInfo.version,
          developer: this.#driverInfo.developer?.name || ""
        }
      });
    }

    // TODO #5 handle startup errors if e.g. port is already in use
    // setup websocket #server - remote-core will connect to this
    if (integrationInterface) {
      this.#server = new WebSocketServer({
        host: integrationInterface,
        port
      });
    } else {
      this.#server = new WebSocketServer({ port });
    }

    this.#server.on("connection", (connection, req) => {
      const wsId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;

      log.info(`[${wsId}] WS: New connection`);

      const metadata: WsClientMetadata = { id: wsId, authenticated: true };
      this.#clients.set(connection, metadata);

      this.#authentication(wsId, true);

      connection.on("message", async (message) => {
        await this.#messageReceived(wsId, message.toString());
      });

      connection.on("close", () => {
        log.info(`[${wsId}] WS: Connection closed`);
        this.#clients.delete(connection);
      });

      connection.on("error", () => {
        log.warn(`[${wsId}] WS: Connection error`);
        this.#clients.delete(connection);
      });
    });

    log.info(
      "Driver is up: %s, version: %s, listening on: %s:%d",
      this.#driverInfo.driver_id,
      this.#driverInfo.version,
      integrationInterface || "0.0.0.0",
      port
    );
  }

  /**
   * @returns path for storing driver configuration files.
   */
  public getConfigDirPath(): string {
    return this.#configDirPath;
  }

  /**
   * Rewrite WebSocket server URL to include in the `driver_metadata` response.
   *
   * - If null or empty: null is returned and propagated to the metadata. The remote uses the mDNS information.
   * - If starting with `ws://` or `wss://` the url is returned as defined.
   * - Otherwise: build URL from OS hostname and given port number.
   *
   * @param url The WebSocket url. Usually defined in the driver.json file. May be null or empty.
   * @param port The WebSocket server port number.
   * @returns The WebSocket server url which should be returned in `driver_metadata` or undefined to use advertised URL.
   */
  #getDriverUrl(url: string | undefined, port: number): string | undefined {
    if (url) {
      if (url.startsWith("ws://") || url.startsWith("wss://")) {
        return url;
      }
      return `ws://${os.hostname()}:${port}`;
    }

    // Remote will use mDNS information
    return undefined;
  }

  /**
   * Retrieve the corresponding WebSocket connection from an identifier.
   *
   * @param {string} id The websocket identifier.
   * @returns {WebSocket | null} The WebSocket connection or null if not found.
   */
  #getWsConnection(id: string): WebSocket | null {
    for (const [connection, metadata] of this.#clients.entries()) {
      if (metadata.id === id) {
        return connection;
      }
    }

    return null;
  }

  /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
  async #sendOkResult(wsHandle: WsHandle, msgData = {}) {
    await this.#sendResponse(wsHandle, "result", msgData, 200);
  }

  async #sendErrorResult(wsHandle: WsHandle, statusCode = 500, msgData = {}) {
    await this.#sendResponse(wsHandle, "result", msgData, statusCode);
  }

  // TODO return send result, connection.send error handling
  // send a response to a request
  async #sendResponse(wsHandle: WsHandle, msg: string, msgData: any, statusCode = api.StatusCodes.Ok) {
    const json = {
      kind: "resp",
      req_id: wsHandle.reqId,
      code: statusCode,
      msg,
      msg_data: msgData
    };

    const connection = this.#getWsConnection(wsHandle.wsId);
    if (connection) {
      const response = JSON.stringify(json);
      this.#log_json_message(json, `[${wsHandle.wsId}] <- `);

      connection.send(response);
    } else {
      log.warn(`[${wsHandle.wsId}] Error sending response: connection no longer established`);
    }
  }

  /**
   * Broadcast an event to all connected #clients
   *
   * @param {string} msg  The message name
   * @param {object} msgData The message payload in `msg_data`
   * @param {string} category The event category
   */
  async #broadcastEvent(msg: string, msgData: object, category: string) {
    const json = {
      kind: "event",
      msg,
      msg_data: msgData,
      cat: category
    };

    const response = JSON.stringify(json);
    this.#log_json_message(json, "<<- ");

    [...this.#clients.keys()].forEach((client) => {
      client.send(response);
    });
  }

  /**
   * Send an event message to the given client.
   *
   * @param {string} wsId WebSocket identifier
   * @param {string} msg  The message name
   * @param {object} msgData The message payload in `msg_data`
   * @param {string} category The event category
   */
  async #sendEvent(wsId: string, msg: string, msgData: object, category: string) {
    const json = {
      kind: "event",
      msg,
      msg_data: msgData,
      cat: category
    };

    const connection = this.#getWsConnection(wsId);
    if (connection) {
      const response = JSON.stringify(json);
      this.#log_json_message(json, `[${wsId}] <- `);

      connection.send(response);
    } else {
      log.warn(`[${wsId}] Error sending event: connection no longer established`);
    }
  }

  async #sendRequest(conn: WebSocket, id: number, msgType: api.MsgEvents, msgData?: object): Promise<any> {
    return new Promise((resolve, reject) => {
      const payload = {
        kind: "req",
        msg: msgType,
        id,
        msg_data: msgData
      };

      const timeoutId = setTimeout(() => {
        this.#pendingRequests.delete(id);
        reject(new Error("request timed out"));
      }, this.#requestTimeout);

      this.#pendingRequests.set(id, {
        resolve: (value: any) => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        reject: (reason?: any) => {
          clearTimeout(timeoutId);
          reject(reason);
        }
      });
      this.#log_json_message(payload, `[${id}] <- `);
      conn.send(JSON.stringify(payload));
    });
  }

  // process incoming websocket messages
  async #messageReceived(wsId: string, message: string) {
    let json;
    try {
      json = JSON.parse(message);
    } catch (e) {
      log.error(`[${wsId}] Json parse error: ${e}`);
      return;
    }

    if (log.msgTrace.enabled) {
      log.msgTrace(`[${wsId}] -> ${JSON.stringify(json)}`);
    }

    const kind = json.kind;
    const id = json.id;
    const msg = json.msg;
    const wsHandle: WsHandle = { wsId, reqId: id };
    const msgData = json.msg_data;

    if (kind === "req") {
      switch (msg) {
        case api.Messages.GetDriverVersion:
          await this.#sendResponse(wsHandle, api.MsgEvents.DriverVersion, this.getDriverVersion());
          break;

        case api.Messages.GetDeviceState:
          await this.#sendResponse(wsHandle, api.MsgEvents.DeviceState, this.#getDeviceState());
          break;

        case api.Messages.getAvailableEntities:
          await this.#sendResponse(wsHandle, api.MsgEvents.AvailableEntities, {
            available_entities: this.#getAvailableEntities()
          });
          break;

        case api.Messages.GetEntityStates:
          await this.#sendResponse(wsHandle, api.MsgEvents.EntityStates, this.#getEntityStates());
          break;

        case api.Messages.EntityCommand:
          await this.#entityCommand(wsHandle, msgData);
          break;

        case api.Messages.SubscribeEvents:
          await this.#subscribeEvents(msgData);
          await this.#sendOkResult(wsHandle);
          break;

        case api.Messages.UnsubscribeEvents:
          await this.#unSubscribeEvents(msgData);
          await this.#sendOkResult(wsHandle);
          break;

        case api.Messages.GetDriverMetadata:
          await this.#sendResponse(wsHandle, api.MsgEvents.DriverMetadata, this.#driverInfo);
          break;

        case api.Messages.SetupDriver:
          if (!(await this.#setupDriver(wsHandle, msgData))) {
            await this.driverSetupError(wsHandle);
          }
          break;

        case api.Messages.SetDriverUserData:
          if (!(await this.#setDriverUserData(wsHandle, msgData))) {
            await this.driverSetupError(wsHandle);
          }
          break;
        default:
          log.warn(`[${wsId}] Unhandled request: ${msg}`);
          await this.#sendErrorResult(wsHandle);
          break;
      }
    } else if (kind === "event") {
      switch (msg) {
        case api.MsgEvents.Connect:
          this.emit(api.Events.Connect);
          break;

        case api.MsgEvents.Disconnect:
          this.emit(api.Events.Disconnect);
          break;

        case api.MsgEvents.EnterStandby:
          this.emit(api.Events.EnterStandby);
          break;

        case api.MsgEvents.ExitStandby:
          this.emit(api.Events.ExitStandby);
          break;

        case api.MsgEvents.AbortDriverSetup:
          this.emit(api.Events.SetupDriverAbort);
          break;

        case api.MsgEvents.Oauth2Authorization:
          this.emit(api.Events.Oauth2Authorization, msgData);
          break;

        case api.MsgEvents.Oauth2Refreshed:
          this.emit(api.Events.Oauth2Refreshed, msgData);
          break;

        default:
          log.warn(`[${wsId}] Unhandled event: ${msg}`);
          break;
      }
    } else if (kind === "resp") {
      const statusCode = json.code;
      const pendingRequest = this.#pendingRequests.get(json.req_id);
      if (!pendingRequest) {
        log.warn(`[${wsId}] No pending request found for id ${id}`);
        return;
      }
      if (statusCode >= 200 && statusCode < 300) {
        pendingRequest.resolve(msgData);
      } else {
        pendingRequest.reject(new Error(`Request failed with status code ${statusCode}`));
      }
      this.#pendingRequests.delete(id);
    }
  }

  /**
   * Log a JSON message with a prefix text.
   *
   * Base64 encoded images starting with `data:` are removed in `msg_data.attributes.media_image_url`
   * fields to limit log output.
   * The `msg_data` object may either be a single object or an array of objects.
   *
   * @param {object} json The JSON message to log.
   * @param {string} prefix Prefix text to add before the JSON message.
   */
  #log_json_message(json: object, prefix: string) {
    if (!log.msgTrace.enabled) {
      return;
    }
    log.msgTrace(`${prefix} ${JSON.stringify(filterBase64Images(json))}`);
  }

  /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

  // private methods
  #authentication(wsId: string, success: boolean) {
    this.#sendResponse(
      { wsId, reqId: 0 },
      api.Messages.Authentication,
      {},
      success ? api.StatusCodes.Ok : api.StatusCodes.Unauthorized
    );
  }

  #getDeviceState() {
    return {
      state: this.#state
    };
  }

  #getAvailableEntities() {
    // return list of entities
    return this.#availableEntities.getEntities();
  }

  async #subscribeEvents(entities: any) {
    entities.entity_ids.forEach((entityId: string) => {
      const entity = this.#availableEntities.getEntity(entityId);
      if (entity) {
        this.#configuredEntities.addAvailableEntity(entity);
      } else {
        log.warn(`WARN: cannot subscribe entity '${entityId}': entity is not available`);
      }
    });

    this.emit(api.Events.SubscribeEntities, entities.entity_ids);
  }

  async #unSubscribeEvents(entities: { entity_ids: string[] }) {
    // remove entities from registered entities
    let res = true;

    entities.entity_ids.forEach((entityId: string) => {
      if (!this.#configuredEntities.removeEntity(entityId)) {
        res = false;
      }
    });

    this.emit(api.Events.UnsubscribeEntities, entities.entity_ids);

    return res;
  }

  #getEntityStates() {
    // simply return entity states from configured entities
    return this.#configuredEntities.getStates();
  }

  async #entityCommand(wsHandle: WsHandle, data: any) {
    if (!data) {
      log.warn("Ignoring entity command: called with empty msg_data");
      await this.acknowledgeCommand(wsHandle, api.StatusCodes.BadRequest);
      return;
    }

    const entityId = data.entity_id;
    const cmdId = data.cmd_id;
    if (!entityId || !cmdId) {
      log.warn("Ignoring command: missing entity_id or cmd_id");
      await this.acknowledgeCommand(wsHandle, api.StatusCodes.BadRequest);
      return;
    }

    const entity = this.#configuredEntities.getEntity(entityId);
    if (!entity) {
      log.warn("Cannot execute command '%s' for '%s': no configured entity found", cmdId, entityId);
      await this.acknowledgeCommand(wsHandle, api.StatusCodes.NotFound);
      return;
    }

    if (!entity.hasCmdHandler) {
      // legacy: emit event, so the driver can act on it
      log.warn(
        `DEPRECATED no entity command handler provided for ${data.entity_id} by the driver: please migrate the integration driver, the legacy ENTITY_COMMAND event will be removed in a future release!`
      );
      this.emit(api.Events.EntityCommand, wsHandle, data.entity_id, data.entity_type, data.cmd_id, data.params);
    } else {
      const result = await entity.command(cmdId, "params" in data ? data.params : undefined);
      await this.acknowledgeCommand(wsHandle, result);
    }
  }

  async #setupDriver(wsHandle: WsHandle, data: { setup_data: { [key: string]: string }; reconfigure?: boolean }) {
    if (this.#setupHandler) {
      await this.acknowledgeCommand(wsHandle);
    }

    if (!data || !data.setup_data) {
      log.error("Aborting setup_driver: called with empty msg_data");
      return false;
    }
    const reconfigure = data.reconfigure ?? false;

    // legacy: emit event, so the driver can act on it
    if (!this.#setupHandler) {
      log.warn(
        "DEPRECATED no setup handler provided by the driver: please migrate the integration driver, the legacy SETUP_DRIVER, SETUP_DRIVER_USER_DATA, SETUP_DRIVER_USER_CONFIRMATION events will be removed in a future release!"
      );
      this.emit(api.Events.SetupDriver, wsHandle, data.setup_data, reconfigure);
      return true;
    }

    // new setup-handler logic as in Python integration library
    let result = false;
    try {
      const action = await this.#setupHandler(new api.DriverSetupRequest(reconfigure, data.setup_data));

      if (action instanceof api.RequestUserInput) {
        await this.driverSetupProgress(wsHandle);
        await this.requestDriverSetupUserInput(wsHandle, action.title, action.settings);
        result = true;
      } else if (action instanceof api.RequestUserConfirmation) {
        await this.driverSetupProgress(wsHandle);
        await this.requestDriverSetupUserConfirmation(
          wsHandle,
          action.title,
          action.header,
          action.image,
          action.footer
        );
        result = true;
      } else if (action instanceof api.SetupComplete) {
        await this.driverSetupComplete(wsHandle);
        result = true;
      } else if (action instanceof api.SetupError) {
        await this.driverSetupError(wsHandle, action.errorType);
        result = true;
      }
      // TODO define custom exceptions?
    } catch (ex) {
      log.error("Exception in setup handler, aborting setup!", ex);
    }

    return result;
  }

  async #setDriverUserData(wsHandle: WsHandle, data: { input_values: { [key: string]: string }; confirm: boolean }) {
    if (this.#setupHandler) {
      await this.acknowledgeCommand(wsHandle);
    }

    if (!data || !(data.input_values || data.confirm)) {
      log.warn("Unsupported set_driver_user_data payload received: %s", data);
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    await this.driverSetupProgress(wsHandle);

    // legacy: emit event, so the driver can act on it
    if (!this.#setupHandler) {
      if (data.input_values) {
        this.emit(api.Events.SetupDriverUserData, wsHandle, data.input_values);
        return true;
      } else if (data.confirm) {
        this.emit(api.Events.SetupDriverUserConfirmation, wsHandle);
        return true;
      } else {
        log.warn("Unsupported set_driver_user_data payload received");
      }

      return false;
    }

    // new #setupHandler logic as in Python integration library
    let result = false;
    try {
      let action;
      if (data.input_values) {
        action = await this.#setupHandler(new api.UserDataResponse(data.input_values));
      } else if (data.confirm) {
        action = await this.#setupHandler(new api.UserConfirmationResponse(data.confirm));
      } else {
        action = new api.SetupError();
      }

      if (action instanceof api.RequestUserInput) {
        await this.requestDriverSetupUserInput(wsHandle, action.title, action.settings);
        result = true;
      } else if (action instanceof api.RequestUserConfirmation) {
        await this.requestDriverSetupUserConfirmation(
          wsHandle,
          action.title,
          action.header,
          action.image,
          action.footer
        );
        result = true;
      } else if (action instanceof api.SetupComplete) {
        await this.driverSetupComplete(wsHandle);
        result = true;
      } else if (action instanceof api.SetupError) {
        await this.driverSetupError(wsHandle, action.errorType);
        result = true;
      }

      // TODO define custom exceptions?
    } catch (ex) {
      log.error("Exception in setup handler, aborting setup!", ex);
    }

    return result;
  }

  /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
  getDriverVersion() {
    return {
      name: getDefaultLanguageString(this.#driverInfo.name),
      version: {
        api: this.#driverInfo.min_core_api,
        driver: this.#driverInfo.version
      }
    };
  }

  async setDeviceState(state: api.DeviceStates) {
    this.#state = state;

    await this.#broadcastEvent(
      api.MsgEvents.DeviceState,
      {
        state: this.#state
      },
      api.EventCategory.Device
    );
  }

  /**
   * Acknowledge a received command event it was successfully executed or not.
   *
   * @param {WsHandle} wsHandle The WebSocket handle received in the ENTITY_COMMAND event.
   * @param {api.StatusCodes} statusCode The status code. Defaults to OK 200.
   */
  async acknowledgeCommand(wsHandle: WsHandle, statusCode: api.StatusCodes = api.StatusCodes.Ok) {
    await this.#sendResponse(wsHandle, "result", {}, statusCode);
  }

  /**
   * Send a setup progress message during the driver setup flow.
   *
   * @param {WsHandle} wsHandle The WebSocket handle received in the `EVENTS.SETUP_DRIVER` event.
   */
  async driverSetupProgress(wsHandle: WsHandle) {
    const msgData = {
      event_type: "SETUP",
      state: "SETUP"
    };
    await this.#sendEvent(wsHandle.wsId, api.MsgEvents.DriverSetupChange, msgData, api.EventCategory.Device);
  }

  /**
   * Request a user confirmation during the driver setup flow.
   *
   * @param wsHandle The WebSocket handle received in the `EVENTS.SETUP_DRIVER` event.
   * @param title A human-readable title of the request screen. Either a string, which will be mapped to english, or a Map containing multiple language strings.
   * @param msg1 The optional message to display in the request screen. Either a string or a language map.
   * @param image An optional base64 encoded image to display below `msg1`.
   * @param msg2 An optional message to display in the request screen below `msg1` or `image`. Either a string or a language map.
   */
  async requestDriverSetupUserConfirmation(
    wsHandle: WsHandle,
    title: string | Map<string, string> | Record<string, string>,
    msg1?: string | Map<string, string> | Record<string, string>,
    image?: string,
    msg2?: string | Map<string, string> | Record<string, string>
  ) {
    // Note: method cannot be private: used in old integration drivers which don't use the setupHandler yet
    const msgData = {
      event_type: "SETUP",
      state: "WAIT_USER_ACTION",
      require_user_action: {
        confirmation: {
          title: toLanguageObject(title),
          message1: toLanguageObject(msg1),
          image,
          message2: toLanguageObject(msg2)
        }
      }
    };
    await this.#sendEvent(wsHandle.wsId, api.MsgEvents.DriverSetupChange, msgData, api.EventCategory.Device);
  }

  /**
   * Request user input during the driver setup flow.
   *
   * @param {WsHandle} wsHandle The WebSocket handle received in the `EVENTS.SETUP_DRIVER` event.
   * @param {string|Map<string, string>|Object<string, string>} title A human-readable title of the request screen. Either a string, which will be mapped to english, or a Map / Object containing multiple language strings.
   * @param {Array<object>} settings Array of input field definition objects. See Integration-API specification.
   */
  async requestDriverSetupUserInput(
    wsHandle: WsHandle,
    title: string | Map<string, string> | { [key: string]: string },
    settings: { [key: string]: any }[]
  ) {
    // Note: method cannot be private: used in old integration drivers which don't use the setupHandler yet
    const msgData = {
      event_type: "SETUP",
      state: "WAIT_USER_ACTION",
      require_user_action: {
        input: {
          title: toLanguageObject(title),
          settings
        }
      }
    };
    await this.#sendEvent(wsHandle.wsId, api.MsgEvents.DriverSetupChange, msgData, api.EventCategory.Device);
  }

  /**
   * Confirm successful setup flow completion.
   *
   * Further setup flow messages will be ignored by the Remote.
   *
   * @param {WsHandle} wsHandle The WebSocket handle received in the `EVENTS.SETUP_DRIVER` event.
   */
  async driverSetupComplete(wsHandle: WsHandle) {
    // Note: method cannot be private: used in old integration drivers which don't use the setupHandler yet
    const msgData = {
      event_type: "STOP",
      state: "OK"
    };
    await this.#sendEvent(wsHandle.wsId, api.MsgEvents.DriverSetupChange, msgData, api.EventCategory.Device);
  }

  /**
   * Set the driver setup flow as failed.
   *
   * Further setup flow messages will be ignored by the Remote.
   *
   * @param {WsHandle} wsHandle The WebSocket handle received in the `EVENTS.SETUP_DRIVER` event.
   * @param {string} error The error reason. TODO create enum.
   */
  async driverSetupError(wsHandle: WsHandle, error: string = "OTHER") {
    // Note: method cannot be private: used in old integration drivers which don't use the setupHandler yet
    const msgData = {
      event_type: "STOP",
      state: "ERROR",
      error
    };
    await this.#sendEvent(wsHandle.wsId, api.MsgEvents.DriverSetupChange, msgData, api.EventCategory.Device);
  }

  public getConfiguredEntities(): Entities {
    return this.#configuredEntities;
  }

  public getAvailableEntities(): Entities {
    return this.#availableEntities;
  }

  // TODO required? most of the time driver_url is not set!
  public getDriverUrl(): string | undefined {
    return this.#driverInfo?.driver_url;
  }

  public addAvailableEntity(entity: Entity) {
    this.#availableEntities.addAvailableEntity(entity);
  }

  public clearAvailableEntities(): void {
    this.#availableEntities.clear();
  }

  public clearConfiguredEntities(): void {
    this.#configuredEntities.clear();
  }

  public updateEntityAttributes(entityId: string, attributes: { [key: string]: string | number | boolean }): boolean {
    return this.#configuredEntities.updateEntityAttributes(entityId, attributes);
  }

  public async generateOauth2AuthUrl(state?: { [key: string]: any }): Promise<{ auth_url: string }> {
    const conn = this.#getCoreClient();
    if (!conn) {
      log.warn("generateOauth2AuthUrl: expected 1 client connected");
      return Promise.reject("expected 1 client connected");
    }

    let payload: any = undefined;
    if (state) {
      payload = { client_data: state };
    }
    return this.#sendRequest(conn, this.#reqId++, api.MsgEvents.GenerateOauth2AuthUrl, payload);
  }

  public async createOauth2Config(data: { token_id: string; name: string; token: api.Oauth2Token }) {
    const conn = this.#getCoreClient();
    if (!conn) {
      log.warn("createOauth2Config: expected 1 client connected");
      return Promise.reject("expected 1 client connected");
    }

    return this.#sendRequest(conn, this.#reqId++, api.MsgEvents.CreateOauth2Cfg, data);
  }

  public async deleteOauth2Token(tokenId: string) {
    const conn = this.#getCoreClient();
    if (!conn) {
      log.warn("deleteOauth2Token: expected 1 client connected");
      return Promise.reject("expected 1 client connected");
    }
    return this.#sendRequest(conn, this.#reqId++, api.MsgEvents.DeleteOauth2Token, { token_id: tokenId });
  }

  public async getOauth2Token(data: { token_id: string; force_refresh: boolean }) {
    const conn = this.#getCoreClient();
    if (!conn) {
      log.warn("getOauth2Token: expected 1 client connected");
      return Promise.reject("expected 1 client connected");
    }
    return this.#sendRequest(conn, this.#reqId++, api.MsgEvents.GetOauth2Token, data);
  }

  #getCoreClient() {
    const wsConns = Array.from(this.#clients.keys());
    if (wsConns.length !== 1) {
      log.warn("getCoreClient: expected 1 connection, found %d", wsConns.length);
      return null;
    }
    return wsConns[0];
  }
}

export { api, ui, IntegrationAPI };

export * from "./lib/entities/ui.js";
export * from "./lib/api_definitions.js";

export * from "./lib/entities/entity.js";
export * from "./lib/entities/button.js";
export * from "./lib/entities/climate.js";
export * from "./lib/entities/cover.js";
export * from "./lib/entities/light.js";
export * from "./lib/entities/media_player.js";
export * from "./lib/entities/remote.js";
export * from "./lib/entities/sensor.js";
export * from "./lib/entities/switch.js";
