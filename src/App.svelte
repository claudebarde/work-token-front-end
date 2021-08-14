<script lang="ts">
  import { onMount } from "svelte";
  import { TezosToolkit, ContractAbstraction, Wallet } from "@taquito/taquito";
  import { BeaconWallet } from "@taquito/beacon-wallet";
  import { NetworkType } from "@airgap/beacon-sdk";
  import createHash from "./makeAndCheckHash";
  import type { Difficulty } from "./types";
  import KneadingIcon from "./KneadingIcon.svelte";
  import Modal from "./Modal.svelte";

  let Tezos: TezosToolkit;
  let wallet: BeaconWallet;
  let contract: ContractAbstraction<Wallet>;
  const contractAddress = "KT1BqD75Xv4DJDX9rJ1qQD6KM4gXGWiRnDAc";
  let userAddress = "";
  let userBalance: null | number = null;
  let tokensReward = 0;
  let rewardHalvingBlockInterval = 0;
  let currentDifficulty: Difficulty;
  let kneading = false;
  let openModal = false;
  let dataToSubmit: { hash: string; nonce: number; level: number } = undefined;

  const rpcUrl = "https://api.tez.ie/rpc/granadanet"; //"https://granadanet.smartpy.io"

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
    } catch (err) {
      console.error(err);
    }
  };

  const disconnect = () => {
    wallet.client.destroy();
    wallet = undefined;
    userAddress = "";
  };

  const knead = async () => {
    kneading = true;
    const level = (await Tezos.rpc.getBlockHeader()).level;
    // checks if user has the right to knead again
    const storage: any = await contract.storage();
    const kneader = await storage.kneaders.get(userAddress);
    if (kneader) {
      const lastKneading = kneader.last_kneading_level.toNumber();
      console.log(level, lastKneading, storage.reknead_auth_levels.toNumber());
      if (level < lastKneading + storage.reknead_auth_levels.toNumber()) {
        console.log("not allowed to knead now");
        kneading = false;
        return;
      }
    }

    const nonce = Math.round(Math.random() * (1_000_000_000 - 1) + 1);
    const result = await createHash(level, nonce, currentDifficulty);
    console.log(result);
    dataToSubmit = { ...result, level };
    kneading = false;
    openModal = true;
  };

  onMount(async () => {
    Tezos = new TezosToolkit(rpcUrl);
    contract = await Tezos.wallet.at(contractAddress);
    wallet = new BeaconWallet({
      name: "WORK Token",
      preferredNetwork: NetworkType.GRANADANET
    });
    const activeAccount = await wallet.client.getActiveAccount();
    if (activeAccount) {
      userAddress = activeAccount.address;
      Tezos.setWalletProvider(wallet);
      // finds if user has balance
      const storage: any = await contract.storage();
      tokensReward = storage.tokens_reward;
      rewardHalvingBlockInterval = storage.reward_halving.block_interval;
      currentDifficulty = storage.difficulty;
      const balance = await storage.ledger.get(userAddress);
      if (balance) {
        userBalance = balance.toNumber();
      } else {
        userBalance = 0;
      }
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
      font-size: 100px;
      margin: 20px;
    }

    .subtitle {
      font-size: 30px;
      color: #333;
      margin: 10px;
    }
  }

  .connect-wallet {
    position: absolute;
    top: 15px;
    right: 15px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    color: $tezos-blue;
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
      blockchain. <br />
      In order to mint WORK tokens, you must hash the product of the current level
      and a nonce to a SHA256 hash during a process called "kneading" and provide
      the level and the nonce to the main contract that will verify if the output
      hash respects the current difficulty. <br />
      If the hash is correct and you are the first kneader to provide a hash, you
      will be rewarded with {tokensReward / 10 ** 18} tokens. <br />
      The difficulty increases with the token supply and the rewards for kneading
      new tokens are halved every {rewardHalvingBlockInterval} block.
    </div>
    <br />
    {#if userAddress}
      {#if kneading}
        <button class="loading">
          Kneading... &nbsp;
          <KneadingIcon color="#2e7df7" size="32" />
        </button>
      {:else}
        <button on:click={knead}>Knead WORK tokens now</button>
      {/if}
    {:else}
      <button on:click={connect}>
        Connect your wallet and start kneading some tokens!
      </button>
    {/if}
    <div />
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
    }}
  />
{/if}
