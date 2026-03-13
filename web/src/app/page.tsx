import { signOut, withAuth } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import {
  createTenantForOrganization,
  createWorkspaceWithFirstTenant,
  getDashboardOrganizations,
} from "@/db/control-plane";
import { hasWorkOSConfig } from "@/lib/workos";

export const dynamic = "force-dynamic";

async function signOutAction() {
  "use server";

  await signOut({ returnTo: "/" });
}

async function createWorkspaceAction(formData: FormData) {
  "use server";

  const { user } = await withAuth({ ensureSignedIn: true });
  const workspaceName = formData.get("workspaceName")?.toString().trim();
  const tenantName = formData.get("tenantName")?.toString().trim();

  if (!workspaceName || !tenantName) {
    throw new Error("Workspace name and tenant name are required");
  }

  await createWorkspaceWithFirstTenant({
    workspaceName,
    tenantName,
    user,
  });

  revalidatePath("/");
}

async function createTenantAction(formData: FormData) {
  "use server";

  const { user } = await withAuth({ ensureSignedIn: true });
  const organizationId = formData.get("organizationId")?.toString();
  const tenantName = formData.get("tenantName")?.toString().trim();

  if (!organizationId || !tenantName) {
    throw new Error("Organization and tenant name are required");
  }

  await createTenantForOrganization({
    organizationId,
    tenantName,
    userExternalId: user.id,
  });

  revalidatePath("/");
}

