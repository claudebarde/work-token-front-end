import gen from "random-seed";
import createHash from "./makeAndCheckHash";

const ctx: Worker = self as any;

let contractAddress = "";

ctx.addEventListener("message", async e => {
  if (e.data.type === "init") {
    contractAddress = e.data.payload;
  } else if (e.data.type === "create-hash") {
    const { level, difficulty } = e.data.payload;

    //const nonce = Math.round(Math.random() * (1_000_000_000 - 1) + 1);
    const rand = gen.create(Date.now() * level);
    const nonce = rand(1_000_000_000);
    console.log(nonce, level, difficulty);
    const result = await createHash(level, nonce, difficulty);
    if (result) {
      ctx.postMessage({ type: "hash-found", success: true, ...result });
    } else {
      ctx.postMessage({ type: "hash-found", success: false });
    }
  }
});

export {};
