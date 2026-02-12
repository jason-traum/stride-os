'use client';

export default function StravaTestDirectPage() {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || '199902';

  // Test different redirect URI formats
  const tests = [
    {
      name: 'With www, HTTPS, full path',
      redirectUri: 'https://www.getdreamy.run/api/strava/callback',
    },
    {
      name: 'Without www, HTTPS, full path',
      redirectUri: 'https://getdreamy.run/api/strava/callback',
    },
    {
      name: 'Localhost format (for testing)',
      redirectUri: 'http://localhost:3000/api/strava/callback',
    },
    {
      name: 'Vercel app format',
      redirectUri: 'https://stride-os.vercel.app/api/strava/callback',
    }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Direct Strava OAuth Tests</h1>

      <div className="bg-yellow-100 p-4 rounded-lg">
        <p className="font-semibold">Try each link below to see which redirect URI works:</p>
        <p className="text-sm mt-2">The one that works is what you need in your Strava app settings!</p>
      </div>

      <div className="space-y-4">
        {tests.map((test, i) => {
          const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(test.redirectUri)}&response_type=code&scope=read,activity:read_all&approval_prompt=auto`;

          return (
            <div key={i} className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">{test.name}</h3>
              <code className="block bg-gray-100 p-2 rounded text-xs mb-3 break-all">
                {test.redirectUri}
              </code>
              <a
                href={authUrl}
                className="inline-block px-4 py-2 bg-[#FC4C02] text-white rounded hover:bg-[#E34402]"
                target="_blank"
                rel="noopener noreferrer"
              >
                Test This Redirect URI
              </a>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-100 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">What to do:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click each test button</li>
          <li>See which one gives you the Strava authorization page (not an error)</li>
          <li>That exact redirect URI needs to be in your Strava app</li>
          <li>In Strava app settings, the "Authorization Callback Domain" should be just the domain part</li>
        </ol>
      </div>
    </div>
  );
}