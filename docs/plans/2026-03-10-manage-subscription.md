# Manage Subscription Feature — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single "Manage Subscription" button (which redirects to Stripe portal) with a full in-app subscription management experience — cancel, reactivate, upgrade/downgrade between monthly and annual plans, and quick access to billing history.

**Architecture:** Expand `CloudSyncSettings` into a multi-section subscription dashboard. Add new API client functions for cancel, reactivate, and plan change. Each destructive action uses a confirmation modal. Stripe portal is kept as a fallback for payment method and invoice management.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, date-fns, existing UI components (Card, Button, Badge), existing auth store and API client.

---

## Current State

- `CloudSyncSettings.tsx` shows email, plan badge, status badge, renewal date, and a single "Manage Subscription" button that calls `getSubscriptionPortalUrl()` and redirects.
- `apiClient.ts` has one billing endpoint: `POST /billing/portal` → `{ url }`.
- `AuthUser` type has `plan`, `subscriptionStatus` ("active" | "cancelled" | "expired"), `subscriptionEndsAt`.
- Pricing: monthly $4.99/mo, annual $49.99/yr (17% savings).

## Assumptions

- Backend will implement the new API endpoints described below. This plan covers **frontend only**.
- Backend cancel endpoint sets `subscriptionStatus` to `"cancelled"` and populates `subscriptionEndsAt` with the end of the current billing period.
- Backend reactivate endpoint sets `subscriptionStatus` back to `"active"`.
- Backend change-plan endpoint swaps the Stripe subscription price and returns the updated user.

---

### Task 1: Add New API Client Functions

**Files:**
- Modify: `src/lib/apiClient.ts`
- Test: `src/lib/__tests__/apiClient.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/apiClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the new functions by mocking fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the config module
vi.mock("../../config/cloud", () => ({
  apiUrl: "https://api.test.com",
}));

describe("apiClient billing functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("jninty_auth_token", "test-token");
  });

  it("cancelSubscription sends POST to /billing/cancel", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "u1",
          email: "a@b.com",
          plan: "monthly",
          subscriptionStatus: "cancelled",
          subscriptionEndsAt: "2026-04-10",
        }),
    });

    const { cancelSubscription } = await import("../apiClient");
    const user = await cancelSubscription();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/billing/cancel",
      expect.objectContaining({ method: "POST" }),
    );
    expect(user.subscriptionStatus).toBe("cancelled");
  });

  it("reactivateSubscription sends POST to /billing/reactivate", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "u1",
          email: "a@b.com",
          plan: "monthly",
          subscriptionStatus: "active",
          subscriptionEndsAt: "2026-04-10",
        }),
    });

    const { reactivateSubscription } = await import("../apiClient");
    const user = await reactivateSubscription();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/billing/reactivate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(user.subscriptionStatus).toBe("active");
  });

  it("changePlan sends POST to /billing/change-plan with priceId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "u1",
          email: "a@b.com",
          plan: "annual",
          subscriptionStatus: "active",
          subscriptionEndsAt: "2027-03-10",
        }),
    });

    const { changePlan } = await import("../apiClient");
    const user = await changePlan("price_annual_123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/billing/change-plan",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ priceId: "price_annual_123" }),
      }),
    );
    expect(user.plan).toBe("annual");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/apiClient.test.ts`
Expected: FAIL — functions don't exist yet.

**Step 3: Add the three new API functions to apiClient.ts**

Add these at the bottom of `src/lib/apiClient.ts`:

```typescript
export async function cancelSubscription(): Promise<AuthUser> {
  const raw = await request<Record<string, unknown>>("/billing/cancel", {
    method: "POST",
  });
  return normalizeUser(raw);
}

export async function reactivateSubscription(): Promise<AuthUser> {
  const raw = await request<Record<string, unknown>>("/billing/reactivate", {
    method: "POST",
  });
  return normalizeUser(raw);
}

export async function changePlan(priceId: string): Promise<AuthUser> {
  const raw = await request<Record<string, unknown>>("/billing/change-plan", {
    method: "POST",
    body: JSON.stringify({ priceId }),
  });
  return normalizeUser(raw);
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/apiClient.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/apiClient.ts src/lib/__tests__/apiClient.test.ts
git commit -m "feat: add cancel, reactivate, and changePlan API client functions"
```

