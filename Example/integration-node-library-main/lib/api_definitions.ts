/**
 * Integration driver API definitions for Unfolded Circle Remote devices.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */

// Define device states
export enum DeviceStates {
  Connected = "CONNECTED",
  Connecting = "CONNECTING",
  Disconnected = "DISCONNECTED",
  Error = "ERROR"
}

// Define status codes
export enum StatusCodes {
  Ok = 200,
  BadRequest = 400,
  Unauthorized = 401,
  NotFound = 404,
  Timeout = 408,
  Conflict = 409,
  ServerError = 500,
  NotImplemented = 501,
  ServiceUnavailable = 503
}

// Define request/response messages
export enum Messages {
  Authentication = "authentication",
  GetDriverVersion = "get_driver_version",
  GetDeviceState = "get_device_state",
  getAvailableEntities = "get_available_entities",
  GetEntityStates = "get_entity_states",
  SubscribeEvents = "subscribe_events",
  UnsubscribeEvents = "unsubscribe_events",
  EntityCommand = "entity_command",
  GetDriverMetadata = "get_driver_metadata",
  SetupDriver = "setup_driver",
  SetDriverUserData = "set_driver_user_data"
}

// Define event messages
export enum MsgEvents {
  Connect = "connect",
  Disconnect = "disconnect",
  EnterStandby = "enter_standby",
  ExitStandby = "exit_standby",
  DriverVersion = "driver_version",
  DeviceState = "device_state",
  AvailableEntities = "available_entities",
  EntityStates = "entity_states",
  EntityChange = "entity_change",
  DriverMetadata = "driver_metadata",
  DriverSetupChange = "driver_setup_change",
  AbortDriverSetup = "abort_driver_setup",
  GenerateOauth2AuthUrl = "generate_oauth2_auth_url",
  CreateOauth2Cfg = "create_oauth2_cfg",
  GetOauth2Token = "get_oauth2_token",
  DeleteOauth2Token = "delete_oauth2_token",
  Oauth2Authorization = "oauth2_authorization",
  Oauth2Refreshed = "oauth2_refreshed"
}

export enum Events {
  EntityCommand = "entity_command",
  EntityAttributesUpdated = "entity_attributes_updated",
  SubscribeEntities = "subscribe_entities",
  UnsubscribeEntities = "unsubscribe_entities",
  SetupDriver = "setup_driver",
  SetupDriverUserData = "setup_driver_user_data",
  SetupDriverUserConfirmation = "setup_driver_user_confirmation",
  SetupDriverAbort = "setup_driver_abort",
  Connect = "connect",
  Disconnect = "disconnect",
  EnterStandby = "enter_standby",
  ExitStandby = "exit_standby",
  Oauth2Authorization = "oauth2_authorization",
  Oauth2Refreshed = "oauth2_refreshed"
}

// Define event categories
export enum EventCategory {
  Device = "DEVICE",
  Entity = "ENTITY"
}

/**
 * More detailed error reason for `state: ERROR` condition.
 */
export enum IntegrationSetupError {
  None = "NONE",
  NotFound = "NOT_FOUND",
  ConnectionRefused = "CONNECTION_REFUSED",
  AuthorizationError = "AUTHORIZATION_ERROR",
  Timeout = "TIMEOUT",
  Other = "OTHER"
}

/**
 * Driver setup request base class.
 */
export class SetupDriver {
  // Base class logic here
}

/**
 * Start driver setup.
 *
 * If a driver includes a `setup_data_schema` object in its driver metadata, it enables the dynamic
 * driver setup process.
 *
 * The `reconfigure` flag indicates if the user wants to reconfigure an already configured driver in the Remote.
 * It's up to the driver on how to handle a reconfiguration request and run a different logic. For example, this
 * allows to show an options screen to change certain values, or present the option to modify, add or delete
 * provided device entities.
 *
 * The `setupData` parameter holds the user input result of a SettingsPage as key values.
 * - key: id of the field
 * - value: entered user value as string. This is either the entered text or number, selected checkbox state or the
 *          selected dropdown item id.
 *
 * ⚠️ Non-native string values as numbers or booleans are represented as string values!
 *
 * The integration driver has to respond with one of the following action objects:
 * - `RequestUserInput`: request a user input
 * - `RequestUserConfirmation`: request a user confirmation
 * - `SetupComplete` finishes the setup process and the UC Remote creates an integration instance.
 * - `SetupError` aborts the setup process.
 */
