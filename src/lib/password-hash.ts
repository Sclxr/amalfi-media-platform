import { hash, verify } from "@node-rs/argon2";

const options = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  algorithm: 2 as const, // Argon2id
};

export function hashPassword(password: string) {
  return hash(password, options);
}

export function verifyPassword(stored: string, password: string) {
  return verify(stored, password);
}