---

### Task 2: Create ConfirmModal Component

**Files:**
- Create: `src/components/ui/ConfirmModal.tsx`
- Test: `src/components/ui/ConfirmModal.test.tsx`

**Step 1: Write the failing test**

Create `src/components/ui/ConfirmModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmModal from "./ConfirmModal";

describe("ConfirmModal", () => {
  it("renders title and message when open", () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Cancel Subscription"
        message="Are you sure you want to cancel?"
        confirmLabel="Yes, Cancel"
        variant="danger"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Cancel Subscription")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to cancel?")).toBeInTheDocument();
    expect(screen.getByText("Yes, Cancel")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <ConfirmModal
        isOpen={false}
        title="Cancel Subscription"
        message="Are you sure?"
        confirmLabel="Confirm"
        variant="danger"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText("Cancel Subscription")).not.toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="Cancel"
        message="Sure?"
        confirmLabel="Confirm"
        variant="danger"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="Cancel"
        message="Sure?"
        confirmLabel="Confirm"
        variant="danger"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByText("Never Mind"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows loading state when isLoading is true", () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Cancel"
        message="Sure?"
        confirmLabel="Confirm"
        variant="danger"
        isLoading={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Confirm")).toBeDisabled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/ConfirmModal.test.tsx`
Expected: FAIL — component doesn't exist.

**Step 3: Create the ConfirmModal component**

Create `src/components/ui/ConfirmModal.tsx`:

```typescript
import Button from "./Button";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  variant,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-cream-100 p-6 shadow-lg">
        <h3 className="font-display text-lg font-semibold text-text-heading">
          {title}
        </h3>
        <p className="mt-2 text-sm text-text-secondary">{message}</p>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            Never Mind
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/ConfirmModal.test.tsx`
Expected: PASS

> **Note:** If Button doesn't have a `"danger"` or `"ghost"` variant, check `src/components/ui/Button.tsx` and either use an existing variant (e.g. `"secondary"` for ghost, add a red class for danger) or add the variants. Adjust the ConfirmModal accordingly.

**Step 5: Commit**

```bash
git add src/components/ui/ConfirmModal.tsx src/components/ui/ConfirmModal.test.tsx
git commit -m "feat: add reusable ConfirmModal component"
```

---

### Task 3: Create SubscriptionActions Component

This is the core UI — it replaces the single "Manage Subscription" button with contextual actions based on subscription status.

**Files:**
- Create: `src/components/cloud/SubscriptionActions.tsx`
- Test: `src/components/cloud/SubscriptionActions.test.tsx`

**Step 1: Write the failing tests**

