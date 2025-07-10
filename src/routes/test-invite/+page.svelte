<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';
  let email = 'test@example.com'; // Fake email for testing
  let showPasswordForm = false;

  onMount(() => {
    // Simulate processing invitation
    setTimeout(() => {
      showPasswordForm = true;
    }, 1000);
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate success
      alert('Account created successfully! Please log in with your new password.');
      goto('/login');
    } catch (err) {
      error = 'Error creating account. Please try again.';
      console.error('Account creation error:', err);
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
      <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p class="text-sm text-yellow-800">
          🧪 <strong>Test Mode:</strong> This is a test invitation page for development purposes
        </p>
      </div>
    </div>

    {#if error}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    {/if}

    {#if !showPasswordForm}
      <div class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
        <div class="flex items-center">
          <svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing invitation...
        </div>
      </div>
    {/if}

    {#if showPasswordForm}
      <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
        Creating account for: <strong>{email}</strong>
      </div>

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
            disabled={loading}
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

      <div class="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 class="font-medium text-gray-900 mb-2">Testing Notes:</h3>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>• This simulates the real invitation flow</li>
          <li>• Form validation works the same way</li>
          <li>• After "success", redirects to login page</li>
          <li>• No actual account is created in test mode</li>
        </ul>
      </div>
    {/if}
  </div>
</div>