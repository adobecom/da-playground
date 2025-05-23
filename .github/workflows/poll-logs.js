// node --env-file=.env .github/workflows/poll-logs.js (node >= 21)

const { env, exit } = process;

const fetchRequest = function(purl) {
  return fetch(purl, {
    method: 'GET',
    headers: {
      'Authorization': `token ${env.AEM_LIVE_ADMIN_TOKEN}`
    },
  });
};

/**
 * Fetches logs for a specific site and saves them to a file.
 * @param {string} siteName - The name of the site (e.g., 'da-bacom', 'bacom'). Used for the filename.
 * @param {string} baseUrl - The base URL for the log endpoint (e.g., 'https://admin.hlx.page/log/adobecom/da-bacom/main').
 */
async function fetchLogsForSite(siteName, baseUrl, fromParam) {
  console.log(`Fetching logs for site: ${siteName} from ${baseUrl}...`);

  const initialUrl = `${baseUrl}?from=${fromParam}`;
  const entries = [];
  let totalFetched = 0;

  try {
    let nextUrl = initialUrl;
    let requestCount = 0;
    const maxRequests = 1000; // Safety break

    while (nextUrl && requestCount < maxRequests) {
      requestCount++;
      console.log(`Fetching page ${requestCount} for ${siteName}: ${nextUrl}`);
      const request = await fetchRequest(nextUrl);

      if (!request.ok) {
          console.error(`Error fetching logs for ${siteName}: ${request.status} ${request.statusText}`);
          const errorBody = await request.text();
          console.error(`Response body: ${errorBody}`);
          throw new Error(`Failed to fetch logs: ${request.status}`);
      }

      const json = await request.json();

      if (json.entries && json.entries.length > 0) {
         entries.push(...json.entries);
         totalFetched += json.entries.length;
         console.log(`Fetched ${json.entries.length} entries for ${siteName}. Total: ${totalFetched}`);
      } else {
         console.log(`No new entries found on page ${requestCount} for ${siteName}.`);
      }

      nextUrl = json.links?.next;
       if (!nextUrl) {
           console.log(`No more pages found for ${siteName}.`);
           break;
       }
    }

    if (requestCount >= maxRequests) {
        console.warn(`Warning: Reached maximum request limit (${maxRequests}) for ${siteName}. Log data might be incomplete.`);
    }

    return entries
  } catch (err) {
    console.error(`Error fetching or writing logs for site ${siteName}:`, err);
    throw err; // Re-throw error
  }
}

async function main() {
  // Check for required secrets
  if (!env.AEM_LIVE_ADMIN_TOKEN) {
    console.error('::error::The AEM_LIVE_ADMIN_TOKEN secret is not configured. Please add this secret to your repository settings.');
    exit(1);
  }

  function getYesterdayISOString() {
    const now = new Date();
    now.setDate(now.getDate() - 1); // Subtract one day
    now.setHours(0, 0, 0, 0); // Set to midnight
    return now.toISOString();
  }

  // Required env vars
  const ORG = env.ORG;
  const REPO = env.REPO;
  const ROUTE_FILTER = env.ROUTE_FILTER || 'live';
  const ADD_MD_SUFFIX = env.ADD_MD_SUFFIX === 'true';
  const REPOSITORY_DISPATCH_EVENT = env.REPOSITORY_DISPATCH_EVENT;
  const LAST_RUN_ISO = env.LAST_RUN_ISO || getYesterdayISOString(); // Should be set by workflow
  const GH_TOKEN = env.GITHUB_TOKEN;

  if (!ORG || !REPO || !LAST_RUN_ISO) {
    console.error('Missing required environment variables (ORG, REPO, LAST_RUN_ISO)');
    exit(1);
  }

  // URL encode the from parameter
  const FROM_PARAM = env.LOCAL_RUN ? getYesterdayISOString() : encodeURIComponent(LAST_RUN_ISO);

  // Fetch logs
  const entries = await fetchLogsForSite(REPO, `https://admin.hlx.page/log/${ORG}/${REPO}`, FROM_PARAM);
  if (!entries.length) {
    console.log('No log entries found.');
    return;
  }
  // TOOD
  // Filter and sort logs
  const logs = entries
    .filter(entry => entry.route === ROUTE_FILTER)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  console.log(`Debug: Found ${logs.length} log entries after filtering.`);

  for (const log of logs) {
    const user = log.user || 'unknown';
    const status = log.status;
    const timestamp = log.timestamp;
    // Combine path and paths, filter out empty strings
    const paths = [log.path, ...(Array.isArray(log.paths) ? log.paths : [])].filter(Boolean);
    for (let path of paths) {
      if (ADD_MD_SUFFIX && !path.includes('.')) {
        path = `${path}.md`;
      }
      // Trigger repository dispatch
      const payload = {
        event_type: REPOSITORY_DISPATCH_EVENT,
        client_payload: { path, user, timestamp, status },
      };
      const dispatchUrl = `https://api.github.com/repos/${ORG}/${REPO}/dispatches`;
      console.log(`Triggering dispatch for ${path} with event type: ${REPOSITORY_DISPATCH_EVENT}`);
      if(!env.LOCAL_RUN) {
        console.log("ah")
        await fetch(dispatchUrl, {
          method: 'POST',
          headers: {
            'Authorization': `token ${GH_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }
    }
  }
}

main().catch(e => { console.error(e); exit(1); });
