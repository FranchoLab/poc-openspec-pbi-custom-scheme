import { readFile } from "node:fs/promises";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { requiredPbiFields } from "../src/pbi-fields.js";

const formSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    title: z.string(),
    labels: z.array(z.string()),
    body: z.array(
      z.object({
        type: z.string(),
        id: z.string().optional(),
        attributes: z.object({ label: z.string().optional() }).passthrough(),
        validations: z.object({ required: z.boolean().optional() }).optional(),
      }),
    ),
  })
  .strict();

describe("PBI issue template", () => {
  it("requires every field consumed by preflight", async () => {
    const source = await readFile(
      new URL("../../../.github/ISSUE_TEMPLATE/pbi.yml", import.meta.url),
      "utf8",
    );
    const form = formSchema.parse(parse(source));
    const fields = form.body.filter((item) => item.type === "textarea");

    expect(form.labels).toContain("pbi/refinement");
    expect(
      fields.map((field) => ({
        id: field.id,
        heading: field.attributes.label,
        required: field.validations?.required,
      })),
    ).toEqual(
      requiredPbiFields.map((field) => ({ ...field, required: true })),
    );
  });

  it("provides a rendered fixture with all required English headings", async () => {
    const body = await readFile(
      new URL("./fixtures/pbi/valid.md", import.meta.url),
      "utf8",
    );

    for (const field of requiredPbiFields) {
      expect(body).toContain(`## ${field.heading}`);
    }
    expect(body).toMatch(/As a .+,\nI want .+,\nso that .+\./u);
  });
});