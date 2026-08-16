import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Security & Authentication", () => {
  const app = createApp();

  it("blocks unauthenticated admin requests", async () => {
    const res = await request(app)
      .put("/api/admin/style-profile")
      .send({ subdomain: "test", companyName: "Test" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("permits authenticated admin request with valid secret header", async () => {
    const res = await request(app)
      .put("/api/admin/style-profile")
      .set("x-admin-secret", env.ZENDESK_CLIENT_SECRET)
      .send({
        subdomain: "testco",
        companyName: "Test Company"
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.companyName).toBe("Test Company");
  });
});
