import { pool } from "./pool.js";

export interface StyleProfileRecord {
  subdomain: string;
  companyName: string;
  preferredTone: string;
  formality: "casual" | "neutral" | "formal";
  verbosity: "short" | "medium" | "long";
  useEmojis: boolean;
  useCustomerName: boolean;
  preferredGreeting: string;
  preferredClosing: string;
}

export async function getStyleProfile(subdomain: string): Promise<StyleProfileRecord | null> {
  const query = `
    SELECT subdomain, company_name, preferred_tone, formality, verbosity,
           use_emojis, use_customer_name, preferred_greeting, preferred_closing
    FROM style_profiles
    WHERE subdomain = $1;
  `;
  const res = await pool.query(query, [subdomain]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    subdomain: r.subdomain,
    companyName: r.company_name,
    preferredTone: r.preferred_tone,
    formality: r.formality,
    verbosity: r.verbosity,
    useEmojis: r.use_emojis,
    useCustomerName: r.use_customer_name,
    preferredGreeting: r.preferred_greeting,
    preferredClosing: r.preferred_closing
  };
}

export async function upsertStyleProfile(profile: StyleProfileRecord): Promise<void> {
  const query = `
    INSERT INTO style_profiles (
      subdomain, company_name, preferred_tone, formality, verbosity,
      use_emojis, use_customer_name, preferred_greeting, preferred_closing, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (subdomain) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      preferred_tone = EXCLUDED.preferred_tone,
      formality = EXCLUDED.formality,
      verbosity = EXCLUDED.verbosity,
      use_emojis = EXCLUDED.use_emojis,
      use_customer_name = EXCLUDED.use_customer_name,
      preferred_greeting = EXCLUDED.preferred_greeting,
      preferred_closing = EXCLUDED.preferred_closing,
      updated_at = NOW();
  `;
  await pool.query(query, [
    profile.subdomain,
    profile.companyName,
    profile.preferredTone,
    profile.formality,
    profile.verbosity,
    profile.useEmojis,
    profile.useCustomerName,
    profile.preferredGreeting,
    profile.preferredClosing
  ]);
}
