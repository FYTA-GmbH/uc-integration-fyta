/**
 * Central log functions.
 *
 * Use [debug](https://www.npmjs.com/package/debug) module for logging.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */

import debugModule from "debug";

const log = {
  msgTrace: debugModule("ucapi:msg"),
  debug: debugModule("ucapi:debug"),
  info: debugModule("ucapi:info"),
  warn: debugModule("ucapi:warn"),
  error: debugModule("ucapi:error")
};

export default log;
