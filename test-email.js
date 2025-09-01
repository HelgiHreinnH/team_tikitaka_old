// Test script to send email - run this in browser console or as a Node script

const testEmail = async () => {
  try {
    const response = await fetch('https://rifwpmohngsieuyhfjwx.supabase.co/functions/v1/send-test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZndwbW9obmdzaWV1eWhmand4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NDUwMDYsImV4cCI6MjA3MTQyMTAwNn0.46_PH20wJhyWlOUNEsvqOTmgVXFOPoE6ASZahoI_2Dw'
      },
      body: JSON.stringify({
        email: 'helgihreinn@me.com'
      })
    });

    const result = await response.json();
    console.log('Email test result:', result);
    return result;
  } catch (error) {
    console.error('Error sending test email:', error);
    return { error: error.message };
  }
};

// Call the function
testEmail();