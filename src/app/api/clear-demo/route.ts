'use server';

import { NextResponse } from 'next/server';

/**
 * API endpoint to clear demo mode flags
 * Visit /api/clear-demo to reset demo mode and return to normal database mode
 */
export async function GET() {
  // Return a simple HTML page with JavaScript to clear localStorage
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Clear Demo Mode</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
    .success { color: green; }
    .btn { background: #d97706; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; }
    .btn:hover { background: #b45309; }
  </style>
</head>
<body>
  <h1>Clear Demo Mode</h1>
  <p>Click the button below to clear all demo mode data and return to using your real database.</p>
  <button class="btn" onclick="clearDemo()">Clear Demo Mode</button>
  <p id="status"></p>

  <script>
    function clearDemo() {
      const keysToRemove = [
        'dreamy_demo_mode',
        'dreamy_demo_settings',
        'dreamy_demo_workouts',
        'dreamy_demo_shoes',
        'dreamy_demo_races',
        'dreamy_demo_planned_workouts',
        'dreamy_demo_race_results',
        'dreamy_demo_injuries',
        'dreamy_demo_wardrobe',
        'dreamy_demo_outfit_feedback',
        'stride_active_profile',
        'stride_demo_overlay_1',
        'stride_demo_overlay_2',
      ];

      let cleared = 0;
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          cleared++;
        }
      });

      document.getElementById('status').innerHTML =
        '<p class="success">✓ Cleared ' + cleared + ' demo mode items.</p>' +
        '<p>Redirecting to home page...</p>';

      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    }
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
