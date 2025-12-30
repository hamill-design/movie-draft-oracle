/**
 * Google Apps Script to forward support emails to Supabase Edge Function
 * 
 * Setup Instructions:
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Paste this code
 * 4. Replace YOUR_WEBHOOK_URL with your actual Edge Function URL
 * 5. Set up a trigger to run this function when emails arrive
 * 
 * Edge Function URL: https://zduruulowyopdstihfwk.supabase.co/functions/v1/receive-support-email
 */

// Your Supabase Edge Function URL
const WEBHOOK_URL = 'https://zduruulowyopdstihfwk.supabase.co/functions/v1/receive-support-email';

/**
 * Main function to process new emails
 * This should be triggered when new emails arrive in support@moviedrafter.com
 */
function processSupportEmails() {
  try {
    // Search for unread emails sent to support@moviedrafter.com
    const threads = GmailApp.search('to:support@moviedrafter.com is:unread', 0, 10);
    
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const messages = thread.getMessages();
      
      for (let j = 0; j < messages.length; j++) {
        const message = messages[j];
        
        // Only process unread messages
        if (message.isUnread()) {
          forwardEmailToWebhook(message);
          // Mark as read after processing
          message.markRead();
        }
      }
    }
  } catch (error) {
    console.error('Error processing emails:', error);
    // You can also send yourself an email notification here
    GmailApp.sendEmail(
      Session.getActiveUser().getEmail(),
      'Support Email Forwarder Error',
      'An error occurred: ' + error.toString()
    );
  }
}

/**
 * Forward a Gmail message to the webhook
 */
function forwardEmailToWebhook(message) {
  try {
    const from = message.getFrom();
    const to = message.getTo();
    const subject = message.getSubject();
    const plainBody = message.getPlainBody();
    const htmlBody = message.getBody();
    const date = message.getDate().toISOString();
    
    // Prepare the payload
    const payload = {
      from: from,
      to: to.split(',').map(email => email.trim()),
      subject: subject,
      text: plainBody,
      html: htmlBody,
      created_at: date,
      date: date
    };
    
    // Send to webhook
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode === 200) {
      console.log('Email forwarded successfully:', subject);
    } else {
      console.error('Error forwarding email:', responseCode, responseText);
      // Optionally send yourself an error notification
      GmailApp.sendEmail(
        Session.getActiveUser().getEmail(),
        'Support Email Forwarder - Webhook Error',
        'Failed to forward email: ' + subject + '\n\nError: ' + responseText
      );
    }
  } catch (error) {
    console.error('Error in forwardEmailToWebhook:', error);
    throw error;
  }
}

/**
 * Set up a time-driven trigger to check for new emails every 5 minutes
 * Run this function once to set up the trigger
 */
function setupTrigger() {
  // Delete existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processSupportEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create a new trigger that runs every 5 minutes
  ScriptApp.newTrigger('processSupportEmails')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  console.log('Trigger set up successfully!');
}

/**
 * Alternative: Set up a Gmail filter-based trigger
 * This requires the Gmail API to be enabled and is more complex
 * For now, the time-based trigger is simpler
 */

