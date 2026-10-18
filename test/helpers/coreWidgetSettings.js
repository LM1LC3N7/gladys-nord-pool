// -----------------------------------------------------------------------------
// What the Gladys core does with the settings of a widget box before relaying
// the content request (server/lib/external-integration/
// externalIntegration.validateWidgetSettings.js and getDynamicOptions.js):
// a `source: "devices"` select only accepts the external ids of the devices
// ALREADY CREATED by the user (Discovery), a missing setting takes its
// `default`, and a required setting still missing is a 422. The SDK's fake
// Gladys relays any settings, so the tests check the manifest against this.
// Only the `select` type is replayed (the only one this widget declares):
// the other types and the size bounds of the core are not checked here.
// -----------------------------------------------------------------------------

export class Error422 extends Error {}

/**
 * The validated settings of a box, or throws Error422 like the core.
 * `createdDevices` are the external ids of the created devices.
 */
export function coreWidgetSettings(widget, rawSettings, createdDevices) {
  const fields = (widget.settings ?? []).filter((field) => field.type !== 'section');
  const validValues = (field) =>
    field.source === 'devices' ? createdDevices : (field.options ?? []).map((o) => o.value);
  const settings = {};
  for (const [key, value] of Object.entries(rawSettings)) {
    const field = fields.find((f) => f.key === key);
    if (!field) {
      throw new Error422(`settings.${key}: unknown setting`);
    }
    if (field.type === 'select' && !validValues(field).includes(value)) {
      throw new Error422(`settings.${key}: must be one of ${validValues(field).join(', ')}`);
    }
    settings[key] = value;
  }
  for (const field of fields) {
    if (settings[field.key] === undefined && field.default !== undefined) {
      settings[field.key] = field.default;
    }
    if (field.required && settings[field.key] === undefined) {
      throw new Error422(`settings.${field.key}: required`);
    }
  }
  return settings;
}
