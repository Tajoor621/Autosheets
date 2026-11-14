/* Local encrypted storage. The key exists only in the unlocked tab. */
(function (root) {
  "use strict";
  const iterations = 600000;
  const prefix = "autosheets:vault:";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const encode = bytes => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  };
  const decode = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));

  async function derive(passphrase, salt) {
    const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: decode(salt), iterations },
      material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  function params(iv, purpose) {
    return { name: "AES-GCM", iv, additionalData: encoder.encode(prefix + purpose + ":1") };
  }

  async function seal(key, salt, data, purpose = "local") {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = encoder.encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt(params(iv, purpose), key, payload);
    return { format: "AutoSheets encrypted " + purpose, version: 1, salt, iv: encode(iv), data: encode(new Uint8Array(ciphertext)) };
  }

  async function open(box, passphrase, purpose = "local") {
    if (!box || box.version !== 1 || box.format !== "AutoSheets encrypted " + purpose ||
        typeof box.salt !== "string" || typeof box.iv !== "string" || typeof box.data !== "string" ||
        decode(box.salt).length !== 16 || decode(box.iv).length !== 12) throw new Error("Unsupported encrypted file.");
    const key = await derive(passphrase, box.salt);
    try {
      const bytes = await crypto.subtle.decrypt(params(decode(box.iv), purpose), key, decode(box.data));
      return { key, data: JSON.parse(decoder.decode(bytes)), salt: box.salt };
    } catch (_) { throw new Error("Incorrect passphrase or damaged encrypted data."); }
  }

  async function create(passphrase, data, purpose = "local") {
    if (Array.from(passphrase).length < 14) throw new Error("Use a passphrase of at least 14 characters.");
    const salt = encode(crypto.getRandomValues(new Uint8Array(16)));
    const key = await derive(passphrase, salt);
    return { key, salt, box: await seal(key, salt, data, purpose) };
  }

  root.AutoSheetsVault = { create, open, seal };
})(globalThis);
