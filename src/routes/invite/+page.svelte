<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabaseClient.js';

  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';
  let email = '';
  let accessToken = '';
  let refreshToken = '';

  onMount(async () => {
    // Debug: Log the full URL
    console.log('Full URL:', window.location.href);
    console.log('Hash:', window.location.hash);
    console.log('Search:', window.location.search);
    console.log('Pathname:', window.location.pathname);
    
    try {
      // Check if we have a current session (Supabase may have auto-logged in the user)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session:', session);
      console.log('Session error:', sessionError);
      
      if (session && session.user) {
        console.log('User found in session:', session.user.email);
        
        // Check if this is an invitation by looking at user metadata
        const isInvitation = session.user.email_confirmed_at === null || 
                           session.user.user_metadata?.invitation === true ||
                           session.user.app_metadata?.invitation === true;
        
        console.log('Is invitation:', isInvitation);
        console.log('User metadata:', session.user.user_metadata);
        console.log('App metadata:', session.user.app_metadata);
        
        // Always show password form for users on invitation page
        // Keep the session active so we can update the password
        email = session.user.email || '';
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
        
        console.log('User session active for password setup');
      } else {
        // No session - try to extract token from URL
        console.log('No session found, checking URL parameters');
        
        const hash = window.location.hash.substring(1);
        const search = window.location.search.substring(1);
        
        let token = '';
        let type = '';
        
        // Try hash first (after Supabase redirect)
        if (hash) {
          console.log('Checking hash params:', hash);
          const hashParams = new URLSearchParams(hash);
          
          // Check for errors first
          const errorParam = hashParams.get('error');
          const errorCode = hashParams.get('error_code');
          const errorDescription = hashParams.get('error_description');
          
          if (errorParam) {
            console.log('Error found in URL:', errorParam, errorCode, errorDescription);
            
            if (errorCode === 'otp_expired') {
              error = 'This invitation link has expired. Please request a new invitation.';
            } else if (errorParam === 'access_denied') {
              error = 'Access denied. Please request a new invitation.';
            } else {
              error = `Invitation error: ${errorDescription || errorParam}`;
            }
            return;
          }
          
          token = hashParams.get('access_token') || hashParams.get('token') || '';
          type = hashParams.get('type') || '';
          console.log('Hash - token:', token, 'type:', type);
        }
        
        // Try query params if no token found
        if (!token && search) {
          console.log('Checking search params:', search);
          const searchParams = new URLSearchParams(search);
          token = searchParams.get('token') || searchParams.get('access_token') || '';
          type = searchParams.get('type') || '';
          console.log('Search - token:', token, 'type:', type);
        }
        
        if (!token) {
          error = 'Invalid invitation link. No token found. Please request a new invitation.';
          return;
        }
        
        // Try to verify the token
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'invite'
        });

        if (verifyError) {
          console.error('Invitation verification error:', verifyError);
          error = 'Invalid or expired invitation link.';
          return;
        }

        if (data.user) {
          email = data.user.email || '';
          accessToken = token;
          
          // Sign out immediately to prevent auto-login
          await supabase.auth.signOut();
        } else {
          error = 'Invalid invitation data.';
        }
      }
    } catch (err) {
      error = 'Error processing invitation. Please try again.';
      console.error('Invitation error:', err);
    }
  });

  async function handleSubmit() {
    if (!password || !confirmPassword) {
      error = 'Please fill in all fields.';
      return;
    }

    if (password !== confirmPassword) {
      error = 'Passwords do not match.';
      return;
    }

    if (password.length < 6) {
      error = 'Password must be at least 6 characters long.';
      return;
    }

    loading = true;
    error = '';

    try {
      // User should already be authenticated from the invitation flow
      // Just update their password directly
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          password_set: true
        }
      });

      if (updateError) {
        error = updateError.message;
        return;
      }

      // Sign out to ensure they must log in with their new password
      await supabase.auth.signOut();

      // Show success message and redirect to login
      alert('Password set successfully! Please log in with your new password.');
      goto('/login');
    } catch (err) {
      error = 'Error setting password. Please try again.';
      console.error('Password update error:', err);
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Complete Your Invitation
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Set up your password to access the Saurer Siggi Inventory Manager
      </p>
    </div>

    {#if error}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    {/if}

    {#if email}
      <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
        Creating account for: <strong>{email}</strong>
      </div>
    {/if}

    <form class="mt-8 space-y-6" on:submit|preventDefault={handleSubmit}>
      <div class="space-y-4">
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            bind:value={password}
            class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Enter your password"
          />
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            bind:value={confirmPassword}
            class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Confirm your password"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading || !accessToken}
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if loading}
            <span class="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
            Creating Account...
          {:else}
            Create Account
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>