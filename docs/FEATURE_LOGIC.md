# Feature Logic Documentation

This document explains the technical implementation and current issues of the **ENS Name Resolution** and the **"Send to my own address"** features in the Base Tx Guard application.

## 1. ENS Name Resolution Logic

### Implementation Detail
The ENS resolution logic is implemented in `components/TransactionBuilder.tsx` using a React `useEffect` hook.

*   **Trigger**: The resolution process starts whenever the "Recipient" input field (`inputValue`) changes, after a **500ms debounce** to avoid excessive RPC calls while typing.
*   **Normalization**: Before resolution, the input string is normalized using `viem/ens`'s `normalize` function. This ensures that names like `BASE.eth` are treated the same as `base.eth`.
*   **Resolution Process**:
    1.  The app checks if the input contains a `.` (dot), identifying it as a potential domain name.
    2.  It calls `publicClient.getEnsAddress({ name: normalizedName })`.
    3.  If a valid address is returned, it is stored in the `resolvedAddress` state.
    4.  If the resolution fails or the name doesn't exist, a `resolutionError` is displayed.

### Current Issues & Why it fails
1.  **Chain Context**: The `publicClient` is currently configured for **Base Mainnet**. By default, `viem`'s `getEnsAddress` looks for the ENS registry on the chain it's connected to. Since ENS is native to **Ethereum Mainnet**, the resolution may fail on Base if it doesn't have a local ENS registry or a configured cross-chain resolver.
2.  **Missing Mainnet Client**: For consistent `.eth` resolution, the app should likely use a separate `publicClient` specifically pointed at Ethereum Mainnet for the `getEnsAddress` call, regardless of which network the user is currently transacting on.

---

## 2. "Send to my own address" Logic

### Implementation Detail
This feature allows users to quickly fill the recipient field with their own connected wallet address.

*   **Location**: `handleSendToMyself` function in `components/TransactionBuilder.tsx`.
*   **Logic**:
    1.  It retrieves the `address` from the `useWallet()` hook.
    2.  It sets `inputValue` to this address.
    3.  It sets `resolvedAddress` to this same address.
    4.  It clears any previous `result` (preflight data) to ensure a fresh simulation is required.

### Current Issues & Why it fails
1.  **Wallet Connection State**: The button is disabled (`disabled={!address}`) if the wallet is not connected. If a user is "connected" but the `address` variable in `useWallet` is temporarily null or undefined (e.g., during a re-connection or if the provider hasn't finished initializing), the button will be unresponsive.
2.  **UI Feedback**: Currently, there is no loading or error state for this button; it simply does nothing if `address` is missing, which might lead users to believe it is broken if they haven't noticed they are disconnected.
3.  **Address Syncing**: When the button is clicked, it manually sets both `inputValue` and `resolvedAddress`. However, the `useEffect` for resolution might still trigger because `inputValue` changed. While there is a check for `isAddress(inputValue)`, if the hook logic has any race conditions, it could lead to unexpected behavior.

---

## 3. Recommended Fixes

*   **For ENS**: Create a dedicated `mainnetPublicClient` in `hooks/useWallet.ts` and use it specifically for ENS resolution in `TransactionBuilder.tsx`.
*   **For "Send to self"**: Ensure the `useWallet` hook is properly initialized and consider adding a toast/alert if the button is clicked while the address is unavailable.
