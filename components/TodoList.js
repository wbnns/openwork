"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createWeb3Modal, defaultWagmiConfig } from "@web3modal/wagmi";
import { WagmiConfig } from "wagmi";
import { base } from "viem/chains";
import { ethers } from "ethers";
import { createPublicClient, http } from "viem";
import AzimuthTodo from "../artifacts/contracts/AzimuthTodo.sol/AzimuthTodo.json";
import { debounce } from "lodash";
import { SaveIcon, CheckIcon } from "@heroicons/react/solid";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!contractAddress) {
  throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS environment variable");
}

if (!projectId) {
  throw new Error("Missing NEXT_PUBLIC_PROJECT_ID environment variable");
}

const metadata = {
  name: "Open Work",
  description: "Build in public and show the world what you're working on.",
  url: "https://openwork.fi/",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

const chains = [base];
const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  publicClient: createPublicClient({
    chain: base,
    transport: http(),
  }),
});

createWeb3Modal({ wagmiConfig, projectId, chains });

const debouncedFetchTodos = debounce((fetchFn) => {
  fetchFn();
}, 500);

export default function TodoList() {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [totalTodos, setTotalTodos] = useState(0);
  const [displayedTodos, setDisplayedTodos] = useState(10);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(-1);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const inputRef = useRef(null);
  const pendingTodosRef = useRef([]);

  const fetchTodos = useCallback(async () => {
    if (contract && walletAddress) {
      if (isInitialLoading) setIsLoading(true);
      try {
        const total = await contract.getTodoCount(walletAddress);
        setTotalTodos(total.toNumber());

        const todosList = await contract.getUserTodos(
          walletAddress,
          0,
          displayedTodos
        );
        const formattedTodos = todosList.map((todo) => ({
          id: todo.id.toNumber(),
          content: todo.content,
          tags: todo.tags,
          isCompleted: todo.isCompleted,
          createdAt: todo.createdAt.toNumber(), // Capture the createdAt timestamp
        }));
        console.log("Fetched todos:", formattedTodos);
        setTodos(formattedTodos);
        setError(null);
      } catch (error) {
        console.error("Failed to fetch todos:", error);
        setError(
          "Failed to fetch todos. Please make sure you're connected to Base."
        );
      } finally {
        setIsLoading(false);
        setIsInitialLoading(false);
      }
    } else {
      console.log("Contract not initialized or wallet not connected");
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [contract, walletAddress, displayedTodos, isInitialLoading]);

  const debouncedFetchTodosCallback = useCallback(() => {
    debouncedFetchTodos(fetchTodos);
  }, [fetchTodos]);

  const switchToBaseChain = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }], // 0x2105 is the hex value for 8453
      });
      console.log("Successfully switched to Base chain (8453).");
    } catch (switchError) {
      if (switchError.code === 4902) {
        console.error("The Base chain (8453) is not added to your wallet.");
      } else {
        console.error("Failed to switch to Base chain:", switchError);
      }
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === "undefined") {
        throw new Error(
          "No wallet detected. Please install Coinbase Wallet or another option from a different provider."
        );
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      setWalletAddress(accounts[0]);
      setIsWalletConnected(true);

      console.log("Wallet connected:", accounts[0]);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const { chainId } = await provider.getNetwork();

      if (chainId !== 8453) {
        console.log(
          "Wallet connected to a different chain. Switching to Base (8453)..."
        );
        await switchToBaseChain();
      }

      // Initialize contract after wallet connection and chain check
      initializeContract();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setError(error.message || "Failed to connect wallet.");
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === "undefined") {
        throw new Error(
          "No wallet detected. Please install Coinbase Wallet or another option from a different provider."
        );
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      setWalletAddress(accounts[0]);
      setIsWalletConnected(true);

      console.log("Wallet connected:", accounts[0]);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const { chainId } = await provider.getNetwork();

      if (chainId !== 8453) {
        console.log(
          "Wallet connected to a different chain. Switching to Base (8453)..."
        );
        await switchToBaseChain();
      }

      // Initialize contract after wallet connection and chain check
      initializeContract();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setError(error.message || "Failed to connect wallet.");
    }
  };

  const initializeContract = useCallback(async () => {
    console.log("Initializing contract");
    try {
      if (typeof window.ethereum === "undefined") {
        throw new Error(
          "No Web3 provider detected. Please install Coinbase Wallet."
        );
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const { chainId } = await provider.getNetwork();
      console.log("Connected to chain:", chainId);

      if (chainId !== 8453) {
        throw new Error("Please connect to Base.");
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const userAddress = accounts[0];
      console.log("Connected wallet address:", userAddress);
      setWalletAddress(userAddress);
      setIsWalletConnected(true);

      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        AzimuthTodo.abi,
        signer
      );
      console.log("Contract initialized:", contract.address);
      setContract(contract);

      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts) => {
        setWalletAddress(accounts[0]);
        setDisplayedTodos(10);
        setIsInitialLoading(true);
      });

      // Listen for chain changes
      window.ethereum.on("chainChanged", (chainId) => {
        if (parseInt(chainId, 16) !== 8453) {
          setError("Please connect to Base.");
          setContract(null);
        } else {
          setError(null);
          setIsInitialLoading(true);
          initializeContract();
        }
      });
    } catch (error) {
      console.error("Failed to initialize contract:", error);
      setIsLoading(false);
      setIsInitialLoading(false);
      setError(
        error.message ||
          "Failed to initialize the app. Please make sure you're connected to Base and try again."
      );
    }
  }, []);

  useEffect(() => {
    console.log("Checking if wallet is connected...");
    if (typeof window.ethereum !== "undefined") {
      connectWallet();
    } else {
      console.log("No Ethereum provider found.");
      setIsInitialLoading(false);
      setError("Please install MetaMask or another Web3 wallet.");
    }
  }, []);

  useEffect(() => {
    if (contract && walletAddress) {
      console.log("Contract and wallet are ready, fetching todos...");
      fetchTodos();
    } else {
      console.log("Contract or wallet not ready yet.");
    }
  }, [contract, walletAddress, fetchTodos]);

  const addTodo = useCallback(
    async (e) => {
      e.preventDefault();
      if (!newTodo.trim() || !contract) return;

      const tags = newTodo.match(/#\w+/g) || [];
      const content = newTodo.replace(/#\w+/g, "").trim();

      try {
        const tx = await contract.createTodo(content, tags);
        setNewTodo("");
        await tx.wait();
        debouncedFetchTodosCallback();
      } catch (error) {
        console.error("Failed to add todo:", error);
        setError(
          "Failed to add todo. Please make sure you're connected to Base and try again."
        );
      }
    },
    [newTodo, contract, debouncedFetchTodosCallback]
  );

  const completeTodo = useCallback(
    async (id) => {
      try {
        const tx = await contract.completeTodo(id);
        await tx.wait();
        debouncedFetchTodosCallback();
      } catch (error) {
        console.error("Failed to complete todo:", error);
        setError(
          "Failed to complete todo. Please make sure you're connected to Base and try again."
        );
      }
    },
    [contract, debouncedFetchTodosCallback]
  );

  const groupTodosByStatusAndTag = useCallback((todosList) => {
    const grouped = todosList.reduce((acc, todo) => {
      const status = todo.isCompleted ? "completed" : "pending";
      if (!acc[status]) acc[status] = {};

      const tags = todo.tags.length === 0 ? ["Untagged"] : todo.tags;
      tags.forEach((tag) => {
        if (!acc[status][tag]) acc[status][tag] = [];
        acc[status][tag].push(todo);
      });

      return acc;
    }, {});

    // Update pendingTodosRef
    pendingTodosRef.current = todosList.filter((todo) => !todo.isCompleted);

    return grouped;
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      const isInputFocused = document.activeElement === inputRef.current;

      switch (e.key) {
        case "c":
          if (!isInputFocused) {
            e.preventDefault();
            inputRef.current.focus();
            setSelectedTaskIndex(-1);
          }
          break;
        case "j":
          if (!isInputFocused) {
            e.preventDefault();
            setSelectedTaskIndex((prev) => Math.max(0, prev - 1));
          }
          break;
        case "k":
          if (!isInputFocused) {
            e.preventDefault();
            setSelectedTaskIndex((prev) =>
              Math.min(pendingTodosRef.current.length - 1, prev + 1)
            );
          }
          break;
        case "Escape":
          e.preventDefault();
          if (isInputFocused) {
            inputRef.current.blur();
          } else {
            setSelectedTaskIndex(-1);
          }
          break;
        case "Enter":
          if (!isInputFocused && selectedTaskIndex !== -1) {
            e.preventDefault();
            const selectedTodo = pendingTodosRef.current[selectedTaskIndex];
            if (selectedTodo) {
              completeTodo(selectedTodo.id);
            }
          }
          break;
      }
    },
    [selectedTaskIndex, completeTodo]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const groupedTodos = groupTodosByStatusAndTag(todos);

  // Function to sort tags alphanumerically
  const sortTags = (tags) => {
    return tags.sort((a, b) => {
      if (a === "Untagged") return -1;
      if (b === "Untagged") return 1;
      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  };

  if (isInitialLoading) {
    console.log("Initial loading state...");
    return (
      <div className="flex items-center justify-center h-screen bg-[#030d22] text-[#fdfeff]">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#030d22] text-[#ff2e97]">
        {error}
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#030d22] text-[#fdfeff]">
        <button
          onClick={connectWallet}
          className="bg-[#087eb4] text-white p-3 rounded-lg hover:bg-[#008dce] transition duration-300"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <WagmiConfig config={wagmiConfig}>
      <div className="min-h-screen bg-[#030d22] text-[#fdfeff] p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-[#ff2592]">Open Work</h1>
          <p className="mb-6 text-[#4d8bee]">
            Connected wallet: {walletAddress}
          </p>

          <form onSubmit={addTodo} className="mb-8">
            <div className="flex items-center bg-[#0d0931] rounded-lg overflow-hidden border border-[#150f53]">
              <input
                ref={inputRef}
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="New task (use #tags)"
                className="flex-grow p-3 bg-transparent focus:outline-none text-[#fdfeff] placeholder-[#f3f3f3]"
              />
              <button
                type="submit"
                className="bg-[#087eb4] text-white p-3 hover:bg-[#008dce] transition duration-300"
              >
                <SaveIcon className="h-6 w-6" />
              </button>
            </div>
          </form>

          {groupedTodos.pending &&
            Object.keys(groupedTodos.pending).length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-semibold mb-4 text-[#ffd400]">
                  Pending
                </h2>
                {sortTags(Object.keys(groupedTodos.pending)).map(
                  (tag) =>
                    groupedTodos.pending[tag].length > 0 && (
                      <div
                        key={tag}
                        className="mb-6 bg-[#04112c] rounded-lg p-4 border border-[#171033]"
                      >
                        <h3 className="text-xl font-medium mb-3 text-[#0ef3ff]">
                          {tag}
                        </h3>
                        <ul className="space-y-2">
                          {groupedTodos.pending[tag].map((todo, index) => {
                            const globalIndex =
                              pendingTodosRef.current.findIndex(
                                (t) => t.id === todo.id
                              );
                            return (
                              <li
                                key={todo.id}
                                className={`flex items-center justify-between p-2 ${
                                  selectedTaskIndex === globalIndex
                                    ? "bg-[#1a2b4a] rounded"
                                    : ""
                                }`}
                              >
                                <div className="flex flex-col">
                                  <span className="text-[#e1efff]">
                                    {todo.content}
                                  </span>
                                  <span className="text-sm text-[#8b9cb3]">
                                    Created at:{" "}
                                    {new Date(
                                      todo.createdAt * 1000
                                    ).toLocaleString()}
                                  </span>
                                </div>
                                <button
                                  onClick={() => completeTodo(todo.id)}
                                  className="ml-2 bg-[#06ad00] text-white px-3 py-1 rounded hover:bg-[#3dd69c] transition duration-300"
                                >
                                  <CheckIcon className="h-5 w-5" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )
                )}
              </div>
            )}

          {groupedTodos.completed &&
            Object.keys(groupedTodos.completed).length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-semibold mb-4 text-[#ffd400]">
                  Completed
                </h2>
                {sortTags(Object.keys(groupedTodos.completed)).map(
                  (tag) =>
                    groupedTodos.completed[tag].length > 0 && (
                      <div
                        key={tag}
                        className="mb-6 bg-[#04112c] rounded-lg p-4 border border-[#171033]"
                      >
                        <h3 className="text-xl font-medium mb-3 text-[#0ef3ff]">
                          {tag}
                        </h3>
                        <ul className="space-y-2">
                          {groupedTodos.completed[tag].map((todo) => (
                            <li
                              key={todo.id}
                              className="line-through text-[#8b9cb3]"
                            >
                              <div className="flex flex-col">
                                <span>{todo.content}</span>
                                <span className="text-sm">
                                  Created at:{" "}
                                  {new Date(
                                    todo.createdAt * 1000
                                  ).toLocaleString()}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                )}
              </div>
            )}

          {displayedTodos < totalTodos && (
            <button
              onClick={() => setDisplayedTodos((prev) => prev + 10)}
              className="w-full bg-[#087eb4] text-white p-3 rounded-lg hover:bg-[#008dce] transition duration-300"
            >
              Show More
            </button>
          )}

          <div className="text-sm text-gray-400 mt-4">
            <p>Keyboard shortcuts:</p>
            <ul className="list-disc list-inside">
              <li>
                <span style={{ color: "#ffd400" }}>
                  <strong>c</strong>
                </span>
                : Create task
              </li>
              <li>
                <span style={{ color: "#ffd400" }}>
                  <strong>j</strong>
                </span>
                : Navigate up in pending tasks
              </li>
              <li>
                <span style={{ color: "#ffd400" }}>
                  <strong>k</strong>
                </span>
                : Navigate down in pending tasks
              </li>
              <li>
                <span style={{ color: "#ffd400" }}>
                  <strong>esc</strong>
                </span>
                : Cancel task creation or deselect task
              </li>
              <li>
                <span style={{ color: "#ffd400" }}>
                  <strong>return</strong>
                </span>
                : Save task or complete selected task
              </li>
            </ul>
          </div>
        </div>
      </div>
    </WagmiConfig>
  );
}
