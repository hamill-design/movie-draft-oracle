import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const EmailDiagnostic = () => {
  const [testEmail, setTestEmail] = useState('kinghograh@gmail.com');
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

  const testEmailDelivery = async () => {
    setTesting(true);
    try {
      console.log('🔍 EMAIL DIAGNOSTIC - Testing email:', testEmail);
      
      const testPayload = {
        draftId: 'test-draft-id',
        draftTitle: 'Email Delivery Test',
        hostName: 'Test Host',
        participantEmails: [testEmail],
        theme: 'Test Theme',
        option: 'Test Option',
      };

      console.log('🔍 EMAIL DIAGNOSTIC - Sending test payload:', testPayload);

      const response = await supabase.functions.invoke('send-draft-invitations', {
        body: testPayload
      });

      console.log('🔍 EMAIL DIAGNOSTIC - Full response:', response);
      setLastResult(response);

      if (response.error) {
        toast({
          title: "❌ Email Test Failed",
          description: `Error: ${response.error.message}`,
          variant: "destructive",
        });
      } else if (response.data) {
        const result = response.data;
        console.log('🔍 EMAIL DIAGNOSTIC - Response data:', result);
        
        if (result.invitations && result.invitations.length > 0) {
          const emailResult = result.invitations[0];
          toast({
            title: "📧 Email Test Result",
            description: `Status: ${emailResult.status} ${emailResult.error ? `- ${emailResult.error}` : ''}`,
          });
        }
      }
    } catch (error) {
      console.error('🔍 EMAIL DIAGNOSTIC - Exception:', error);
      toast({
        title: "❌ Test Error",
        description: `Exception: ${error}`,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4">
      <CardHeader>
        <CardTitle>📧 Email Delivery Diagnostic</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter email to test"
            className="flex-1"
          />
          <Button 
            onClick={testEmailDelivery}
            disabled={testing}
            className="min-w-[100px]"
          >
            {testing ? 'Testing...' : 'Test Email'}
          </Button>
        </div>

        {lastResult && (
          <div className="space-y-2">
            <h4 className="font-semibold">Last Test Result:</h4>
            
            {lastResult.error && (
              <Badge variant="destructive">
                Error: {lastResult.error.message}
              </Badge>
            )}
            
            {lastResult.data && (
              <div className="bg-muted p-3 rounded text-sm">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(lastResult.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p><strong>Debugging Steps:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Check if the email address is valid</li>
            <li>Verify Resend API key is configured</li>
            <li>Check if emails are going to spam folder</li>
            <li>Verify the email domain accepts emails from resend.dev</li>
            <li>Check console logs for detailed debugging info</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailDiagnostic;