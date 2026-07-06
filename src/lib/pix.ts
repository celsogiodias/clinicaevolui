// Gerador de Pix Copia-e-Cola (BR Code EMV) — padrão Banco Central

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function sanitize(s: string, max: number): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, max);
}

// CRC16-CCITT (polinômio 0x1021, init 0xFFFF)
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixParams {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
  description?: string;
}

export function generatePixPayload(p: PixParams): string {
  const gui = tlv("00", "br.gov.bcb.pix");
  const keyField = tlv("01", p.key.trim());
  const descField = p.description ? tlv("02", sanitize(p.description, 60)) : "";
  const merchantAccount = tlv("26", gui + keyField + descField);

  const txid = sanitize(p.txid || "***", 25) || "***";

  const parts =
    tlv("00", "01") +
    merchantAccount +
    tlv("52", "0000") +
    tlv("53", "986") +
    (p.amount && p.amount > 0 ? tlv("54", p.amount.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", sanitize(p.merchantName, 25) || "Recebedor") +
    tlv("60", sanitize(p.merchantCity, 15) || "BRASIL") +
    tlv("62", tlv("05", txid));

  const toCrc = parts + "6304";
  return toCrc + crc16(toCrc);
}
