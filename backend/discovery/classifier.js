/**
 * Device type classification based on hostname and vendor keywords.
 * Returns { deviceType, icon } for a given device.
 */

const CLASSIFICATION_RULES = [
  // Hostname-based rules (checked first, case-insensitive)
  { pattern: /iphone/i,                          deviceType: 'iPhone',           icon: 'Smartphone' },
  { pattern: /ipad/i,                            deviceType: 'iPad',             icon: 'Tablet' },
  { pattern: /macbook|imac|mac-|mac\s*pro|mac\s*mini/i, deviceType: 'Mac',       icon: 'Laptop' },
  { pattern: /android|galaxy|pixel|oneplus|xiaomi|redmi|oppo|vivo|huawei|motorola/i,
                                                  deviceType: 'Android phone',   icon: 'Smartphone' },
  { pattern: /samsung(?!.*tab)/i,                 deviceType: 'Samsung device',  icon: 'Smartphone' },
  { pattern: /samsung.*tab/i,                     deviceType: 'Samsung Tablet',  icon: 'Tablet' },
  { pattern: /lenovo/i,                           deviceType: 'Lenovo',          icon: 'Laptop' },
  { pattern: /hp.*(print|laser|jet)|epson|canon.*print|brother|printer/i,
                                                  deviceType: 'Printer',         icon: 'Printer' },
  { pattern: /chromecast|google[\s-]*home|nest/i, deviceType: 'Google/Nest',     icon: 'Cast' },
  { pattern: /echo|alexa/i,                       deviceType: 'Amazon Echo',     icon: 'Speaker' },
  { pattern: /roku|firetv|fire[\s-]*tv|appletv|apple[\s-]*tv|shield/i,
                                                  deviceType: 'Streaming device', icon: 'Tv' },
  { pattern: /xbox/i,                             deviceType: 'Xbox',            icon: 'Gamepad2' },
  { pattern: /playstation|ps4|ps5/i,              deviceType: 'PlayStation',     icon: 'Gamepad2' },
  { pattern: /nintendo|switch/i,                  deviceType: 'Nintendo Switch', icon: 'Gamepad2' },
  { pattern: /sonos/i,                            deviceType: 'Sonos speaker',   icon: 'Speaker' },
  { pattern: /ring|wyze|hikvision|camera|cam\b/i, deviceType: 'Camera',          icon: 'Camera' },
  { pattern: /synology|qnap|nas\b/i,             deviceType: 'NAS / Storage',   icon: 'HardDrive' },
  { pattern: /raspberry|raspberrypi|rpi/i,        deviceType: 'Raspberry Pi',    icon: 'Cpu' },
  { pattern: /windows|win-|desktop/i,             deviceType: 'Windows PC',      icon: 'Monitor' },
  { pattern: /linux|ubuntu|debian|fedora/i,       deviceType: 'Linux',           icon: 'Terminal' },
];

// Vendor-based fallback rules (checked against OUI vendor string)
const VENDOR_RULES = [
  { pattern: /apple/i,               deviceType: 'Apple device',     icon: 'Smartphone' },
  { pattern: /amazon/i,              deviceType: 'Amazon device',    icon: 'Speaker' },
  { pattern: /google/i,              deviceType: 'Google device',    icon: 'Cast' },
  { pattern: /samsung/i,             deviceType: 'Samsung device',   icon: 'Smartphone' },
  { pattern: /intel|dell|lenovo|asus|acer|hewlett|hp inc/i,
                                      deviceType: 'Computer',        icon: 'Monitor' },
  { pattern: /tp-link|netgear|linksys|ubiquiti|arris|cisco|huawei|zte/i,
                                      deviceType: 'Network device',  icon: 'Router' },
  { pattern: /sonos/i,               deviceType: 'Sonos speaker',   icon: 'Speaker' },
  { pattern: /roku/i,                deviceType: 'Streaming device', icon: 'Tv' },
  { pattern: /epson|canon|brother|xerox/i,
                                      deviceType: 'Printer',         icon: 'Printer' },
  { pattern: /ring|nest|wyze/i,      deviceType: 'Smart home',      icon: 'Home' },
];

/**
 * Classify a device based on hostname, vendor, and whether it's the gateway.
 * @param {object} device - { ip, mac, hostname, vendor }
 * @param {string} gatewayIp - The router/gateway IP
 * @returns {{ deviceType: string, icon: string }}
 */
export function classifyDevice(device, gatewayIp) {
  // Router detection
  if (device.ip === gatewayIp) {
    return { deviceType: 'Router', icon: 'Router' };
  }

  // Check hostname-based rules
  const searchString = [device.hostname, device.vendor].filter(Boolean).join(' ');
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(searchString)) {
      return { deviceType: rule.deviceType, icon: rule.icon };
    }
  }

  // Check vendor-only rules
  if (device.vendor) {
    for (const rule of VENDOR_RULES) {
      if (rule.pattern.test(device.vendor)) {
        return { deviceType: rule.deviceType, icon: rule.icon };
      }
    }
  }

  // Default
  return { deviceType: 'Unknown device', icon: 'HelpCircle' };
}
