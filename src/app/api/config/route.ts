import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateConfig, updateConfigSection, resetConfig, resetConfigSection, GovBotConfig } from "@/lib/config";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  const config = getConfig();
  if (section && section in config) {
    return NextResponse.json({ [section]: config[section as keyof GovBotConfig] });
  }
  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { section, data, reset } = body as {
      section?: keyof GovBotConfig;
      data?: Partial<GovBotConfig>;
      reset?: boolean | keyof GovBotConfig;
    };

    if (reset === true) {
      return NextResponse.json(resetConfig());
    }
    if (typeof reset === "string") {
      return NextResponse.json(resetConfigSection(reset));
    }

    if (section && data) {
      const updated = updateConfigSection(section, data as never);
      return NextResponse.json(updated);
    }

    if (data) {
      const updated = updateConfig(data);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Provide 'data' to update or 'reset' to reset" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