Create `src/components/cloud/SubscriptionActions.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubscriptionActions from "./SubscriptionActions";
import type { AuthUser } from "../../types/auth";

// Mock API client
vi.mock("../../lib/apiClient", () => ({
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  changePlan: vi.fn(),
  getSubscriptionPortalUrl: vi.fn(),
}));

const baseUser: AuthUser = {
  id: "u1",
  email: "test@example.com",
  plan: "monthly",
  subscriptionStatus: "active",
  subscriptionEndsAt: "2026-04-10",
};

describe("SubscriptionActions", () => {
  const onUserUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Cancel and Switch to Annual buttons for active monthly user", () => {
    render(
      <SubscriptionActions user={baseUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Cancel Subscription")).toBeInTheDocument();
    expect(screen.getByText(/Switch to Annual/)).toBeInTheDocument();
  });

  it("shows Cancel and Switch to Monthly buttons for active annual user", () => {
    const annualUser = { ...baseUser, plan: "annual" };
    render(
      <SubscriptionActions user={annualUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Cancel Subscription")).toBeInTheDocument();
    expect(screen.getByText(/Switch to Monthly/)).toBeInTheDocument();
  });

  it("shows Reactivate button for cancelled user", () => {
    const cancelledUser = { ...baseUser, subscriptionStatus: "cancelled" as const };
    render(
      <SubscriptionActions user={cancelledUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Reactivate Subscription")).toBeInTheDocument();
    expect(screen.queryByText("Cancel Subscription")).not.toBeInTheDocument();
  });

  it("shows Resubscribe button for expired user", () => {
    const expiredUser = { ...baseUser, subscriptionStatus: "expired" as const };
    render(
      <SubscriptionActions user={expiredUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Resubscribe")).toBeInTheDocument();
  });

  it("shows confirm modal when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SubscriptionActions user={baseUser} onUserUpdated={onUserUpdated} />,
    );

    await user.click(screen.getByText("Cancel Subscription"));
    expect(
      screen.getByText(/You'll continue to have access until/),
    ).toBeInTheDocument();
  });

  it("always shows Payment & Invoices link", () => {
    render(
      <SubscriptionActions user={baseUser} onUserUpdated={onUserUpdated} />,
    );

    expect(screen.getByText("Payment & Invoices")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/cloud/SubscriptionActions.test.tsx`
Expected: FAIL — component doesn't exist.

**Step 3: Create SubscriptionActions component**

Create `src/components/cloud/SubscriptionActions.tsx`:

