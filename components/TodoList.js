"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createWeb3Modal, defaultWagmiConfig } from "@web3modal/wagmi";
import { WagmiConfig } from "wagmi";
import { base } from "viem/chains";
import { ethers } from "ethers";
import { createPublicClient, http } from "viem";
import AzimuthTodo from "../artifacts/contracts/AzimuthTodo.sol/AzimuthTodo.json";
import { debounce } from "lodash";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!contractAddress) {
  throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS environment variable");
}

if (!projectId) {
  throw new Error("Missing NEXT_PUBLIC_PROJECT_ID environment variable");
}

const metadata = {
  name: "Azimuth Todo",
  description: "A decentralized todo list on Base",
  url: "https://web3modal.com",
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
          createdAt: todo.createdAt
            ? new Date(todo.createdAt.toNumber() * 1000)
            : null, // Convert from seconds to milliseconds
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

  const formatDate = (date) => {
    if (!date) return "No date available";
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const sortTodosByDate = (todos) => {
    return todos.sort((a, b) => a.createdAt - b.createdAt);
  };

  const debouncedFetchTodosCallback = useCallback(() => {
    debouncedFetchTodos(fetchTodos);
  }, [fetchTodos]);

  const initializeContract = useCallback(async () => {
    console.log("Initializing contract");
    try {
      if (typeof window.ethereum === "undefined") {
        throw new Error(
          "No Web3 provider detected. Please install MetaMask or another Web3 wallet."
        );
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const { chainId } = await provider.getNetwork();

      if (chainId !== 8453) {
        throw new Error("Please connect to the Base network.");
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const userAddress = accounts[0];
      setWalletAddress(userAddress);

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
          setError("Please connect to the Base network.");
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
          "Failed to initialize the app. Please make sure you're connected to the Base network and try again."
      );
    }
  }, []);

  useEffect(() => {
    initializeContract();
  }, [initializeContract]);

  useEffect(() => {
    if (contract && walletAddress) {
      fetchTodos();
    }
  }, [contract, walletAddress, fetchTodos]);

  const addTodo = useCallback(
    async (e) => {
      e.preventDefault();
      if (!newTodo.trim() || !contract) return;

      const tags = newTodo.match(/#\w+/g) || [];
      const content = newTodo.replace(/#\w+/g, "").trim();

      // Optimistic update
      const optimisticTodo = {
        id: Date.now(), // temporary id
        content,
        tags,
        isCompleted: false,
        createdAt: new Date(), // Add this line
      };
      setTodos((prevTodos) => [...prevTodos, optimisticTodo]);
      setNewTodo("");

      try {
        const tx = await contract.createTodo(content, tags);
        await tx.wait();
        // Fetch the updated list to get the correct ID from the blockchain
        debouncedFetchTodosCallback();
      } catch (error) {
        console.error("Failed to add todo:", error);
        setError(
          "Failed to add todo. Please make sure you're connected to Base and try again."
        );
        // Remove the optimistic todo if the transaction failed
        setTodos((prevTodos) =>
          prevTodos.filter((todo) => todo.id !== optimisticTodo.id)
        );
      }
    },
    [newTodo, contract, debouncedFetchTodosCallback]
  );

  const completeTodo = useCallback(
    async (id) => {
      // Optimistic update
      setTodos((prevTodos) =>
        prevTodos.map((todo) =>
          todo.id === id ? { ...todo, isCompleted: true } : todo
        )
      );

      try {
        const tx = await contract.completeTodo(id);
        await tx.wait();
        // We don't need to call debouncedFetchTodosCallback here anymore
      } catch (error) {
        console.error("Failed to complete todo:", error);
        setError(
          "Failed to complete todo. Please make sure you're connected to Base and try again."
        );
        // Revert the optimistic update
        setTodos((prevTodos) =>
          prevTodos.map((todo) =>
            todo.id === id ? { ...todo, isCompleted: false } : todo
          )
        );
      }
    },
    [contract]
  );

  const groupTodosByStatusAndTag = useCallback((todosList) => {
    return todosList.reduce((acc, todo) => {
      const status = todo.isCompleted ? "completed" : "pending";
      if (!acc[status]) acc[status] = {};

      const tags = todo.tags.length === 0 ? ["Untagged"] : todo.tags;
      tags.forEach((tag) => {
        if (!acc[status][tag]) acc[status][tag] = [];
        acc[status][tag].push(todo);
      });

      return acc;
    }, {});
  }, []);

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
        Please connect your wallet to Base to view your todos.
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
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="Add a todo (use #tags)"
                className="flex-grow p-3 bg-transparent focus:outline-none text-[#fdfeff] placeholder-[#f3f3f3]"
              />
              <button
                type="submit"
                className="bg-[#087eb4] text-white p-3 hover:bg-[#008dce] transition duration-300"
              >
                Add Todo
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
                        <ul className="space-y-4">
                          {sortTodosByDate(groupedTodos.pending[tag]).map(
                            (todo) => (
                              <li key={todo.id} className="flex flex-col">
                                <div className="flex items-center justify-between">
                                  <span className="text-[#e1efff]">
                                    {todo.content}
                                  </span>
                                  <button
                                    onClick={() => completeTodo(todo.id)}
                                    className="ml-2 bg-[#06ad00] text-white px-3 py-1 rounded hover:bg-[#3dd69c] transition duration-300"
                                  >
                                    Complete
                                  </button>
                                </div>
                                <span className="text-xs text-[#8b9cb3] mt-1">
                                  {formatDate(todo.createdAt)}
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )
                )}
              </div>
            )}

          {groupedTodos.completed &&
            Object.keys(groupedTodos.completed).length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-semibold mb-4 text-[#39c0ff]">
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
                          {sortTodosByDate(groupedTodos.completed[tag]).map(
                            (todo) => (
                              <li key={todo.id} className="flex flex-col">
                                <span className="line-through text-[#8b9cb3]">
                                  {todo.content}
                                </span>
                                <span className="text-xs text-[#8b9cb3] mt-1">
                                  {formatDate(todo.createdAt)}
                                </span>
                              </li>
                            )
                          )}
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
        </div>
      </div>
    </WagmiConfig>
  );
}
