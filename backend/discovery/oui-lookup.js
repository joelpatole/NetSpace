import { createRequire } from 'module';
import { readFileSync } from 'fs';

let ouiDb = null;

// Fallback/Custom OUI overrides for common consumer & IoT devices
const CUSTOM_OUIS = {
  // VMware, Inc.
  '000C29': 'VMware, Inc.',
  '005056': 'VMware, Inc.',
  '000569': 'VMware, Inc.',

  // Raspberry Pi
  'B827EB': 'Raspberry Pi Foundation',
  'DCA632': 'Raspberry Pi Trading Ltd',
  'E45F01': 'Raspberry Pi Trading Ltd',
  '28CDC1': 'Raspberry Pi Trading Ltd',

  // Apple, Inc.
  'F02489': 'Apple, Inc.',
  'A45E60': 'Apple, Inc.',
  '3C22FB': 'Apple, Inc.',
  'BC9FDE': 'Apple, Inc.',
  '50ED3C': 'Apple, Inc.',

  // Misc / IoT
  '001A2B': 'Ayecom Technology Co., Ltd.',

  // Espressif (ESP8266 / ESP32 modules)
  '240AC4': 'Espressif Inc (Smart Home/IoT)',
  '30AEA4': 'Espressif Inc (Smart Home/IoT)',
  '807D3A': 'Espressif Inc (Smart Home/IoT)',
  'C44F33': 'Espressif Inc (Smart Home/IoT)',
  'DC1ED5': 'Espressif Inc (Smart Home/IoT)',
  '083AF2': 'Espressif Inc (Smart Home/IoT)',
  '08D1F9': 'Espressif Inc (Smart Home/IoT)',
  '08B61F': 'Espressif Inc (Smart Home/IoT)',
  '0C8B95': 'Espressif Inc (Smart Home/IoT)',
  '24DCC3': 'Espressif Inc (Smart Home/IoT)',
  '2CF432': 'Espressif Inc (Smart Home/IoT)',
  '30C6F7': 'Espressif Inc (Smart Home/IoT)',
  '30C922': 'Espressif Inc (Smart Home/IoT)',
  '34987A': 'Espressif Inc (Smart Home/IoT)',

  // TP-Link Technologies
  '000AEB': 'TP-Link Technologies Co., Ltd.',
  '001478': 'TP-Link Technologies Co., Ltd.',
  '0019E0': 'TP-Link Technologies Co., Ltd.',
  '001D0F': 'TP-Link Technologies Co., Ltd.',
  '002127': 'TP-Link Technologies Co., Ltd.',
  '0023CD': 'TP-Link Technologies Co., Ltd.',
  '002586': 'TP-Link Technologies Co., Ltd.',
  '002719': 'TP-Link Technologies Co., Ltd.',

  // Xiaomi
  '504F3B': 'Beijing Xiaomi Mobile Software Co., Ltd',
  '5C4071': 'Xiaomi Communications Co., Ltd.',
  'A4C3BE': 'Xiaomi Communications Co., Ltd.',
  'FC4345': 'Xiaomi Communications Co., Ltd.',
  '009EC8': 'Xiaomi Communications Co., Ltd.',
  '00C30A': 'Xiaomi Communications Co., Ltd.',
  '00EC0A': 'Xiaomi Communications Co., Ltd.',
  '04106B': 'Xiaomi Communications Co., Ltd.',

  // Ubiquiti Networks
  '002722': 'Ubiquiti Inc.',
  '0418D6': 'Ubiquiti Inc.',
  '18E829': 'Ubiquiti Inc.',
  '245A4C': 'Ubiquiti Inc.',
  '24A43C': 'Ubiquiti Inc.',
  '28704E': 'Ubiquiti Inc.',
  '44D9E7': 'Ubiquiti Inc.',
  '602232': 'Ubiquiti Inc.',
  '687251': 'Ubiquiti Inc.',
  '68D79A': 'Ubiquiti Inc.',
  '70A741': 'Ubiquiti Inc.',
  'E063DA': 'Ubiquiti Inc.',

  // Belkin
  '001150': 'Belkin International, Inc.',
  '00173F': 'Belkin International, Inc.',
  '001CDF': 'Belkin International, Inc.',
  '002275': 'Belkin International, Inc.',
  '08863B': 'Belkin International, Inc.',
  '149182': 'Belkin International, Inc.',
  '24F5A2': 'Belkin International, Inc.',
  '6038E0': 'Belkin International, Inc.',
  '80691A': 'Belkin International, Inc.',
  '94103E': 'Belkin International, Inc.',
  '944452': 'Belkin International, Inc.',
  'E89F80': 'Belkin International, Inc.',

  // D-Link
  '000D88': 'D-Link Corporation',
  '000F3D': 'D-Link Corporation',
  '001195': 'D-Link Corporation',
  '001346': 'D-Link Corporation',
  '0015E9': 'D-Link Corporation',
  '00179A': 'D-Link Corporation',
  '00195B': 'D-Link Corporation',
  '001B11': 'D-Link Corporation',
  '001CF0': 'D-Link Corporation',
  '001E58': 'D-Link Corporation',
  '002191': 'D-Link Corporation',

  // NETGEAR
  'E0C250': 'NETGEAR, Inc.',
  '000FB5': 'NETGEAR, Inc.',
  '9C3DCF': 'NETGEAR, Inc.',
  'A00460': 'NETGEAR, Inc.',
  'A040A0': 'NETGEAR, Inc.',
  '08BD43': 'NETGEAR, Inc.',
  '78D294': 'NETGEAR, Inc.',
  '0024B2': 'NETGEAR, Inc.',
  '0026F2': 'NETGEAR, Inc.',
  '0836C9': 'NETGEAR, Inc.',
  '100D7F': 'NETGEAR, Inc.',
  '10DA43': 'NETGEAR, Inc.',
  '506A03': 'NETGEAR, Inc.',

  // Samsung Electronics
  '842519': 'Samsung Electronics Co., Ltd.',
  '182666': 'Samsung Electronics Co., Ltd.',
  '002339': 'Samsung Electronics Co., Ltd.',
  '0C8910': 'Samsung Electronics Co., Ltd.',
  '1C5A3E': 'Samsung Electronics Co., Ltd.',
  '001377': 'Samsung Electronics Co., Ltd.',

  // Amazon Technologies (Echo, Fire TV, Kindle, eero, Ring)
  '44650D': 'Amazon Technologies Inc.',
  '008621': 'Amazon Technologies Inc.',
  '10AE60': 'Amazon Technologies Inc.',
  'FCA183': 'Amazon Technologies Inc.',

  // Sony
  '001620': 'Sony Corporation',
  '0023F1': 'Sony Corporation',
  '001A75': 'Sony Corporation',
  '0013A9': 'Sony Corporation',
  '001813': 'Sony Corporation',
  '58170C': 'Sony Corporation',
  '6C0E0D': 'Sony Corporation',
  '40B837': 'Sony Corporation',
  '3017C8': 'Sony Corporation',
  'AC800A': 'Sony Corporation',
};

