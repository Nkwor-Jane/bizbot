import { NextRequest, NextResponse } from "next/server";
import { ChatService } from "@/features/chat/services";

export async function POST(request: NextRequest) {
  const body: ChatPost = await request.json();
  const data = await ChatService.getChat.server({ ...body });
  return NextResponse.json(data);
}