```typescript
import { useState } from "react";
import { format } from "date-fns";
import type { AuthUser } from "../../types/auth";
import {
  cancelSubscription,
  reactivateSubscription,
  changePlan,
  getSubscriptionPortalUrl,
} from "../../lib/apiClient";
import {
  stripeMonthlyPriceId,
  stripeAnnualPriceId,
  monthlyPrice,
  annualPrice,
} from "../../config/cloud";
import Button from "../ui/Button";
import ConfirmModal from "../ui/ConfirmModal";

interface Props {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
}

type ModalType = "cancel" | "change-plan" | null;

export default function SubscriptionActions({ user, onUserUpdated }: Props) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const isMonthly = user.plan === "monthly";
  const targetPlan = isMonthly ? "annual" : "monthly";
  const targetPriceId = isMonthly ? stripeAnnualPriceId : stripeMonthlyPriceId;
  const targetPrice = isMonthly ? annualPrice : monthlyPrice;

  async function handleCancel() {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await cancelSubscription();
      onUserUpdated(updated);
      setActiveModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel subscription");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReactivate() {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await reactivateSubscription();
      onUserUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reactivate subscription");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChangePlan() {
    if (!targetPriceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const updated = await changePlan(targetPriceId);
      onUserUpdated(updated);
      setActiveModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change plan");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenPortal() {
    setPortalLoading(true);
    try {
      const { url } = await getSubscriptionPortalUrl();
      window.location.href = url;
    } catch {
      setPortalLoading(false);
    }
  }

  const renewalDate = user.subscriptionEndsAt
    ? format(new Date(user.subscriptionEndsAt), "MMM dd, yyyy")
    : null;

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Active subscription actions */}
      {user.subscriptionStatus === "active" && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => setActiveModal("change-plan")}
          >
            Switch to {targetPlan === "annual" ? "Annual" : "Monthly"} ({targetPrice})
          </Button>
          <Button
            variant="secondary"
            onClick={() => setActiveModal("cancel")}
          >
            Cancel Subscription
          </Button>
        </div>
      )}

      {/* Cancelled — offer reactivation */}
      {user.subscriptionStatus === "cancelled" && (
        <div className="space-y-2">
          <p className="text-sm text-text-muted">
            Your subscription is cancelled but you have access until{" "}
            <span className="font-medium">{renewalDate}</span>.
          </p>
          <Button
            onClick={() => void handleReactivate()}
            disabled={isLoading}
          >
            {isLoading ? "Reactivating..." : "Reactivate Subscription"}
          </Button>
        </div>
      )}

      {/* Expired — link to resubscribe (goes through sign-up flow) */}
      {user.subscriptionStatus === "expired" && (
        <div className="space-y-2">
          <p className="text-sm text-text-muted">
            Your subscription has expired. Resubscribe to restore cloud sync.
          </p>
          <Button
            onClick={() => void handleOpenPortal()}
            disabled={portalLoading}
          >
            {portalLoading ? "Loading..." : "Resubscribe"}
          </Button>
        </div>
      )}

      {/* Payment & invoices — always visible */}
      <button
        type="button"
        className="text-sm text-green-700 hover:underline disabled:opacity-50"
        onClick={() => void handleOpenPortal()}
        disabled={portalLoading}
      >
        Payment & Invoices &#8599;
      </button>

      {/* Cancel confirmation modal */}
      <ConfirmModal
        isOpen={activeModal === "cancel"}
        title="Cancel Subscription"
        message={`You'll continue to have access until ${renewalDate ?? "the end of your billing period"}. After that, cloud sync will stop but your local data is always safe.`}
        confirmLabel="Yes, Cancel"
        variant="danger"
        isLoading={isLoading}
        onConfirm={() => void handleCancel()}
        onCancel={() => setActiveModal(null)}
      />

      {/* Change plan confirmation modal */}
      <ConfirmModal
        isOpen={activeModal === "change-plan"}
        title={`Switch to ${targetPlan === "annual" ? "Annual" : "Monthly"} Plan`}
        message={`You'll be switched to the ${targetPlan} plan at ${targetPrice}. The change takes effect at your next billing date.`}
        confirmLabel="Switch Plan"
        variant="primary"
        isLoading={isLoading}
        onConfirm={() => void handleChangePlan()}
        onCancel={() => setActiveModal(null)}
      />
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/cloud/SubscriptionActions.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/cloud/SubscriptionActions.tsx src/components/cloud/SubscriptionActions.test.tsx
git commit -m "feat: add SubscriptionActions component with cancel, reactivate, change plan"
```

---

### Task 4: Integrate SubscriptionActions into CloudSyncSettings

**Files:**
- Modify: `src/components/cloud/CloudSyncSettings.tsx`
- Test: `src/components/cloud/CloudSyncSettings.test.tsx` (new)

**Step 1: Write a basic integration test**

Create `src/components/cloud/CloudSyncSettings.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the auth store to return an authenticated user
vi.mock("../../store/authStore", () => ({
  useAuth: () => ({
    state: {
      isAuthenticated: true,
      user: {
        id: "u1",
        email: "test@example.com",
        plan: "monthly",
        subscriptionStatus: "active",
        subscriptionEndsAt: "2026-04-10",
      },
      token: "tok",
      isLoading: false,
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock("../../config/cloud", () => ({
  isCloudEnabled: true,
  apiUrl: "https://api.test.com",
  stripeMonthlyPriceId: "price_monthly",
  stripeAnnualPriceId: "price_annual",
  monthlyPrice: "$4.99/mo",
  annualPrice: "$49.99/yr",
}));

vi.mock("../../lib/apiClient", () => ({
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  changePlan: vi.fn(),
  getSubscriptionPortalUrl: vi.fn(),
}));

describe("CloudSyncSettings (authenticated)", () => {
  it("renders subscription actions for active user", async () => {
    const { default: CloudSyncSettings } = await import("./CloudSyncSettings");
    render(<CloudSyncSettings />);

    expect(screen.getByText("Cancel Subscription")).toBeInTheDocument();
    expect(screen.getByText(/Switch to Annual/)).toBeInTheDocument();
    expect(screen.getByText("Payment & Invoices")).toBeInTheDocument();
  });

  it("renders user email and plan badge", async () => {
    const { default: CloudSyncSettings } = await import("./CloudSyncSettings");
    render(<CloudSyncSettings />);

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("monthly")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/cloud/CloudSyncSettings.test.tsx`
Expected: FAIL — SubscriptionActions not yet integrated.

**Step 3: Update CloudSyncSettings to use SubscriptionActions**

Replace the `{/* Actions */}` section (lines 137–146) and add the import + handler:

In `src/components/cloud/CloudSyncSettings.tsx`:

1. Add import at top:
```typescript
import SubscriptionActions from "./SubscriptionActions";
```

2. Add handler inside the component (after `handleManageSubscription` or replace it):
```typescript
function handleUserUpdated(updated: AuthUser) {
  dispatch({ type: "UPDATE_USER", payload: updated });
}
```

3. Add `AuthUser` import:
```typescript
import type { AuthUser } from "../../types/auth";
```

4. Destructure `dispatch` from `useAuth()`:
```typescript
const { state, dispatch } = useAuth();
```

5. Replace the `{/* Actions */}` div (lines 137–146) with:
```typescript
{/* Actions */}
<SubscriptionActions user={user} onUserUpdated={handleUserUpdated} />
```

6. Remove the now-unused `portalLoading` state and `handleManageSubscription` function and the `getSubscriptionPortalUrl` import (these are now handled by SubscriptionActions).

**Final CloudSyncSettings.tsx (authenticated section) should look like:**

```typescript
import { useState } from "react";
import { format } from "date-fns";
import { isCloudEnabled, apiUrl } from "../../config/cloud";
import { useAuth } from "../../store/authStore";
import type { AuthUser } from "../../types/auth";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import LoginModal from "./LoginModal";
import SignUpModal from "./SignUpModal";
import SubscriptionActions from "./SubscriptionActions";

export default function CloudSyncSettings() {
  const { state, dispatch } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  if (!isCloudEnabled) return null;

  function handleSwitchToSignUp() {
    setShowLogin(false);
    setShowSignUp(true);
  }

  function handleSwitchToLogin() {
    setShowSignUp(false);
    setShowLogin(true);
  }

  function handleUserUpdated(updated: AuthUser) {
    dispatch({ type: "UPDATE_USER", payload: updated });
  }

  // Not authenticated — same as before (lines 42–84 unchanged)
  if (!state.isAuthenticated) {
    return (
      <>
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Jninty Cloud Sync
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Sync your garden data across all your devices. Your data is always
            stored locally — cloud sync is optional.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={() => setShowLogin(true)}>
              Sign In
            </Button>
            <Button onClick={() => setShowSignUp(true)}>Get Started</Button>
          </div>
          {apiUrl && (
            <a
              href={apiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-text-muted hover:underline"
            >
              Learn more about Jninty Cloud &#8599;
            </a>
          )}
        </Card>
        <LoginModal
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
          onSwitchToSignUp={handleSwitchToSignUp}
        />
        <SignUpModal
          isOpen={showSignUp}
          onClose={() => setShowSignUp(false)}
          onSwitchToLogin={handleSwitchToLogin}
        />
      </>
    );
  }

  // Authenticated
  const { user } = state;
  if (!user) return null;

  const subscriptionBadge = (() => {
    switch (user.subscriptionStatus) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "cancelled":
        return (
          <Badge variant="warning">
            Cancels on{" "}
            {user.subscriptionEndsAt
              ? format(new Date(user.subscriptionEndsAt), "MMM dd, yyyy")
              : "—"}
          </Badge>
        );
      case "expired":
        return <Badge variant="danger">Expired</Badge>;
    }
  })();

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-text-heading">
        Manage Subscription
      </h2>

      <div className="mt-4 space-y-4">
        {/* User info */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">{user.email}</span>
          <div className="flex items-center gap-2">
            <Badge>{user.plan}</Badge>
            {subscriptionBadge}
          </div>
        </div>

        {/* Subscription details */}
        <div className="text-sm text-text-secondary space-y-1">
          {user.subscriptionEndsAt && (
            <p>
              {user.subscriptionStatus === "cancelled" ? "Access until" : "Renews on"}:{" "}
              <span className="font-medium">
                {format(new Date(user.subscriptionEndsAt), "MMM dd, yyyy")}
              </span>
            </p>
          )}
        </div>

        {/* Actions — now full subscription management */}
        <SubscriptionActions user={user} onUserUpdated={handleUserUpdated} />
      </div>
    </Card>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/cloud/CloudSyncSettings.test.tsx`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm run test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/components/cloud/CloudSyncSettings.tsx src/components/cloud/CloudSyncSettings.test.tsx
git commit -m "feat: integrate SubscriptionActions into CloudSyncSettings"
```

---

### Task 5: Type-Check and Lint

**Step 1: Run TypeScript type-check**

Run: `npx tsc --noEmit`
Expected: No errors. Fix any issues.

**Step 2: Run ESLint**

Run: `npm run lint`
Expected: No errors. Fix any issues.

**Step 3: Run full build**

Run: `npm run build`
Expected: Clean build.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and type-check issues"
```

---

## Summary of New/Modified Files

| File | Action |
|------|--------|
| `src/lib/apiClient.ts` | Add `cancelSubscription`, `reactivateSubscription`, `changePlan` |
| `src/lib/__tests__/apiClient.test.ts` | New — tests for API functions |
| `src/components/ui/ConfirmModal.tsx` | New — reusable confirmation modal |
| `src/components/ui/ConfirmModal.test.tsx` | New — tests for ConfirmModal |
| `src/components/cloud/SubscriptionActions.tsx` | New — cancel/reactivate/change plan/portal UI |
| `src/components/cloud/SubscriptionActions.test.tsx` | New — tests for SubscriptionActions |
| `src/components/cloud/CloudSyncSettings.tsx` | Modified — replace single button with SubscriptionActions |
| `src/components/cloud/CloudSyncSettings.test.tsx` | New — integration test |

---

## Part 2: Backend / API Implementation

> This section covers the server-side endpoints that the frontend depends on. Implement these **before or in parallel with** the frontend tasks above.

### Assumed Backend Stack

The existing codebase uses a custom API server with:
- JWT-based authentication (Bearer tokens)
- Stripe for payment processing (server-side checkout)
- CouchDB for per-user data sync
- An `/auth/me` endpoint that returns the user object
- A `/billing/portal` endpoint that creates a Stripe billing portal session

---

### Task B1: Cancel Subscription Endpoint

**Endpoint:** `POST /billing/cancel`

**Auth:** Requires valid Bearer token.

**Behavior:**
1. Look up the authenticated user's Stripe subscription ID.
2. Call Stripe API: `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })` — this cancels at the end of the current billing period (not immediately).
3. Update the user record: set `subscriptionStatus` to `"cancelled"` and `subscriptionEndsAt` to the Stripe subscription's `current_period_end` timestamp.
4. Return the updated user object.

**Response (200):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "plan": "monthly",
  "subscriptionStatus": "cancelled",
  "subscriptionEndsAt": "2026-04-10T00:00:00Z"
}
```

**Error responses:**
- `401` — Invalid/missing token
- `400` — No active subscription to cancel
- `500` — Stripe API failure

**Test cases:**
1. Active subscription → returns cancelled user with correct `subscriptionEndsAt`
2. Already cancelled subscription → returns 400 error
3. Expired subscription → returns 400 error
4. No auth token → returns 401

---

### Task B2: Reactivate Subscription Endpoint

**Endpoint:** `POST /billing/reactivate`

**Auth:** Requires valid Bearer token.

**Behavior:**
1. Look up the authenticated user's Stripe subscription ID.
2. Verify the subscription is in `cancel_at_period_end` state (i.e., cancelled but not yet expired).
3. Call Stripe API: `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })` — this removes the pending cancellation.
4. Update the user record: set `subscriptionStatus` back to `"active"`.
5. Return the updated user object.

**Response (200):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "plan": "monthly",
  "subscriptionStatus": "active",
  "subscriptionEndsAt": "2026-04-10T00:00:00Z"
}
```

**Error responses:**
- `401` — Invalid/missing token
- `400` — Subscription is not in a cancellable state (already expired or already active)
- `500` — Stripe API failure

**Test cases:**
1. Cancelled (pending) subscription → returns active user
2. Already active subscription → returns 400 error
3. Expired subscription → returns 400 error
4. No auth token → returns 401

---

### Task B3: Change Plan Endpoint

**Endpoint:** `POST /billing/change-plan`

**Auth:** Requires valid Bearer token.

**Request body:**
```json
{
  "priceId": "price_annual_xxx"
}
```

**Behavior:**
1. Look up the authenticated user's Stripe subscription ID and current subscription item.
2. Validate the `priceId` is one of the allowed price IDs (monthly or annual — reject anything else).
3. Validate the user isn't already on the requested plan.
4. Call Stripe API to update the subscription:
   ```
   stripe.subscriptions.update(subscriptionId, {
     items: [{
       id: subscriptionItemId,
       price: priceId,
     }],
     proration_behavior: "create_prorations"
   })
   ```
   This prorates the difference — if upgrading from monthly to annual, user pays the difference immediately. If downgrading, they get a credit.
5. Update the user record: set `plan` to the new plan name, update `subscriptionEndsAt` from Stripe's `current_period_end`.
6. Return the updated user object.

**Response (200):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "plan": "annual",
  "subscriptionStatus": "active",
  "subscriptionEndsAt": "2027-03-10T00:00:00Z"
}
```

**Error responses:**
- `401` — Invalid/missing token
- `400` — Invalid price ID, or already on the requested plan
- `400` — Subscription not active (cancelled/expired users can't change plan)
- `500` — Stripe API failure

**Test cases:**
1. Monthly → annual: returns updated user with `plan: "annual"`
2. Annual → monthly: returns updated user with `plan: "monthly"`
3. Same plan → returns 400 error
4. Invalid price ID → returns 400 error
5. Cancelled subscription → returns 400 error
6. No auth token → returns 401

---

### Task B4: Stripe Webhook Updates (if not already handled)

If the backend doesn't already handle these Stripe webhooks, they should be added to keep user records in sync:

**Webhook events to handle:**

| Event | Action |
|-------|--------|
| `customer.subscription.updated` | Sync `subscriptionStatus`, `plan`, `subscriptionEndsAt` from Stripe |
| `customer.subscription.deleted` | Set `subscriptionStatus` to `"expired"`, stop CouchDB access |
| `invoice.payment_failed` | Optionally set a `paymentFailed` flag or send notification |
| `invoice.paid` | Clear any `paymentFailed` flag |

**Implementation notes:**
- Verify webhook signature using `stripe.webhooks.constructEvent()`
- Use `event.data.object.metadata` or `customer` field to look up the user
- Always treat Stripe as the source of truth — overwrite local state with Stripe state

---

### Backend API Summary

| Method | Path | Body | Response | Stripe Call |
|--------|------|------|----------|-------------|
| `POST` | `/billing/cancel` | — | `AuthUser` | `subscriptions.update({ cancel_at_period_end: true })` |
| `POST` | `/billing/reactivate` | — | `AuthUser` | `subscriptions.update({ cancel_at_period_end: false })` |
| `POST` | `/billing/change-plan` | `{ priceId }` | `AuthUser` | `subscriptions.update({ items, proration_behavior })` |
| `POST` | `/billing/portal` | — | `{ url }` | `billingPortal.sessions.create()` (existing) |
