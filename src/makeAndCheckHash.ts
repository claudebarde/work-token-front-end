import { packDataBytes } from "@taquito/michel-codec";
import { createHash } from "crypto-browserify";
import { Buffer } from "buffer";
import type { Difficulty } from "./types";

export default async (
  level: number,
  nonce: number,
  difficulty: Difficulty
): Promise<{ hash: string; nonce: number } | null> => {
  let hash = "";

  console.log("Starting kneading...");
  while (true) {
    const secret = level * nonce;
    const bytesSecret = packDataBytes({ int: secret.toString() });
    hash = createHash("sha256")
      .update(Buffer.from(bytesSecret.bytes, "hex"))
      .digest("hex");
    if (hash.slice(0, difficulty.length * 2) === difficulty.sub_bytes) {
      //console.log(hash, bytes2Char(hash));
      break;
    }

    nonce++;
  }
  console.log("Kneading over!");

  if (hash && nonce) {
    return { hash, nonce };
  } else {
    return null;
  }
};
