import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ContactModal = ({ open, onOpenChange }: ContactModalProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>();

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    
    try {
      // Format the message to include name
      const formattedMessage = `From: ${data.name} (${data.email})\n\n${data.message}`;
      const formattedHtml = `<p><strong>From:</strong> ${data.name} (${data.email})</p><hr/><p>${data.message.replace(/\n/g, '<br/>')}</p>`;
      
      // Prepare payload matching Edge Function format
      const payload = {
        from: data.email,
        to: ['support@moviedrafter.com'],
        subject: data.subject,
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
        
        // Reset form and close modal
        reset({
          name: "",
          email: "",
          subject: "",
          message: "",
        });
        onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-greyscale-purp-850 border-greyscale-purp-700 text-greyscale-blue-100 [&>button]:text-greyscale-blue-200 [&>button]:hover:text-greyscale-blue-100 [&>button]:hover:bg-greyscale-purp-800">
        <DialogHeader>
          <DialogTitle className="text-3xl text-greyscale-blue-100 font-brockmann-semibold">
            Contact Support
          </DialogTitle>
          <DialogDescription className="text-greyscale-blue-300 font-brockmann">
            Have a question or need help? Send us a message and we'll get back to you as soon as possible.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-greyscale-blue-200">
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
              className={`bg-greyscale-purp-800 border-greyscale-purp-600 text-greyscale-blue-100 placeholder:text-greyscale-purp-400 focus:border-greyscale-blue-100 focus:ring-0 ${
                errors.name ? "border-error-red-500" : ""
              }`}
            />
            {errors.name && (
              <p className="text-sm text-error-red-400 font-brockmann">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-greyscale-blue-200">
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
              className={`bg-greyscale-purp-800 border-greyscale-purp-600 text-greyscale-blue-100 placeholder:text-greyscale-purp-400 focus:border-greyscale-blue-100 focus:ring-0 ${
                errors.email ? "border-error-red-500" : ""
              }`}
            />
            {errors.email && (
              <p className="text-sm text-error-red-400 font-brockmann">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject" className="text-greyscale-blue-200">
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
              className={`bg-greyscale-purp-800 border-greyscale-purp-600 text-greyscale-blue-100 placeholder:text-greyscale-purp-400 focus:border-greyscale-blue-100 focus:ring-0 ${
                errors.subject ? "border-error-red-500" : ""
              }`}
            />
            {errors.subject && (
              <p className="text-sm text-error-red-400 font-brockmann">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-greyscale-blue-200">
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
              className={`bg-greyscale-purp-800 border-greyscale-purp-600 text-greyscale-blue-100 placeholder:text-greyscale-purp-400 focus:border-greyscale-blue-100 focus:ring-0 ${
                errors.message ? "border-error-red-500" : ""
              }`}
            />
            {errors.message && (
              <p className="text-sm text-error-red-400 font-brockmann">
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
      </DialogContent>
    </Dialog>
  );
};

export default ContactModal;

