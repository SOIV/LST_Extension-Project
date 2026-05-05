import { NextRequest } from "next/server";
import { checkR2Connection } from "@/lib/r2";

type CheckResult = {
  status: "pass" | "fail";
  httpStatus: number | null;
  latencyMs: number;
  target: string;
  note?: string;
};

type CheckSpec = {
  name: string;
  path: string;
  method?: "GET" | "HEAD" | "OPTIONS";
  expected: (status: number) => boolean;
  note?: string;
};

const CHECKS: CheckSpec[] = [
  {
    name: "web_root",
    path: "/",
    method: "GET",
    expected: (status) => status >= 200 && status < 400,
  },
  {
    name: "subtitles_api_cors",
    path: "/api/subtitles",
    method: "OPTIONS",
    expected: (status) => status === 204,
    note: "Public subtitle API preflight check",
  },
];

const CHECK_NAMES = CHECKS.map((check) => check.name) as ReadonlyArray<string>;
type StatusTarget = "all" | "db" | "storage" | (typeof CHECK_NAMES)[number];

async function runCheck(origin: string, spec: CheckSpec): Promise<CheckResult> {
  const target = `${origin}${spec.path}`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(target, {
      method: spec.method ?? "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const passed = spec.expected(res.status);

    return {
      status: passed ? "pass" : "fail",
      httpStatus: res.status,
      latencyMs,
      target,
      note: spec.note,
    };
  } catch {
    return {
      status: "fail",
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      target,
      note: spec.note,
    };
  } finally {
    clearTimeout(timeout);
  }
}

type InfraResult = {
  status: "pass" | "fail";
  httpStatus?: number | null;
  latencyMs: number;
  note?: string;
  error?: string;
};

async function runDbCheck(): Promise<InfraResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const startedAt = Date.now();

  if (!url || !anonKey) {
    return {
      status: "fail",
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      note: "Supabase environment variables are missing",
      error: "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    // DB status endpoint is used as a connectivity probe.
    // 4xx often means auth/policy mismatch but service is reachable.
    const reachable = res.status >= 200 && res.status < 500;

    return {
      status: reachable ? "pass" : "fail",
      httpStatus: res.status,
      latencyMs: Date.now() - startedAt,
      note: "Supabase REST connectivity probe",
      error: reachable ? undefined : `HTTP ${res.status}`,
    };
  } catch {
    return {
      status: "fail",
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      note: "Supabase REST connectivity probe",
      error: "Network or timeout error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runStorageCheck(): Promise<InfraResult> {
  const startedAt = Date.now();

  try {
    await checkR2Connection();
    return {
      status: "pass",
      httpStatus: 200,
      latencyMs: Date.now() - startedAt,
      note: "R2 ListObjectsV2 health probe",
    };
  } catch (error) {
    return {
      status: "fail",
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      note: "R2 ListObjectsV2 health probe",
      error: error instanceof Error ? error.message : "Unknown storage error",
    };
  }
}

function parseTarget(value: string | null): StatusTarget | null {
  if (!value || value === "all") return "all";
  if (value === "db" || value === "storage") return value;
  if (CHECK_NAMES.includes(value)) return value;
  return null;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const target = parseTarget(request.nextUrl.searchParams.get("target"));

  if (!target) {
    return Response.json(
      {
        status: "fail",
        service: "lst-platform",
        checkedAt: new Date().toISOString(),
        error: "Invalid target",
        allowedTargets: ["all", ...CHECK_NAMES, "db", "storage"],
      },
      { status: 400 }
    );
  }

  if (target === "db") {
    const db = await runDbCheck();
    return Response.json(
      {
        status: db.status,
        service: "lst-platform",
        checkedAt: new Date().toISOString(),
        target,
        infra: { db },
      },
      { status: db.status === "pass" ? 200 : 503 }
    );
  }

  if (target === "storage") {
    const storage = await runStorageCheck();
    return Response.json(
      {
        status: storage.status,
        service: "lst-platform",
        checkedAt: new Date().toISOString(),
        target,
        infra: { storage },
      },
      { status: storage.status === "pass" ? 200 : 503 }
    );
  }

  if (target !== "all") {
    const spec = CHECKS.find((check) => check.name === target);
    if (!spec) {
      return Response.json(
        {
          status: "fail",
          service: "lst-platform",
          checkedAt: new Date().toISOString(),
          error: "Target check not found",
        },
        { status: 400 }
      );
    }
    const check = await runCheck(origin, spec);
    return Response.json(
      {
        status: check.status,
        service: "lst-platform",
        checkedAt: new Date().toISOString(),
        target,
        checks: { [target]: check },
      },
      { status: check.status === "pass" ? 200 : 503 }
    );
  }

  const [results, db, storage] = await Promise.all([
    Promise.all(
      CHECKS.map(async (spec) => [spec.name, await runCheck(origin, spec)] as const)
    ),
    runDbCheck(),
    runStorageCheck(),
  ]);

  const checks = Object.fromEntries(results) as Record<string, CheckResult>;
  const hasHttpFailure = Object.values(checks).some((check) => check.status === "fail");
  const hasInfraFailure = db.status === "fail" || storage.status === "fail";
  const hasFailure = hasHttpFailure || hasInfraFailure;

  const body = {
    status: hasFailure ? "fail" : "pass",
    service: "lst-platform",
    checkedAt: new Date().toISOString(),
    checks,
    infra: {
      db,
      storage,
    },
  };

  return Response.json(body, { status: hasFailure ? 503 : 200 });
}

export async function HEAD(request: NextRequest) {
  const result = await GET(request);
  return new Response(null, { status: result.status });
}
