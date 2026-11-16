/**
 * Simplest possible implementation for generating a Static PIX (Emv QR Code)
 * Reference: https://www.bcb.gov.br/estabilidadefinanceira/pix
 */

function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function formatField(id: string, value: string): string {
  return id + value.length.toString().padStart(2, '0') + value;
}

export function generatePixPayload(key: string, name: string, city: string, amount: number): string {
  // Normalize strings (remove accents and special chars for PIX compliance)
  const normName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25).toUpperCase();
  const normCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15).toUpperCase();
  const strAmount = amount.toFixed(2);

  const gui = "0014BR.GOV.BCB.PIX";
  const keyField = formatField("01", key);
  const merchantAccountInfo = formatField("26", gui + keyField);

  const payload = [
    formatField("00", "01"), // Payload Format Indicator
    merchantAccountInfo,     // Merchant Account Info
    formatField("52", "0000"), // Merchant Category Code
    formatField("53", "986"),  // Transaction Currency (BRL)
    formatField("54", strAmount), // Transaction Amount
    formatField("58", "BR"),   // Country Code
    formatField("59", normName), // Merchant Name
    formatField("60", normCity), // Merchant City
    formatField("62", formatField("05", "***")), // Additional Data Field (Transaction ID)
    "6304" // CRC16 Indicator
  ].join('');

  return payload + crc16(payload);
}