/**
 * Load the IEEE OUI database into memory.
 */
function loadOuiDb() {
  if (ouiDb !== null) return ouiDb;
  try {
    const require = createRequire(import.meta.url);
    const ouiDataPath = require.resolve('oui-data');
    const jsonText = readFileSync(ouiDataPath, 'utf8');
    ouiDb = JSON.parse(jsonText);
  } catch (err) {
    console.warn('OUI database loading issue, fallback mode active:', err.message);
    ouiDb = {};
  }
  return ouiDb;
}

/**
 * Calculate OUI from MAC address and check if it's a randomized MAC address.
 * @param {string} mac - MAC address in string format
 * @returns {{ oui: string|null, prefix: string|null, isRandomized: boolean }}
 */
export function calculateOui(mac) {
  if (!mac || typeof mac !== 'string') {
    return { oui: null, prefix: null, isRandomized: false };
  }

  // Handle MAC addresses where single digits were not padded (e.g. 40:c7:3c:b:81:50)
  let normalizedMac = mac;
  const parts = mac.split(/[:\-]/);
  if (parts.length === 6) {
    normalizedMac = parts.map(p => p.padStart(2, '0')).join(':');
  }

  const cleaned = normalizedMac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (cleaned.length < 6) {
    return { oui: null, prefix: null, isRandomized: false };
  }

  const prefix = cleaned.slice(0, 6);
  const oui = `${prefix.slice(0, 2)}:${prefix.slice(2, 4)}:${prefix.slice(4, 6)}`;

  // In IEEE 802 MAC addresses, if the second least-significant bit of the first octet is 1,
  // it is a "Locally Administered Address" (commonly randomized private Wi-Fi MACs).
  // In hex representation, the 2nd character of the 1st byte will be 2, 6, A, or E.
  const secondChar = prefix.charAt(1);
  const isRandomized = ['2', '6', 'A', 'E'].includes(secondChar);

  return { oui, prefix, isRandomized };
}

/**
 * Look up vendor/manufacturer details for a given MAC address.
 * @param {string} mac - MAC address
 * @returns {{ oui: string|null, vendor: string|null, isRandomized: boolean }}
 */
export function getOuiInfo(mac) {
  const { oui, prefix, isRandomized } = calculateOui(mac);
  if (!prefix) {
    return { oui: null, vendor: null, isRandomized: false };
  }

  // Check custom/known overrides first
  if (CUSTOM_OUIS[prefix]) {
    return { oui, vendor: CUSTOM_OUIS[prefix], isRandomized };
  }

  // Check IEEE OUI Database
  const db = loadOuiDb();
  const rawVendor = db[prefix];

  if (rawVendor) {
    // Extract first line of vendor string (strips full postal address)
    const cleanVendor = rawVendor.split('\n')[0].trim();
    return { oui, vendor: cleanVendor, isRandomized };
  }

  // If unmapped but randomized MAC address
  if (isRandomized) {
    return { oui, vendor: 'Private / Randomized MAC Address', isRandomized: true };
  }

  return { oui, vendor: null, isRandomized: false };
}

/**
 * Backward compatible lookupVendor helper.
 */
export async function lookupVendor(mac) {
  const info = getOuiInfo(mac);
  return info.vendor;
}
