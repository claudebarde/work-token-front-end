<script lang="ts">
  import { onMount, afterUpdate } from "svelte";
  import { TezosToolkit, ContractAbstraction, Wallet } from "@taquito/taquito";
  import { BeaconWallet } from "@taquito/beacon-wallet";
  import { NetworkType } from "@airgap/beacon-sdk";
  import { HubConnectionBuilder, HubConnection } from "@microsoft/signalr";
  import type { Difficulty } from "./types";
  import KneadingIcon from "./KneadingIcon.svelte";
  import Modal from "./Modal.svelte";
  import KneaderWorker from "worker-loader!./kneader.worker.ts";

  let Tezos: TezosToolkit;
  let wallet: BeaconWallet;
  let subscription: HubConnection;
  let contract: ContractAbstraction<Wallet>;
  const contractAddress = "KT1BqD75Xv4DJDX9rJ1qQD6KM4gXGWiRnDAc";
  let userAddress = "";
  let userBalance: null | number = null;
  let lastKneading = 0;
  let rekneadingAuthLevel = 0;
  let currentLevel = 0;
  let tokensReward = 0;
  let rewardHalvingBlockInterval = 0;
  let currentDifficulty: Difficulty;
  let kneader;
  let kneading = false;
  let openModal = false;
  let dataToSubmit: { hash: string; nonce: number; level: number } = undefined;
  let hashingCountdownInterval;
  let hashingCountdown = 240;
  let kneadingError = false;
  let autoReknead = false;

  const rpcUrl = "https://api.tez.ie/rpc/granadanet"; //"https://granadanet.smartpy.io"

  const subscribeToEvents = async () => {
    const connection = new HubConnectionBuilder()
      .withUrl("https://api.granadanet.tzkt.io/v1/events")
      .build();
    // auto-reconnect
    connection.onclose(subscribeToEvents);
    connection.on("head", msg => {
      currentLevel = msg.data.level;
    });
    // open connection
    await connection.start();
    // subscribe to head
    await connection.invoke("SubscribeToHead");
    // return connection instance
    return connection;
  };

  const connect = async () => {
    try {
      await wallet.requestPermissions({
        network: {
          type: NetworkType.GRANADANET,
          rpcUrl
        }
      });
      Tezos.setWalletProvider(wallet);
      userAddress = await wallet.getPKH();

      const storage: any = await contract.storage();
      const kneaderAccount = await storage.kneaders.get(userAddress);
      if (kneaderAccount) {
        lastKneading = kneaderAccount.last_kneading_level.toNumber();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const disconnect = () => {
    wallet.client.destroy();
    userAddress = "";
  };

  const handleKneader = async msg => {
    console.log("message from kneader:", msg.data);
    const { data } = msg;
    if (data.type === "hash-found") {
      kneading = false;
      hashingCountdown = 240;
      clearInterval(hashingCountdownInterval);
      if (data.success) {
        dataToSubmit = { ...data };
        openModal = true;
      } else {
        // refreshes difficulty
        const storage: any = await contract.storage();
        currentDifficulty = {
          ...storage.difficulty,
          length: storage.difficulty.length.toNumber()
        };

        if (autoReknead) {
          await knead();
        } else {
          kneadingError = true;
          setTimeout(() => (kneadingError = false), 3000);
        }
      }
    }
  };

  const knead = async () => {
    kneading = true;
    // checks if user has the right to knead again
    const storage: any = await contract.storage();
    const kneaderAccount = await storage.kneaders.get(userAddress);
    if (kneaderAccount) {
      const lastKneading = kneaderAccount.last_kneading_level.toNumber();
      if (currentLevel < lastKneading + rekneadingAuthLevel) {
        console.log("not allowed to knead now");
        kneading = false;
        return;
      }
    }
    hashingCountdownInterval = setInterval(() => (hashingCountdown -= 1), 1000);

    kneader.postMessage({
      type: "create-hash",
      payload: {
        level: currentLevel,
        difficulty: currentDifficulty
      }
    });
  };

  onMount(async () => {
    Tezos = new TezosToolkit(rpcUrl);
    currentLevel = (await Tezos.rpc.getBlockHeader()).level;
    contract = await Tezos.wallet.at(contractAddress);
    wallet = new BeaconWallet({
      name: "WORK Token",
      preferredNetwork: NetworkType.GRANADANET
    });
    const storage: any = await contract.storage();
    const activeAccount = await wallet.client.getActiveAccount();
    if (activeAccount) {
      userAddress = activeAccount.address;
      Tezos.setWalletProvider(wallet);
      // finds if user has balance
      const balance = await storage.ledger.get(userAddress);
      if (balance) {
        userBalance = balance.toNumber();
      } else {
        userBalance = 0;
      }

      const kneaderAccount = await storage.kneaders.get(userAddress);
      if (kneaderAccount) {
        lastKneading = kneaderAccount.last_kneading_level.toNumber();
      }
    }
    tokensReward = storage.tokens_reward.toNumber();
    rewardHalvingBlockInterval =
      storage.reward_halving.block_interval.toNumber();
    currentDifficulty = {
      ...storage.difficulty,
      length: storage.difficulty.length.toNumber()
    };
    rekneadingAuthLevel = storage.reknead_auth_levels.toNumber();

    kneader = new KneaderWorker();
    kneader.postMessage({ type: "init", payload: contractAddress });
    kneader.onmessage = handleKneader;
  });

  afterUpdate(async () => {
    if (currentDifficulty && !subscription) {
      subscription = await subscribeToEvents();
    }
  });
</script>

<style lang="scss">
  $tezos-blue: #2e7df7;

  .container {
    font-size: 20px;
    max-width: 60%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .title {
      color: $tezos-blue;
      font-size: 70px;
      margin: 20px;
    }

    .subtitle {
      font-size: 30px;
      color: #333;
      margin: 10px;
    }

    .kneading-actions {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: $tezos-blue;
    }
  }

  .connect-wallet {
    position: fixed;
    top: 15px;
    right: 15px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    color: $tezos-blue;

    a {
      color: inherit;
    }
  }
</style>

<main>
  <div class="connect-wallet">
    {#if userAddress}
      {#if userBalance === null}
        <div>...</div>
      {:else if userBalance !== null}
        <div>
          {userBalance / 10 ** 18} WORK
        </div>
      {/if}
      &nbsp;&nbsp;&nbsp;
      <button on:click={disconnect}>
        <span class="material-icons"> account_balance_wallet </span>
        &nbsp;
        {userAddress.slice(0, 5)}...{userAddress.slice(-5)}
      </button>
      &nbsp;&nbsp;&nbsp;
      <a
        href="https://better-call.dev/granadanet/KT1BqD75Xv4DJDX9rJ1qQD6KM4gXGWiRnDAc/operations"
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        <span class="material-icons"> link </span>
      </a>
      &nbsp;&nbsp;&nbsp;
      <a
        href="https://github.com/claudebarde/work-token-front-end"
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        <span class="material-icons"> source </span>
      </a>
    {:else}
      <button on:click={connect}>Connect wallet</button>
    {/if}
  </div>
  <div class="container">
    <div class="title">WORK token</div>
    <div>
      <img src="images/knead.png" alt="knead" />
    </div>
    <div class="subtitle">A proof-of-work concept token on Tezos</div>
    <br />
    <div>
      The WORK token is a smart-contract-based proof-of-work token on the Tezos
      blockchain.
      <br /><br />
      In order to mint WORK tokens, you must hash the product of the current level
      and a nonce to a SHA256 hash during a process called "kneading" and provide
      the level and the nonce to the main contract that will verify if the output
      hash respects the current difficulty.
      <br />
      If the hash is correct and you are the first kneader to provide a hash, you
      will be rewarded with {tokensReward / 10 ** 18} tokens.
      <br /><br />
      The difficulty increases with the token supply and the rewards for kneading
      new tokens are halved every {rewardHalvingBlockInterval} block.
      <br /><br />
      Bear in mind that the kneading process may take between a couple of seconds
      and a couple of minutes.
    </div>
    <br />
    <div class="kneading-actions">
      {#if userAddress}
        {#if kneading}
          <button class="loading">
            Kneading... ({hashingCountdown} s) &nbsp;
            <KneadingIcon color="#2e7df7" size="32" />
          </button>
        {:else if kneadingError}
          <button>Too late, try again!</button>
        {:else if currentLevel < lastKneading + rekneadingAuthLevel}
          <button>
            Wait {lastKneading + rekneadingAuthLevel - currentLevel} level{lastKneading +
              rekneadingAuthLevel -
              currentLevel >
            1
              ? "s"
              : ""} before kneading again
          </button>
        {:else}
          <button on:click={knead}>Knead WORK tokens now</button>
        {/if}
        <br />
        <label for="auto-reknead">
          <input type="checkbox" id="auto-reknead" bind:checked={autoReknead} />
          Auto-reknead
        </label>
      {:else}
        <button on:click={connect}>
          Connect your wallet and start kneading some tokens!
        </button>
      {/if}
    </div>
  </div>
</main>
{#if openModal && dataToSubmit && Tezos}
  <Modal
    hash={dataToSubmit.hash}
    nonce={dataToSubmit.nonce}
    level={dataToSubmit.level}
    {contract}
    close={() => (openModal = false)}
    submitted={async () => {
      const storage = await contract.storage();
      const balance = await storage.ledger.get(userAddress);
      if (balance) {
        userBalance = balance.toNumber();
      } else {
        userBalance = 0;
      }
      lastKneading = currentLevel;
    }}
  />
{/if}
