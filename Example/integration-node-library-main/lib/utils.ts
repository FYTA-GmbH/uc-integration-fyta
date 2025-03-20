/**
 * Utility functions.
 *
 * @copyright (c) 2024 by Unfolded Circle ApS.
 * @license Apache License 2.0, see LICENSE for more details.
 */

/**
 * Convert an input text to a language object.
 *
 * An input text is either a simple string, which is mapped to the `en` language key, a Map containing language keys and
 * text values, or an Object with language key fields and text values.
 * @param {string | Map<string, string> | Record<string, string> | null | undefined} text
 * @return {{ Record<string, string> | null }}
 */
export function toLanguageObject(
  text: string | Map<string, string> | Record<string, string> | null | undefined
): Record<string, string> | null {
  if (text) {
    if (typeof text === "string") {
      return { en: text };
    }
    if (text instanceof Map) {
      return Object.fromEntries(text);
    }
    // TODO check if text object only contains string keys & values?
    return text;
  }

  return null;
}

/**
 * Get the default text from a language text map.
 *
 * If English `en` or any `en-##` is not defined, the first entry is returned.
 *
 * @param {Record<string, string>} text The language text map, key is the language identifier, value is the language-specific text.
 * @param {string} defaultText The text to return if `text` is empty.
 * @returns {string} The default text.
 */
export function getDefaultLanguageString(
  text: Record<string, string> | null | undefined,
  defaultText: string = "Undefined"
): string {
  if (!text) {
    return defaultText;
  }

  if (text.en) {
    return text.en;
  }

  for (const [index, [key, value]] of Object.entries(text).entries()) {
    if (index === 0) {
      defaultText = value;
    }
    if (key.startsWith("en-")) {
      return text[key];
    }
  }

  return defaultText;
}

/**
 * Filter out base64 encoded images from a JSON object.
 * Used to hide base64 encoded images from logs.
 *
 * @param {any} json The JSON object to filter.
 * @returns {any} The filtered JSON object.
 */
export function filterBase64Images(json: any): any {
  if (json.msg_data) {
    if (Array.isArray(json.msg_data)) {
      json.msg_data.forEach((o: any) => {
        if (o.attributes && o.attributes.media_image_url && o.attributes.media_image_url.startsWith("data:")) {
          o.attributes.media_image_url = "data:...";
        }
      });
    } else if (
      json.msg_data.attributes &&
      json.msg_data.attributes.media_image_url &&
      json.msg_data.attributes.media_image_url.startsWith("data:")
    ) {
      json.msg_data.attributes.media_image_url = "data:...";
    }
  }
  return json;
}
