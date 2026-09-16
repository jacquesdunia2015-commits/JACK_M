// Protection par mot de passe et chiffrement du fichier projet (§2.1, §3.4).
// AES-256-GCM avec clé dérivée du mot de passe par PBKDF2 (Web Crypto natif).

const PBKDF2_ITERATIONS = 310000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(s) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function isEncryptedEnvelope(obj) {
  return !!obj && obj.format === "qualicode-projx-encrypted";
}

/** Chiffre la sérialisation JSON d'un projet ; retourne l'enveloppe à écrire dans le .projx. */
export async function encryptProjectJson(json, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(json));
  return {
    format: "qualicode-projx-encrypted",
    version: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ITERATIONS, salt: toBase64(salt) },
    cipher: { name: "AES-256-GCM", iv: toBase64(iv) },
    data: toBase64(data),
  };
}

/** Déchiffre une enveloppe ; lève une erreur si le mot de passe est incorrect (échec d'authentification GCM). */
export async function decryptProjectEnvelope(envelope, password) {
  const salt = fromBase64(envelope.kdf.salt);
  const iv = fromBase64(envelope.cipher.iv);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromBase64(envelope.data));
  return textDecoder.decode(plain);
}
