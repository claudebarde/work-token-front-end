import { packDataBytes } from "@taquito/michel-codec";
import { createHash } from "crypto-browserify";
import { Buffer } from "buffer";
import type { Difficulty } from "./types";

export default async (
  level: number,
  nonce: number,
  difficulty: Difficulty
): Promise<{ hash: string; nonce: number; level: number } | null> => {
  let hash = "";
  let success = false;

  console.log("Starting kneading...");
  const startTime = Date.now();

  while (startTime + 240_000 > Date.now()) {
    const secret = level * nonce;
    const bytesSecret = packDataBytes({ int: secret.toString() });
    hash = createHash("sha256")
      .update(Buffer.from(bytesSecret.bytes, "hex"))
      .digest("hex");
    if (hash.slice(0, difficulty.length * 2) === difficulty.sub_bytes) {
      success = true;
      break;
    }

    nonce++;
  }
  console.log("Kneading over!");

  if (success) {
    return { hash, nonce, level };
  } else {
    return null;
  }
};
