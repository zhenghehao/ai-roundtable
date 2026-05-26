import { NextResponse } from "next/server";
import { callModel, toFriendlyError } from "@/lib/model-adapters";
import { ModelAdapterError } from "@/lib/model-adapters/errors";
import type { ModelInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as ModelInput;
    const response = await callModel(input);
    return NextResponse.json(response);
  } catch (error) {
    const friendlyMessage = toFriendlyError(error);
    const status = error instanceof ModelAdapterError && error.status ? error.status : 500;

    return NextResponse.json(
      {
        friendlyMessage,
        message: error instanceof Error ? error.message : friendlyMessage,
        status
      },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
