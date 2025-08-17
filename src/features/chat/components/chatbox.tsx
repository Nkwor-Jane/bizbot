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

const FormSchema = z.object({
  question: z
    .string("Bio is required.")
    .min(10, {
      message: "Bio must be at least 10 characters.",
    })
    .max(160, {
      message: "Bio must not be longer than 30 characters.",
    }),
});

export default function Chatbox() {
  const { addChatMessage } = useChat();
  const { addNotification, removeNotification } = useNotifications();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { question: "" },
    mode: "onBlur",
  });

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

  function onSubmit(data: z.infer<typeof FormSchema>) {
    // Simulate analzying notifcation
    addNotification({ message: "Analyzing", type: "loading" });
    setTimeout(removeNotification, 5000);

    // Add User's message to the chat context
    addChatMessage({ text: data.question, sender: "user" });
    setTimeout(
      () => addChatMessage({ text: data.question, sender: "ai" }),
      5000,
    );

    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative w-full">
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              {/* <FormMessage className="text-center" /> */}
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
          className="absolute right-3 bottom-3 size-10"
        >
          <Send />
        </Button>
      </form>
    </Form>
  );
}
