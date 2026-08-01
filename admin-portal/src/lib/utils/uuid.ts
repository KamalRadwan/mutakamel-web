export function generateUUIDv7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const milliseconds = Date.now();
  const high = Math.floor(milliseconds / 0x1_0000_0000);
  const low = milliseconds % 0x1_0000_0000;

  bytes[0] = (high >> 8) & 0xff;
  bytes[1] = high & 0xff;
  bytes[2] = (low >> 24) & 0xff;
  bytes[3] = (low >> 16) & 0xff;
  bytes[4] = (low >> 8) & 0xff;
  bytes[5] = low & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  let value = "";
  for (let index = 0; index < bytes.length; index += 1) {
    value += bytes[index].toString(16).padStart(2, "0");
    if (index === 3 || index === 5 || index === 7 || index === 9) {
      value += "-";
    }
  }
  return value;
}
