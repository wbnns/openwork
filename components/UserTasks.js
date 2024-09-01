"use client"; // Ensure this is still at the top

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { createPublicClient, http } from "viem";
import { base, mainnet } from "viem/chains";
import AzimuthTodo from "../artifacts/contracts/AzimuthTodo.sol/AzimuthTodo.json";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

export default function UserTasks({ ensName }) {
  const [tasks, setTasks] = useState([]);
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    resolveENSName(ensName);
  }, [ensName]);

  const resolveENSName = async (name) => {
    try {
      // Check and format the ENS name correctly
      const ensNameToResolve = name.endsWith(".eth") ? name : `${name}.eth`;
      console.log(`Resolving ENS name: ${ensNameToResolve}`); // Debugging log

      // Create a client for the Ethereum mainnet for ENS resolution
      const mainnetClient = createPublicClient({
        chain: mainnet,
        transport: http(),
      });

      const resolvedAddress = await mainnetClient.getEnsAddress({
        name: ensNameToResolve,
      });

      if (resolvedAddress) {
        console.log(`Resolved address: ${resolvedAddress}`); // Debugging log
        setAddress(resolvedAddress);
        fetchTasks(resolvedAddress); // Fetch tasks using the resolved address
      } else {
        setError("ENS name not found");
        console.error("ENS name not found"); // Debugging log
      }
    } catch (err) {
      console.error("Error resolving ENS name:", err);
      setError("Error resolving ENS name");
    }
  };

  const fetchTasks = async (walletAddress) => {
    try {
      // Use ethers.js with the Base chain to interact with the contract
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(
        contractAddress,
        AzimuthTodo.abi,
        provider
      );

      const todos = await contract.getUserTodos(walletAddress, 0, 10);
      const formattedTodos = todos.map((todo) => ({
        id: todo.id.toNumber(),
        content: todo.content,
        tags: todo.tags,
        isCompleted: todo.isCompleted,
        createdAt: new Date(todo.createdAt.toNumber() * 1000).toLocaleString(),
      }));
      setTasks(formattedTodos);
    } catch (error) {
      setError("Failed to fetch tasks.");
      console.error("Failed to fetch tasks:", error);
    }
  };

  if (error) {
    return <div>{error}</div>;
  }

  if (!address) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Tasks for {ensName}</h1>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <p>{task.content}</p>
            <p>Tags: {task.tags.join(", ")}</p>
            <p>Completed: {task.isCompleted ? "Yes" : "No"}</p>
            <p>Created At: {task.createdAt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
