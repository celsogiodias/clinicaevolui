// Gerador de Pix Copia-e-Cola (BR Code EMV) — padrão Banco Central

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

// Remove acentos e caracteres não permitidos
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
  key: string;           // chave Pix (CPF, e-mail, telefone, aleatória)
  merchantName: string;  // nome do recebedor
  merchantCity: string;  // cidade
  amount?: number;       // valor em R$
  txid?: string;         // identificador (até 25 chars alfanuméricos)
  description?: string;  // descrição/mensagem opcional
}

export function generatePixPayload(p: PixParams): string {
  const gui = tlv("00", "br.gov.bcb.pix");
  const keyField = tlv("01", p.key.trim());
  const descField = p.description ? tlv("02", sanitize(p.description, 60)) : "";
  const merchantAccount = tlv("26", gui + keyField + descField);

  const txid = sanitize(p.txid || "***", 25) || "***";

  const payload =
    tlv("00", "01") +                                  // Payload Format
    tlv("26", gui + keyField + descField).slice(4) &&  // placeholder — will rebuild below
    "";

  // Rebuild corretamente:
  const parts = [
    tlv("00", "01"),                                    // Payload Format Indicator
    merchantAccount,                                    // Merchant Account Information
    tlv("52", "0000"),                                  // Merchant Category Code
    tlv("53", "986"),                                   // Moeda (BRL)
    p.amount && p.amount > 0 ? tlv("54", p.amount.toFixed(2)) : "",
    tlv("58", "BR"),                                    // País
    tlv("59", sanitize(p.merchantName, 25) || "Recebedor"),
    tlv("60", sanitize(p.merchantCity, 15) || "BRASIL"),
    tlv("62", tlv("05", txid)),                         // Additional Data — txid
  ].join("");

  const toCrc = parts + "6304";
  return toCrc + crc16(toCrc);
}