export default async function Home() {
  if (!hasWorkOSConfig()) {
    return (
      <div className="min-h-screen bg-[linear-gradient(145deg,#f7f5ef_0%,#ece7db_48%,#ddd4bf_100%)] px-6 py-10 text-stone-950">
        <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-between gap-12 border border-stone-300/80 bg-stone-50/90 p-8 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_24px_80px_rgba(50,40,22,0.12)] sm:p-12">
          <div className="space-y-5">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-stone-500">
              Otto Control Plane
            </p>
            <h1 className="max-w-3xl text-4xl leading-tight font-semibold sm:text-6xl">
              WorkOS is the next dependency to configure.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
              The dashboard and tenant creation flow are implemented, but this
              app will stay in setup mode until the WorkOS environment variables
              are present.
            </p>
          </div>

          <div className="grid gap-4 border border-stone-300 bg-stone-950 p-6 text-stone-100 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                Required Now
              </p>
              <pre className="mt-3 text-sm leading-7 text-stone-200">
                {`WORKOS_CLIENT_ID=
WORKOS_API_KEY=
WORKOS_COOKIE_PASSWORD=
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback`}
              </pre>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                Current Scope
              </p>
              <p className="mt-3 text-sm leading-7 text-stone-300">
                After auth is configured, the page will let a signed-in user
                create a workspace, create a tenant, and enqueue a stub
                provisioning job row in Postgres.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const auth = await withAuth();

  if (!auth.user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#efe4c7_0%,#e9dcc0_24%,#d4c3a0_52%,#8a6a42_100%)] px-6 py-10 text-stone-950">
        <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 border border-stone-300/60 bg-stone-50/90 p-8 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_24px_80px_rgba(50,40,22,0.18)] lg:grid-cols-[1.25fr_0.75fr] lg:p-12">
          <section className="flex flex-col justify-between gap-10">
            <div className="space-y-5">
              <p className="text-xs font-medium uppercase tracking-[0.35em] text-stone-500">
                Otto Control Plane
              </p>
              <h1 className="max-w-3xl text-4xl leading-tight font-semibold sm:text-6xl">
                Stand up one tenant, one VPS, one durable control plane.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
                This first slice only does the narrow thing: authenticate,
                create a workspace, create a tenant, and queue provisioning
                work. The infrastructure execution still comes later.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                className="inline-flex h-11 items-center justify-center border border-stone-950 bg-stone-950 px-5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-800"
                href="/auth/sign-up"
              >
                Create account
              </a>
              <a
                className="inline-flex h-11 items-center justify-center border border-stone-400 bg-stone-100 px-5 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-200"
                href="/auth/sign-in"
              >
                Sign in
              </a>
            </div>
          </section>

          <aside className="grid gap-4 border border-stone-300 bg-white/70 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                This increment proves
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-stone-700">
                <li>Authenticated user identity via WorkOS.</li>
                <li>Workspace ownership in Postgres.</li>
                <li>Tenant creation without inline provisioning.</li>
                <li>Queued job state before Hetzner execution exists.</li>
              </ul>
            </div>
            <div className="border-t border-stone-200 pt-4">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                Not in scope yet
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-700">
                No server creation, no Slack, no SSH, and no runtime apply in
                this step.
              </p>
            </div>
          </aside>
        </main>
      </div>
    );
  }

  const organizations = await getDashboardOrganizations(auth.user.id);

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#efe6d0_0%,#ddd1b2_32%,#b39263_100%)] px-6 py-10 text-stone-950">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 border border-stone-300/70 bg-stone-50/90 p-8 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_24px_80px_rgba(50,40,22,0.15)] lg:p-12">
        <section className="flex flex-col gap-6 border-b border-stone-300 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-stone-500">
              Otto Control Plane
            </p>
            <div className="space-y-2">
              <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">
                {organizations.length === 0
                  ? "Create your first workspace and tenant."
                  : "Tenant control starts here."}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-stone-600">
                Signed in as{" "}
                <span className="font-medium">{auth.user.email}</span>. This
                page only creates durable control-plane state and queues
                provisioning work.
              </p>
            </div>
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="lg">
              Sign out
            </Button>
          </form>
        </section>

        {organizations.length === 0 ? (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4 border border-stone-300 bg-white/70 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                First slice
              </p>
              <p className="text-sm leading-7 text-stone-700">
                This action creates a WorkOS workspace, mirrors it into
                Postgres, creates the first tenant, writes the initial desired
                state, and queues one provisioning job row.
              </p>
            </div>

            <form
              action={createWorkspaceAction}
              className="grid gap-4 border border-stone-300 bg-stone-950 p-6 text-stone-50"
            >
              <div className="grid gap-2">
                <label
                  className="text-xs uppercase tracking-[0.3em] text-stone-400"
                  htmlFor="workspaceName"
                >
                  Workspace name
                </label>
                <input
                  id="workspaceName"
                  name="workspaceName"
                  required
                  className="h-12 border border-stone-600 bg-stone-900 px-3 text-sm text-stone-50 outline-none transition-colors focus:border-stone-300"
                  placeholder="Northstar Labs"
                />
              </div>

              <div className="grid gap-2">
                <label
                  className="text-xs uppercase tracking-[0.3em] text-stone-400"
                  htmlFor="tenantName"
                >
                  First tenant
                </label>
                <input
                  id="tenantName"
                  name="tenantName"
                  required
                  className="h-12 border border-stone-600 bg-stone-900 px-3 text-sm text-stone-50 outline-none transition-colors focus:border-stone-300"
                  placeholder="northstar-prod"
                />
              </div>

              <Button type="submit" size="lg" className="mt-2">
                Create workspace and tenant
              </Button>
            </form>
          </section>
        ) : (
          <section className="grid gap-6">
            {organizations.map((organization) => (
              <article
                key={organization.id}
                className="grid gap-6 border border-stone-300 bg-white/75 p-6"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                      Workspace
                    </p>
                    <h2 className="text-2xl font-semibold text-stone-950">
                      {organization.name}
                    </h2>
                    <p className="text-sm text-stone-600">
                      Role: {organization.role}
                    </p>
                  </div>

                  <form
                    action={createTenantAction}
                    className="grid gap-3 lg:min-w-[24rem]"
                  >
                    <input
                      type="hidden"
                      name="organizationId"
                      value={organization.id}
                    />
                    <label
                      className="text-xs uppercase tracking-[0.3em] text-stone-500"
                      htmlFor={`tenant-${organization.id}`}
                    >
                      New tenant
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        id={`tenant-${organization.id}`}
                        name="tenantName"
                        required
                        className="h-11 flex-1 border border-stone-300 bg-stone-50 px-3 text-sm text-stone-950 outline-none transition-colors focus:border-stone-950"
                        placeholder="tenant-name"
                      />
                      <Button type="submit">Create tenant</Button>
                    </div>
                  </form>
                </div>

                <div className="grid gap-3">
                  {organization.tenants.length === 0 ? (
                    <p className="border border-dashed border-stone-300 bg-stone-100/80 p-4 text-sm text-stone-600">
                      No tenants yet for this workspace.
                    </p>
                  ) : (
                    organization.tenants.map((tenant) => (
                      <div
                        key={tenant.id}
                        className="grid gap-3 border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[1.2fr_0.8fr_0.8fr]"
                      >
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                            Tenant
                          </p>
                          <p className="mt-1 text-lg font-medium text-stone-950">
                            {tenant.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                            Tenant status
                          </p>
                          <p className="mt-1 text-sm text-stone-700">
                            {tenant.status}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                            Server
                          </p>
                          <p className="mt-1 text-sm text-stone-700">
                            {tenant.serverStatus ?? "not created yet"}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
