import { NextResponse } from 'next/server';

/**
 * API endpoint to clear demo mode flags
 * Visit /api/clear-demo to reset demo mode and return to using your real database
 * Auto-clears on page load for convenience
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
    .success { color: #16a34a; font-weight: 600; }
    .info { color: #0284c7; }
    .list { font-family: monospace; font-size: 12px; color: #666; margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 6px; max-height: 200px; overflow-y: auto; }
    .btn { background: #d97706; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; margin-top: 20px; }
    .btn:hover { background: #b45309; }
  </style>
</head>
<body>
  <h1>Clear Demo Mode</h1>
  <p id="status">Clearing demo mode data...</p>
  <div id="list" class="list"></div>
  <button class="btn" onclick="window.location.href='/today'">Go to Home</button>

  <script>
    // Auto-clear on page load
    (function() {
      // Clear all keys that start with dreamy_ or stride_
      const allKeys = Object.keys(localStorage);
      const keysToRemove = allKeys.filter(key =>
        key.startsWith('dreamy_') || key.startsWith('stride_')
      );

      const listEl = document.getElementById('list');
      let cleared = 0;

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        cleared++;
      });

      if (cleared > 0) {
        listEl.innerHTML = keysToRemove.map(k => '• ' + k).join('<br>');
        document.getElementById('status').innerHTML =
          '<span class="success">✓ Cleared ' + cleared + ' demo mode item(s).</span><br>' +
          '<span class="info">Your app will now use your real database data.</span>';
      } else {
        listEl.innerHTML = '<em>No demo keys found</em>';
        document.getElementById('status').innerHTML =
          '<span class="info">You were not in demo mode.</span>';
      }
    })();
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
