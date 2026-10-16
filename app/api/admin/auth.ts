import { cookies } from "next/headers";
import { createHmac } from "crypto";

const COOKIE_NAME = "admin_session";

function sign(value: string): string {
  const secret = process.env.ADMIN_PASSWORD || "";
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = sign("admin");
  return token === expected;
}

export function makeAdminToken(): string {
  return sign("admin");
}

export { COOKIE_NAME };
