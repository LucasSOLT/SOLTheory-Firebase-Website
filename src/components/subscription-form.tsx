"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { subscribeUser } from "@/app/actions";
import { ArrowRight } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
});

export function SubscriptionForm() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  // Auto-hide success message after 6.5 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 6500);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // Auto-hide error message after 6.5 seconds
  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => setShowError(null), 6500);
      return () => clearTimeout(timer);
    }
  }, [showError]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const result = await subscribeUser(values);
    if (result.success) {
      setShowSuccess(true);
      setShowError(null);
      form.reset();
    } else {
      setShowError(result.error || "There was a problem with your request.");
      setShowSuccess(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    className="h-14 pl-4 pr-32 text-base bg-background/50"
                    {...field}
                  />
                  <Button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 group"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? "Joining..." : "Join Now"}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Inline success notification */}
        <div
          className={`text-center transition-all duration-500 ease-out overflow-hidden ${
            showSuccess ? "opacity-100 max-h-16 mt-2" : "opacity-0 max-h-0 mt-0"
          }`}
        >
          <p className="text-sm font-semibold text-emerald-400 tracking-wide">
            Subscribed! We&apos;ll be in touch.
          </p>
        </div>

        {/* Inline error notification */}
        <div
          className={`text-center transition-all duration-500 ease-out overflow-hidden ${
            showError ? "opacity-100 max-h-16 mt-2" : "opacity-0 max-h-0 mt-0"
          }`}
        >
          <p className="text-sm font-semibold text-red-400 tracking-wide">
            {showError}
          </p>
        </div>
      </form>
    </Form>
  );
}
