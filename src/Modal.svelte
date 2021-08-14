<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import KneadingIcon from "./KneadingIcon.svelte";

  export let hash, nonce, level, contract, close, submitted;

  let submitting = false;

  const submit = async () => {
    submitting = true;
    try {
      const op = await contract.methods.mint(level, nonce).send();
      await op.confirmation();
      await submitted();
      close();
    } catch (error) {
      console.log(error);
    } finally {
      submitting = false;
    }
  };
</script>

<style lang="scss">
  .modal-background {
    height: 100vh;
    width: 100vw;
    background-color: rgba(0, 0, 0, 0.7);
    position: absolute;
    top: 0px;
    left: 0px;
    z-index: 100;
  }

  .modal {
    width: 40%;
    height: 40%;
    background-color: white;
    display: grid;
    place-items: center;
    border-radius: 10px;
    font-size: 20px;
    padding: 20px;
    word-break: break-word;
    text-align: center;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 110;
  }
</style>

<div
  class="modal-background"
  on:click={close}
  transition:fade={{ duration: 300 }}
/>
<div class="modal" transition:fly={{ duration: 300, y: 200 }}>
  <KneadingIcon color="black" size="48" />
  <div>
    <div>Hash: <br /> {hash.slice(0, 32)} <br /> {hash.slice(-32)}</div>
    <br />
    <div>Nonce: {nonce}</div>
    <br />
    <div>Level: {level}</div>
  </div>
  {#if submitting}
    <button>Submitting, please wait...</button>
  {:else}
    <button on:click={submit}>Submit</button>
  {/if}
</div>
