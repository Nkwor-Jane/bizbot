import { NextRequest, NextResponse } from "next/server";
import { ChatService } from "@/features/chat/services";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message } = body;

  const data = await ChatService.getChat.server({ message });

  return NextResponse.json(data);
}
