"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useNotifications } from "@/provider/notifications";
import { useEffect } from "react";

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
  const { addNotification } = useNotifications();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    mode: "onBlur",
  });

  useEffect(() => {
    if (form.formState.errors.question?.message) {
      addNotification({
        message: form.formState.errors.question.message,
        type: "error",
      });
      console.log(form.formState.errors.question);
    }
  }, [form.formState.errors.question?.message]);

  function onSubmit(data: z.infer<typeof FormSchema>) {
    addNotification({ message: "Analyzing", type: "loading" });
    toast("You submitted the following values", {
      description: (
        <pre className="mt-2 rounded-md bg-neutral-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative w-full">
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormMessage className="text-center" />
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
