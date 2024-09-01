import React from "react";
import UserTasks from "../../components/UserTasks";

export default function UserPage({ params }) {
  const { username } = params;

  return (
    <div>
      <UserTasks ensName={`${username}.eth`} />
    </div>
  );
}
