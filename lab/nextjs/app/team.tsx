"use client";

import users from "../../basic/users.csv";

export function Team() {
  return <pre id="client">{JSON.stringify(users.map((user) => user.name))}</pre>;
}
