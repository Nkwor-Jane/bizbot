"use client";

import { useForm } from "react-hook-form";
import { Send } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useNotifications } from "@/provider/notifications";

import { useChat } from "../context";
import { usePostChat } from "../hook/queries";

const FormSchema = z.object({
  question: z
    .string("Bio is required.")
    .min(10, {
      message: "Question must be at least 10 characters.",
    })
    .max(160, {
      message: "Question must not be longer than 30 characters.",
    }),
});
// fd8f8231-2421-47c6-8772-e638d8fc4847
export default function Chatbox() {
  const {
    addChatMessage,
    state: { currentSessionId },
    addNewSessionId,
  } = useChat();
  const { mutateAsync: postChat, isPending } = usePostChat();
  const { addNotification, removeNotification } = useNotifications();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { question: "" },
    mode: "onSubmit",
  });

  // If there is an error, show it as a notification
  useEffect(() => {
    if (form.formState.errors.question?.message) {
      addNotification({
        message: form.formState.errors.question.message,
        type: "error",
      });
    } else {
      removeNotification();
    }
  }, [form.formState.errors.question?.message]);

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    // Add User's message to the chat context
    addChatMessage({ text: data.question, sender: "user" });

    try {
      const requestData: ChatPost = { message: data.question };
      if (currentSessionId) requestData.session_id = currentSessionId;

      const { response, session_id, sources } = await postChat(requestData);

      form.reset();

      // Add AI's message to the chat context
      addChatMessage({ text: response, sender: "ai", sources });

      // If we got a session_id back and we don't have a current session,
      // this means it's a new chat, so save the session_id
      if (session_id && !currentSessionId) await addNewSessionId(session_id);

      // console.log("Post Chat Response: ", { response, session_id, sources });
    } catch (error) {
      console.error("Error in chat submission:", error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative w-full">
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Question</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Ask anything"
                  className="resize-non no-scrollbar max-h-80 pr-8"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size={"icon"}
          disabled={isPending}
          className="absolute right-3 bottom-3 size-10"
        >
          <Send />
        </Button>
      </form>
    </Form>
  );
}
