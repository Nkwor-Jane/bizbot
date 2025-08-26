import { NextRequest, NextResponse } from "next/server";

import { ChatService } from "@/features/chat/services";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ session_id: string }> },
) {
  const { session_id } = await params;
  if (!session_id) {
    return NextResponse.json(
      { message: "Product ID is required as a query parameter" },
      { status: 400 },
    );
  }
  const { data } = await ChatService.getChatHistory.server(session_id);
  return data;
}
