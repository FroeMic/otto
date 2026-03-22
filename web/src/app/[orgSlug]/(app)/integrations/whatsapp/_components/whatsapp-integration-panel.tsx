"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getWhatsAppUiPhase } from "@/lib/workspace";
import { deriveWhatsAppPolicyEffects } from "@/tools/whatsapp/policy";

type WhatsAppRuntimeConfig = {
  ackReactionEnabled: boolean;
  allowedGroupIds: string[];
  allowedNumbers: string[];
  dmPolicy: "pairing" | "allowlist" | "disabled";
  enabled: boolean;
  entryVersion: number;
  groupAllowedNumbers: string[];
  groupPolicy: "disabled" | "allowlist";
  installState: "installed" | "uninstalled";
  requireMentionInGroups: boolean;
  schemaVersion: string;
};

type WhatsAppRuntimeConfigSurface = {
  config: WhatsAppRuntimeConfig;
  derivedEffects?: {
    warnings?: string[];
    wouldFullyLockOutWhatsApp?: boolean;
  };
  description: string;
  key: string;
  kind: string;
  label: string;
};

type WhatsAppLinkSession = {
  completedAt: string | Date | null;
  createdAt: string | Date;
  expiresAt: string | Date | null;
  forceRelink: boolean;
  id: string;
  lastError: string | null;
  qrDataUrl: string | null;
  status: string;
  updatedAt: string | Date;
};

type WhatsAppIntegrationSummary = {
  connectedAt: string | Date | null;
  lastError: string | null;
  lastErrorAt: string | Date | null;
  selfE164: string | null;
  status: string;
} | null;

type Props = {
  initialIntegration: WhatsAppIntegrationSummary;
  initialLinkSession: WhatsAppLinkSession | null;
  initialSurface: WhatsAppRuntimeConfigSurface | null;
  orgSlug: string;
  runtimeApplyIsActive: boolean;
};

function joinList(values: string[]) {
  return values.join("\n");
}

function parseListInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatExpiresIn(
  expiresAt: string | Date | null,
  currentTimestamp: number,
) {
  if (!expiresAt) {
    return null;
  }

  const expiresAtDate = new Date(expiresAt);
  const remainingMs = expiresAtDate.getTime() - currentTimestamp;

  if (Number.isNaN(expiresAtDate.getTime()) || remainingMs <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function requestBody(config: WhatsAppRuntimeConfig) {
  return {
    ackReactionEnabled: config.ackReactionEnabled,
    allowedGroupIds: config.allowedGroupIds,
    allowedNumbers: config.allowedNumbers,
    dmPolicy: config.dmPolicy,
    groupAllowedNumbers: config.groupAllowedNumbers,
    groupPolicy: config.groupPolicy,
    requireMentionInGroups: config.requireMentionInGroups,
  };
}

function CompactList(props: { emptyLabel: string; items: string[] }) {
  if (props.items.length === 0) {
    return <p className="text-xs text-muted-foreground">{props.emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {props.items.map((item) => (
        <Badge key={item} variant="outline">
          {item}
        </Badge>
      ))}
    </div>
  );
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function WhatsAppIntegrationPanel(props: Props) {
  const { initialIntegration, initialLinkSession, initialSurface, orgSlug } =
    props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [prepConfirmed, setPrepConfirmed] = useState(false);
  const [integration, setIntegration] =
    useState<WhatsAppIntegrationSummary>(initialIntegration);
  const [surface, setSurface] = useState<WhatsAppRuntimeConfigSurface | null>(
    initialSurface,
  );
  const [linkSession, setLinkSession] = useState<WhatsAppLinkSession | null>(
    initialLinkSession,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [draftConfig, setDraftConfig] = useState<WhatsAppRuntimeConfig | null>(
    initialSurface?.config ?? null,
  );
  const [allowedNumbersInput, setAllowedNumbersInput] = useState(
    joinList(initialSurface?.config.allowedNumbers ?? []),
  );
  const [allowedGroupIdsInput, setAllowedGroupIdsInput] = useState(
    joinList(initialSurface?.config.allowedGroupIds ?? []),
  );
  const [groupAllowedNumbersInput, setGroupAllowedNumbersInput] = useState(
    joinList(initialSurface?.config.groupAllowedNumbers ?? []),
  );

  useEffect(() => {
    setIntegration(initialIntegration);
  }, [initialIntegration]);

  useEffect(() => {
    setSurface(initialSurface);
    setDraftConfig(initialSurface?.config ?? null);
    setAllowedNumbersInput(
      joinList(initialSurface?.config.allowedNumbers ?? []),
    );
    setAllowedGroupIdsInput(
      joinList(initialSurface?.config.allowedGroupIds ?? []),
    );
    setGroupAllowedNumbersInput(
      joinList(initialSurface?.config.groupAllowedNumbers ?? []),
    );
  }, [initialSurface]);

  useEffect(() => {
    setLinkSession(initialLinkSession);
  }, [initialLinkSession]);

  useEffect(() => {
    if (!linkSession) {
      return;
    }

    if (
      linkSession.status !== "queued" &&
      linkSession.status !== "starting" &&
      linkSession.status !== "qr_ready"
    ) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(
        `/api/integrations/${orgSlug}/whatsapp/link-sessions/current`,
        {
          cache: "no-store",
          method: "GET",
        },
      );
      const data = await readJson(response);

      if (!response.ok) {
        return;
      }

      const nextLinkSession =
        (data?.linkSession as WhatsAppLinkSession | null | undefined) ?? null;
      setLinkSession(nextLinkSession);

      if (
        nextLinkSession?.status === "connected" ||
        nextLinkSession?.status === "failed"
      ) {
        router.refresh();
      }
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [linkSession, orgSlug, router]);

  useEffect(() => {
    if (linkSession?.status !== "qr_ready") {
      setCurrentTimestamp(Date.now());
      return;
    }

    setCurrentTimestamp(Date.now());

    const intervalId = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [linkSession?.status]);

  const currentConfig = useMemo(() => {
    if (!draftConfig) {
      return null;
    }

    return {
      ...draftConfig,
      allowedGroupIds: parseListInput(allowedGroupIdsInput),
      allowedNumbers: parseListInput(allowedNumbersInput),
      groupAllowedNumbers: parseListInput(groupAllowedNumbersInput),
    };
  }, [
    allowedGroupIdsInput,
    allowedNumbersInput,
    draftConfig,
    groupAllowedNumbersInput,
  ]);

  const derivedEffects = useMemo(() => {
    if (!currentConfig || !surface) {
      return null;
    }

    return deriveWhatsAppPolicyEffects({
      config: requestBody(currentConfig),
      currentConfig: surface.config,
    });
  }, [currentConfig, surface]);

  const hasUnsavedChanges = useMemo(() => {
    if (!currentConfig || !surface) {
      return false;
    }

    return (
      JSON.stringify(requestBody(currentConfig)) !==
      JSON.stringify(requestBody(surface.config))
    );
  }, [currentConfig, surface]);

  const qrExpiresIn = useMemo(
    () => formatExpiresIn(linkSession?.expiresAt ?? null, currentTimestamp),
    [currentTimestamp, linkSession?.expiresAt],
  );
  const isWhatsAppInstalled = surface?.config.installState === "installed";
  const uiPhase = useMemo(
    () =>
      getWhatsAppUiPhase({
        integrationStatus: integration?.status ?? null,
        linkSessionStatus: linkSession?.status ?? null,
      }),
    [integration?.status, linkSession?.status],
  );
  const linkedNumber =
    integration?.selfE164 ?? "your dedicated WhatsApp number";

  async function runAction<T>(operation: () => Promise<T>) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      return await operation();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "WhatsApp request failed";
      setErrorMessage(message);
      return null;
    }
  }

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(
        typeof data?.message === "string" ? data.message : "Request failed",
      );
    }

    return data;
  }

  async function patchJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(
        typeof data?.message === "string" ? data.message : "Request failed",
      );
    }

    return data;
  }

  function handleGenerateQr(forceRelink: boolean) {
    startTransition(() => {
      void runAction(async () => {
        const data = await postJson(
          `/api/integrations/${orgSlug}/whatsapp/link-sessions`,
          {
            forceRelink,
          },
        );
        setLinkSession(
          (data?.linkSession as WhatsAppLinkSession | null | undefined) ?? null,
        );
        setSuccessMessage(
          forceRelink
            ? "A new WhatsApp QR session has started."
            : "WhatsApp QR generation started. Otto will activate WhatsApp in the tenant runtime after pairing succeeds.",
        );
        router.refresh();
      });
    });
  }

  function handleClearCurrentQr() {
    startTransition(() => {
      void runAction(async () => {
        const data = await postJson(
          `/api/integrations/${orgSlug}/whatsapp/link-sessions/clear`,
          {},
        );
        setLinkSession(
          (data?.linkSession as WhatsAppLinkSession | null | undefined) ?? null,
        );
        setSuccessMessage("The current WhatsApp QR session has been cleared.");
        router.refresh();
      });
    });
  }

  function handleSaveConfig() {
    if (!currentConfig || !surface) {
      return;
    }

    if (
      derivedEffects?.wouldFullyLockOutWhatsApp &&
      !window.confirm(
        "This change would fully lock Otto out of WhatsApp. Do you want to save it anyway?",
      )
    ) {
      return;
    }

    startTransition(() => {
      void runAction(async () => {
        const data = await patchJson(
          `/api/runtime-config/${orgSlug}/surfaces/channel/whatsapp`,
          {
            allowDestructiveChanges: Boolean(
              derivedEffects?.wouldFullyLockOutWhatsApp,
            ),
            expectedEntryVersion: surface.config.entryVersion,
            patch: requestBody(currentConfig),
            summary: "Updated WhatsApp settings",
          },
        );
        const nextSurface =
          (data?.surface as WhatsAppRuntimeConfigSurface | null | undefined) ??
          null;
        setSurface(nextSurface);
        setDraftConfig(nextSurface?.config ?? null);
        setSuccessMessage("WhatsApp settings saved.");
        router.refresh();
      });
    });
  }

  function handleReapply() {
    startTransition(() => {
      void runAction(async () => {
        await postJson(
          `/api/runtime-config/${orgSlug}/surfaces/channel/whatsapp/reapply`,
          {
            summary: "Reapplied WhatsApp settings",
          },
        );
        setSuccessMessage("Otto is reapplying WhatsApp settings.");
        router.refresh();
      });
    });
  }

  function handleDisconnect() {
    if (
      !window.confirm(
        "Disconnect the current WhatsApp number from Otto? Saved settings will stay in place.",
      )
    ) {
      return;
    }

    startTransition(() => {
      void runAction(async () => {
        await postJson(`/api/integrations/${orgSlug}/whatsapp/disconnect`, {});
        setSuccessMessage("WhatsApp disconnect has been queued.");
        router.refresh();
      });
    });
  }

  function handleDisable() {
    if (
      !window.confirm(
        "Disable WhatsApp for Otto? This removes the WhatsApp channel from the tenant runtime and clears saved WhatsApp auth on the tenant server.",
      )
    ) {
      return;
    }

    startTransition(() => {
      void runAction(async () => {
        const data = await postJson(
          `/api/integrations/${orgSlug}/whatsapp/disable`,
          {},
        );
        setLinkSession(
          (data?.linkSession as WhatsAppLinkSession | null | undefined) ?? null,
        );
        setSurface(
          (data?.surface as WhatsAppRuntimeConfigSurface | null | undefined) ??
            null,
        );
        setDraftConfig(
          ((data?.surface as WhatsAppRuntimeConfigSurface | null | undefined)
            ?.config as WhatsAppRuntimeConfig | undefined) ?? null,
        );
        setSuccessMessage(
          "WhatsApp disable has been queued. Otto will remove the runtime config and clear the saved WhatsApp session.",
        );
        router.refresh();
      });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {uiPhase === "prepare" ? (
        <Card>
          <CardHeader>
            <CardTitle>Prepare dedicated number</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <Alert>
              <AlertTitle>Use a new dedicated number</AlertTitle>
              <AlertDescription>
                Reusing a personal number is out of scope for this version and
                can cause account or routing confusion.
              </AlertDescription>
            </Alert>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-foreground">
              <li>
                Buy a new phone number. Use a dedicated number for Otto. A
                separate eSIM on an iPhone is fine.
              </li>
              <li>
                Activate the number on your phone and confirm it can receive SMS
                or phone calls.
              </li>
              <li>
                Install WhatsApp Business from the App Store. Use WhatsApp
                Business, not the regular WhatsApp app, for Otto&apos;s
                dedicated number.
              </li>
              <li>
                Register the new number in WhatsApp Business and complete SMS or
                call verification.
              </li>
              <li>
                Finish basic app setup with a simple business name like Otto.
                You do not need catalog or marketing setup.
              </li>
              <li>
                Return here and tap Pair now. In WhatsApp Business on your
                iPhone, open Settings &gt; Linked Devices &gt; Link a Device,
                then scan the QR code from your workspace.
              </li>
            </ol>
            <div className="flex items-start gap-3 rounded-none border p-3">
              <Checkbox
                checked={prepConfirmed}
                id="whatsapp-prep-confirmed"
                onCheckedChange={(checked) =>
                  setPrepConfirmed(Boolean(checked))
                }
              />
              <label
                className="text-sm leading-6 text-foreground"
                htmlFor="whatsapp-prep-confirmed"
              >
                I have activated a dedicated number in WhatsApp Business and
                understand Otto v1 does not support personal-number mode.
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={
                  isPending ||
                  !prepConfirmed ||
                  props.runtimeApplyIsActive ||
                  integration?.status === "apply_failed"
                }
                onClick={() => handleGenerateQr(false)}
              >
                Pair now
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {uiPhase === "pairing" ? (
        <Card>
          <CardHeader>
            <CardTitle>Scan QR code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {linkSession?.status === "qr_ready" && linkSession.qrDataUrl ? (
              <div className="flex flex-col gap-4 rounded-none border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Scan this QR code in WhatsApp Business
                    </p>
                    <p className="text-sm text-muted-foreground">
                      On your iPhone, open WhatsApp Business &gt; Settings &gt;
                      Linked Devices &gt; Link a Device, then scan this QR code.
                    </p>
                  </div>
                  {qrExpiresIn ? (
                    <Badge variant="outline">Expires in {qrExpiresIn}</Badge>
                  ) : null}
                </div>
                <Image
                  alt="WhatsApp QR code"
                  className="w-full max-w-sm border bg-white p-4"
                  src={linkSession.qrDataUrl}
                  unoptimized
                  height={320}
                  width={320}
                />
                <p className="text-sm text-muted-foreground">
                  Keep WhatsApp Business open on your phone until linking
                  finishes.
                </p>
              </div>
            ) : (
              <Alert>
                <AlertTitle>Preparing QR code</AlertTitle>
                <AlertDescription>
                  Otto is starting a new WhatsApp pairing session.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={isPending}
                onClick={handleClearCurrentQr}
                variant="outline"
              >
                Clear current QR
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {uiPhase === "attention" ? (
        <Card>
          <CardHeader>
            <CardTitle>Pair WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertTitle>Linking failed</AlertTitle>
              <AlertDescription>
                {linkSession?.lastError ??
                  integration?.lastError ??
                  "WhatsApp pairing did not complete."}
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={isPending || props.runtimeApplyIsActive}
                onClick={() => handleGenerateQr(false)}
              >
                Pair now
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {uiPhase === "activating" || uiPhase === "connected" ? (
        <Card>
          <CardHeader>
            <CardTitle>Linked account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {uiPhase === "activating" ? (
              <Alert>
                <AlertTitle>Finishing setup</AlertTitle>
                <AlertDescription>
                  Otto linked {linkedNumber} and is now activating WhatsApp in
                  the tenant runtime.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTitle>WhatsApp connected</AlertTitle>
                <AlertDescription>
                  Otto is now linked to {linkedNumber}.
                </AlertDescription>
              </Alert>
            )}
            <div className="rounded-none border p-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">
                  Dedicated number
                </p>
                <p className="text-base font-medium text-foreground">
                  {linkedNumber}
                </p>
              </div>
            </div>
            {uiPhase === "connected" ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={isPending || props.runtimeApplyIsActive}
                  onClick={() => handleGenerateQr(true)}
                >
                  Reconnect
                </Button>
                <Button
                  disabled={isPending}
                  onClick={handleDisconnect}
                  variant="outline"
                >
                  Disconnect
                </Button>
                {integration && isWhatsAppInstalled ? (
                  <Button
                    disabled={isPending || props.runtimeApplyIsActive}
                    onClick={handleDisable}
                    variant="outline"
                  >
                    Disable WhatsApp
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {uiPhase === "activating" || uiPhase === "connected" ? (
        <Card>
          <CardHeader>
            <CardTitle>Policy settings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {!surface || !draftConfig || !currentConfig ? (
              <Alert>
                <AlertTitle>WhatsApp settings are not ready yet</AlertTitle>
                <AlertDescription>
                  Otto is still loading the saved WhatsApp policy for this
                  workspace.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Direct messages</FieldLabel>
                    <FieldContent>
                      <Select
                        disabled={props.runtimeApplyIsActive}
                        onValueChange={(value) =>
                          setDraftConfig({
                            ...draftConfig,
                            dmPolicy:
                              value as WhatsAppRuntimeConfig["dmPolicy"],
                          })
                        }
                        value={draftConfig.dmPolicy}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose DM access" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pairing">Pairing</SelectItem>
                          <SelectItem value="allowlist">Allowlist</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Pairing lets Otto learn new direct-message contacts.
                        Allowlist only permits the numbers below.
                      </FieldDescription>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel>Allowed numbers</FieldLabel>
                    <FieldContent>
                      <Textarea
                        disabled={props.runtimeApplyIsActive}
                        onChange={(event) =>
                          setAllowedNumbersInput(event.target.value)
                        }
                        placeholder="+43123456789"
                        rows={4}
                        value={allowedNumbersInput}
                      />
                      <FieldDescription>
                        Enter one E.164 phone number per line.
                      </FieldDescription>
                      <CompactList
                        emptyLabel="No direct-message allowlist saved."
                        items={currentConfig.allowedNumbers}
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel>Groups</FieldLabel>
                    <FieldContent>
                      <Select
                        disabled={props.runtimeApplyIsActive}
                        onValueChange={(value) =>
                          setDraftConfig({
                            ...draftConfig,
                            groupPolicy:
                              value as WhatsAppRuntimeConfig["groupPolicy"],
                          })
                        }
                        value={draftConfig.groupPolicy}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose group access" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disabled">Disabled</SelectItem>
                          <SelectItem value="allowlist">Allowlist</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Use WhatsApp group IDs ending in <code>@g.us</code>.
                        Group selection is manual in v1.
                      </FieldDescription>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel>Allowed group IDs</FieldLabel>
                    <FieldContent>
                      <Textarea
                        disabled={props.runtimeApplyIsActive}
                        onChange={(event) =>
                          setAllowedGroupIdsInput(event.target.value)
                        }
                        placeholder="1234567890@g.us"
                        rows={4}
                        value={allowedGroupIdsInput}
                      />
                      <CompactList
                        emptyLabel="No group allowlist saved."
                        items={currentConfig.allowedGroupIds}
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel>Allowed group sender numbers</FieldLabel>
                    <FieldContent>
                      <Textarea
                        disabled={props.runtimeApplyIsActive}
                        onChange={(event) =>
                          setGroupAllowedNumbersInput(event.target.value)
                        }
                        placeholder="+43123456789"
                        rows={4}
                        value={groupAllowedNumbersInput}
                      />
                      <FieldDescription>
                        Leave this empty to fall back to the global
                        allowed-number list.
                      </FieldDescription>
                      <CompactList
                        emptyLabel="Falling back to the direct-message allowlist."
                        items={currentConfig.groupAllowedNumbers}
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel>Require mention in groups</FieldLabel>
                    <FieldContent>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={draftConfig.requireMentionInGroups}
                          disabled={props.runtimeApplyIsActive}
                          onCheckedChange={(checked) =>
                            setDraftConfig({
                              ...draftConfig,
                              requireMentionInGroups: checked,
                            })
                          }
                        />
                        <FieldDescription>
                          When enabled, Otto only responds in allowlisted groups
                          after it is explicitly mentioned.
                        </FieldDescription>
                      </div>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel>Ack reaction</FieldLabel>
                    <FieldContent>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={draftConfig.ackReactionEnabled}
                          disabled={props.runtimeApplyIsActive}
                          onCheckedChange={(checked) =>
                            setDraftConfig({
                              ...draftConfig,
                              ackReactionEnabled: checked,
                            })
                          }
                        />
                        <FieldDescription>
                          Add Otto&apos;s fixed acknowledgement reaction when it
                          sees an eligible WhatsApp message.
                        </FieldDescription>
                      </div>
                    </FieldContent>
                  </Field>
                </FieldGroup>

                {derivedEffects?.warnings?.length ? (
                  <Alert
                    variant={
                      derivedEffects.wouldFullyLockOutWhatsApp
                        ? "destructive"
                        : "default"
                    }
                  >
                    <AlertTitle>Review these changes</AlertTitle>
                    <AlertDescription>
                      <div className="flex flex-col gap-2">
                        {derivedEffects.warnings.map((warning) => (
                          <p key={warning}>{warning}</p>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Separator />

                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={
                      isPending ||
                      props.runtimeApplyIsActive ||
                      !hasUnsavedChanges
                    }
                    onClick={handleSaveConfig}
                  >
                    Save settings
                  </Button>
                  <Button
                    disabled={
                      isPending || props.runtimeApplyIsActive || !surface
                    }
                    onClick={handleReapply}
                    variant="outline"
                  >
                    Reapply settings
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
