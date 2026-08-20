import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Helmet } from "react-helmet-async";
import { socialShareImageMetaNodes } from "@/components/seo/SocialShareImageMeta";
import { breadcrumbListNode, graphJsonLd, webPageNode } from "@/components/seo/jsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MOVIE_DRAFTER_PURPLE_SHELL } from "@/lib/pageGradients";
import { useState } from "react";

interface ContactFormData {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

const labelClass = "text-greyscale-blue-200";

const controlClass =
  "bg-greyscale-purp-800 border-greyscale-purp-600 text-greyscale-blue-100 placeholder:text-greyscale-purp-400 focus:border-greyscale-blue-100 focus:ring-0 focus:ring-offset-0";

const errorControlClass = "border-error-red-500";

const errorTextClass = "text-sm text-error-red-400 font-brockmann";

const categoryOptions = [
  { value: "general", label: "General Question" },
  { value: "bug-report", label: "Bug Report" },
  { value: "feature-request", label: "Feature Request" },
  { value: "account-issue", label: "Account Issue" },
  { value: "billing", label: "Billing" },
  { value: "other", label: "Other" },
];

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Contact', path: '/contact' },
  ];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormData>({
    defaultValues: {
      category: "general",
    },
  });

  const category = watch("category");

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    
    try {
      // Format the subject to include category if not general
      const subjectPrefix = data.category !== "general" 
        ? `[${data.category.charAt(0).toUpperCase() + data.category.slice(1).replace("-", " ")}] ` 
        : "";
      const fullSubject = `${subjectPrefix}${data.subject}`;
      
      // Format the message to include name and category info
      const formattedMessage = `From: ${data.name} (${data.email})\n\n${data.message}`;
      const formattedHtml = `<p><strong>From:</strong> ${data.name} (${data.email})</p><p><strong>Category:</strong> ${data.category}</p><hr/><p>${data.message.replace(/\n/g, '<br/>')}</p>`;
      
      // Prepare payload matching Edge Function format
      const payload = {
        from: data.email,
        to: ['support@moviedrafter.com'],
        subject: fullSubject,
        text: formattedMessage,
        html: formattedHtml,
        created_at: new Date().toISOString(),
      };

      // Submit to Edge Function
      const { data: responseData, error } = await supabase.functions.invoke(
        'receive-support-email',
        {
          body: payload,
        }
      );

      if (error) {
        console.error('Error submitting contact form:', error);
        toast({
          title: "Error",
          description: "Failed to send your message. Please try again later.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Message sent!",
          description: "Thank you for contacting us. We'll get back to you soon.",
        });
        
        // Reset form
        setValue("name", "");
        setValue("email", "");
        setValue("category", "general");
        setValue("subject", "");
        setValue("message", "");
      }
    } catch (error) {
      console.error('Exception submitting contact form:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Movie Drafter - Contact Support</title>
        <meta name="description" content="Contact Movie Drafter support for help with your account, fantasy movie drafts, or any questions about our movie drafting game." />
        <link rel="canonical" href="https://moviedrafter.com/contact" />
        <meta property="og:title" content="Movie Drafter - Contact Support" />
        <meta property="og:description" content="Contact Movie Drafter support for help with your account, fantasy movie drafts, or any questions about our movie drafting game." />
        <meta property="og:url" content="https://moviedrafter.com/contact" />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content="Movie Drafter - Contact Support" />
        <meta name="twitter:description" content="Contact Movie Drafter support for help with your account, fantasy movie drafts, or any questions about our movie drafting game." />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              webPageNode({
                path: '/contact',
                name: 'Contact Movie Drafter support',
                description:
                  'Contact Movie Drafter support for help with your account, fantasy movie drafts, or any questions about our movie drafting game.',
                type: 'ContactPage',
              }),
              breadcrumbListNode(crumbs)
            )
          )}
        </script>
      </Helmet>

      <div className="min-h-screen w-full" style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-10">
          <Breadcrumbs items={crumbs} />

          <header className="flex flex-col gap-4">
            <h1 className="m-0 font-chaney text-3xl sm:text-5xl text-greyscale-blue-50 leading-tight">
              Contact Support
            </h1>
            <p className="m-0 text-greyscale-blue-100 font-brockmann text-base sm:text-lg leading-relaxed">
              Have a question or need help? Send us a message and we'll get back to you as soon as possible.
            </p>
          </header>

          <Card className="bg-greyscale-purp-850 border-greyscale-purp-700 text-greyscale-blue-100">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className={labelClass}>
                    Name <span className="text-error-red-400">*</span>
                  </Label>
                  <Input
                    id="name"
                    {...register("name", {
                      required: "Name is required",
                      minLength: {
                        value: 2,
                        message: "Name must be at least 2 characters",
                      },
                    })}
                    placeholder="Your name"
                    className={`${controlClass} ${errors.name ? errorControlClass : ""}`}
                  />
                  {errors.name && (
                    <p className={errorTextClass}>
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className={labelClass}>
                    Email <span className="text-error-red-400">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Please enter a valid email address",
                      },
                    })}
                    placeholder="your.email@example.com"
                    className={`${controlClass} ${errors.email ? errorControlClass : ""}`}
                  />
                  {errors.email && (
                    <p className={errorTextClass}>
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className={labelClass}>
                    Category
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(value) => setValue("category", value)}
                  >
                    <SelectTrigger id="category" className={controlClass}>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="bg-greyscale-purp-800 border-greyscale-purp-600 text-greyscale-blue-100">
                      {categoryOptions.map(({ value, label }) => (
                        <SelectItem
                          key={value}
                          value={value}
                          className="focus:bg-greyscale-purp-700 focus:text-greyscale-blue-50"
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className={labelClass}>
                    Subject <span className="text-error-red-400">*</span>
                  </Label>
                  <Input
                    id="subject"
                    {...register("subject", {
                      required: "Subject is required",
                      minLength: {
                        value: 3,
                        message: "Subject must be at least 3 characters",
                      },
                    })}
                    placeholder="What is this regarding?"
                    className={`${controlClass} ${errors.subject ? errorControlClass : ""}`}
                  />
                  {errors.subject && (
                    <p className={errorTextClass}>
                      {errors.subject.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className={labelClass}>
                    Message <span className="text-error-red-400">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    {...register("message", {
                      required: "Message is required",
                      minLength: {
                        value: 10,
                        message: "Message must be at least 10 characters",
                      },
                    })}
                    placeholder="Please provide details about your question or issue..."
                    rows={6}
                    className={`${controlClass} ${errors.message ? errorControlClass : ""}`}
                  />
                  {errors.message && (
                    <p className={errorTextClass}>
                      {errors.message.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-brand-primary hover:bg-purple-400 text-white font-brockmann-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Contact;