export class DriverSetupRequest extends SetupDriver {
  reconfigure: boolean;
  setupData: { [key: string]: string };

  constructor(reconfigure: boolean, setupData: { [key: string]: string }) {
    super();
    this.reconfigure = reconfigure;
    this.setupData = setupData;
  }
}

/**
 * Provide requested driver setup data to the integration driver in a setup process.
 */
export class UserDataResponse extends SetupDriver {
  inputValues: { [key: string]: string };

  constructor(inputValues: { [key: string]: string }) {
    super();
    this.inputValues = inputValues;
  }
}

/**
 * Provide user confirmation response to the integration driver in a setup process.
 */
export class UserConfirmationResponse extends SetupDriver {
  confirm: boolean;

  constructor(confirm: boolean) {
    super();
    this.confirm = confirm;
  }
}

/**
 * Abort notification.
 */
export class AbortDriverSetup extends SetupDriver {
  error: string;

  constructor(error: string) {
    super();
    this.error = error;
  }
}

/**
 * Setup action response base class.
 */
export class SetupAction {
  // Base class logic here
}

/**
 * Setup action to request user input.
 */
export class RequestUserInput extends SetupAction {
  title: string | Map<string, string> | { [key: string]: string };
  settings: Array<{ [key: string]: object | string }>;

  constructor(
    title: string | Map<string, string> | { [key: string]: string },
    settings: Array<{ [key: string]: object | string }>
  ) {
    super();
    this.title = title;
    this.settings = settings;
  }
}

/**
 * Setup action to request a user confirmation.
 * Create a new user confirmation request.
 * All text strings are either a simple string, which will be mapped to English, or a Map / Object containing multiple language strings.
 * @param {string | Map<string, string>|Object.<string, string>} title Confirmation page title of the request screen.
 * @param {string | Map<string, string>|Object.<string, string> | null} header Optional header text.
 * @param {string | null} image Optional base64 encoded image which will be shown between the header and footer texts.
 * @param {string | Map<string, string>|Object.<string, string> | null} footer Optional footer text.
 */
export class RequestUserConfirmation extends SetupAction {
  title: string | Map<string, string> | { [key: string]: string };
  header?: string | Map<string, string> | { [key: string]: string };
  image?: string;
  footer?: string | Map<string, string> | { [key: string]: string };

  constructor(
    title: string | Map<string, string> | { [key: string]: string },
    header?: string | Map<string, string> | { [key: string]: string },
    image?: string,
    footer?: string | Map<string, string> | { [key: string]: string }
  ) {
    super();
    this.title = title;
    this.header = header;
    this.image = image;
    this.footer = footer;
  }
}

/**
 * Setup action to abort setup process due to an error.
 */
export class SetupError extends SetupAction {
  errorType: string;

  constructor(errorType: string = IntegrationSetupError.Other) {
    super();
    this.errorType = errorType;
  }
}

/**
 * Setup action to complete a successful setup process.
 */
export class SetupComplete extends SetupAction {
  // Marks setup as complete
}

export interface Developer {
  name?: string;
  url?: string;
  email?: string;
}

export interface DriverInfo {
  driver_id: string;
  name: Record<string, string>;
  driver_url?: string;
  port?: number;
  version: string;
  min_core_api?: string;
  icon?: string;
  description?: Record<string, string>;
  developer?: Developer;
  home_page?: string;
  setup_data_schema?: object;
  release_date?: string;
}

export interface Oauth2Token {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}
