import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrganizationManager from "@/components/dashboard/OrganizationManager";
import { authClient } from "@/lib/auth-client";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: {
      list: vi.fn(),
      create: vi.fn(),
      setActive: vi.fn(),
      getFullOrganization: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@phosphor-icons/react", () => ({
  Buildings: () => <div data-testid="icon-buildings" />,
  Check: () => <div data-testid="icon-check" />,
  Copy: () => <div data-testid="icon-copy" />,
  CreditCard: () => <div data-testid="icon-credit-card" />,
  Crown: () => <div data-testid="icon-crown" />,
  Plus: () => <div data-testid="icon-plus" />,
  Trash: () => <div data-testid="icon-trash" />,
  UserCircle: () => <div data-testid="icon-user-circle" />,
  Users: () => <div data-testid="icon-users" />,
}));

describe("OrganizationManager component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authClient.organization.list).mockResolvedValue({
      data: [],
    } as never);
    vi.mocked(authClient.organization.create).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    vi.mocked(authClient.organization.setActive).mockResolvedValue({
      data: null,
    } as never);
    vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
      data: { members: [] },
    } as never);
  });

  it("creates an organization and selects it when Better Auth returns data", async () => {
    const organization = {
      id: "org_123",
      name: "Acme Co",
      slug: "acme-co",
      createdAt: new Date(),
    };

    vi.mocked(authClient.organization.list)
      .mockResolvedValueOnce({ data: [] } as never)
      .mockResolvedValueOnce({ data: [organization] } as never);
    vi.mocked(authClient.organization.create).mockResolvedValue({
      data: organization,
      error: null,
    } as never);

    render(<OrganizationManager />);

    await waitFor(() => {
      expect(screen.getByText("New Organization")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("New Organization"));
    fireEvent.change(screen.getByLabelText("Organization Name *"), {
      target: { value: "Acme Co" },
    });
    fireEvent.click(screen.getByText("Create Organization"));

    await waitFor(() => {
      expect(authClient.organization.create).toHaveBeenCalledWith({
        name: "Acme Co",
        slug: "acme-co",
      });
      expect(screen.getByText("Acme Co")).toBeInTheDocument();
      expect(screen.getByText("/acme-co")).toBeInTheDocument();
    });
  });

  it("shows Better Auth organization create errors instead of failing silently", async () => {
    vi.mocked(authClient.organization.create).mockResolvedValue({
      data: null,
      error: { message: "Organization slug is already taken" },
    } as never);

    render(<OrganizationManager />);

    await waitFor(() => {
      expect(screen.getByText("New Organization")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("New Organization"));
    fireEvent.change(screen.getByLabelText("Organization Name *"), {
      target: { value: "Acme Co" },
    });
    fireEvent.click(screen.getByText("Create Organization"));

    await waitFor(() => {
      expect(screen.getByText("Organization slug is already taken")).toBeInTheDocument();
    });
  });
});
