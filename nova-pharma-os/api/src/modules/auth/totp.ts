import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Codes à usage unique de la double authentification (TOTP, RFC 6238) :
 * 6 chiffres, renouvelés toutes les 30 secondes, que donnent gratuitement
 * Google Authenticator, Microsoft Authenticator, 2FAS ou FreeOTP — sans SMS,
 * donc sans frais ni réseau téléphonique.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PAS_SECONDES = 30;
/** Un pas avant ou après : l'horloge d'un téléphone n'est jamais exacte. */
const FENETRE = 1;

export function base32(octets: Buffer): string {
  let bits = 0;
  let valeur = 0;
  let sortie = '';
  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];
  return sortie;
}

export function depuisBase32(texte: string): Buffer {
  const propre = texte.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valeur = 0;
  const octets: number[] = [];
  for (const c of propre) {
    valeur = (valeur << 5) | ALPHABET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

export const nouveauSecret = () => base32(randomBytes(20));

/** Code attendu pour un pas de temps donné. */
export function codePour(secret: string, pas: number): string {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(pas));
  const hmac = createHmac('sha1', depuisBase32(secret)).update(compteur).digest();
  const decalage = hmac[hmac.length - 1] & 0x0f;
  const nombre = (hmac.readUInt32BE(decalage) & 0x7fffffff) % 1_000_000;
  return String(nombre).padStart(6, '0');
}

export const pasActuel = (maintenant = Date.now()) => Math.floor(maintenant / 1000 / PAS_SECONDES);

/**
 * Vérifie un code. Renvoie le pas reconnu, ou null. Un code déjà utilisé
 * (pas inférieur ou égal au dernier accepté) est refusé : un code vu par-dessus
 * l'épaule ne resservira pas.
 */
export function verifierCode(secret: string, code: string, dernierPas: number | null): number | null {
  const saisi = (code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(saisi)) return null;
  const actuel = pasActuel();
  for (let d = -FENETRE; d <= FENETRE; d++) {
    const pas = actuel + d;
    if (dernierPas !== null && pas <= dernierPas) continue;
    const attendu = Buffer.from(codePour(secret, pas));
    if (timingSafeEqual(attendu, Buffer.from(saisi))) return pas;
  }
  return null;
}

/** Lien que l'application d'authentification lit dans le QR code. */
export function lienOtpauth(compte: string, secret: string, emetteur = 'NOVA PHARMA OS'): string {
  const libelle = encodeURIComponent(`${emetteur}:${compte}`);
  return `otpauth://totp/${libelle}?secret=${secret}&issuer=${encodeURIComponent(emetteur)}&algorithm=SHA1&digits=6&period=${PAS_SECONDES}`;
}

/** Codes de secours : à usage unique, gardés seulement sous forme d'empreinte. */
export function codesSecours(nombre = 8): { codes: string[]; empreintes: string[] } {
  const codes = Array.from({ length: nombre }, () => {
    const brut = base32(randomBytes(5)).slice(0, 8);
    return `${brut.slice(0, 4)}-${brut.slice(4)}`;
  });
  return { codes, empreintes: codes.map(empreinteSecours) };
}

export const empreinteSecours = (code: string) =>
  createHash('sha256').update(code.toUpperCase().replace(/[^A-Z2-7]/g, '')).digest('hex');
