import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/affaires")({
  head: () => ({ meta: [{ title: "Affaires — Setup Stock" }] }),
  component: () => <Outlet />,
});
