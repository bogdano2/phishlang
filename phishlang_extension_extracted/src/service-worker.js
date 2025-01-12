// Initialize check results map
const urlCheckResults = new Map();

// Listen for install event
chrome.runtime.onInstalled.addListener(() => {
	console.log('Extension installed');
	// Set default OpenAI key on install
	chrome.storage.local.set({
		openAiKey: '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'
	});
});

// Listen for tab updates to check URLs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        checkDomain(tab.url).then(() => {
            const result = urlCheckResults.get(tab.url);
            if (result && result.status === 'phishing') {
                handlePhishingSite(tab.url, result.reasons);
            }
        }).catch(error => {
            console.error('Error checking domain:', error);
        });
    }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log('Received message:', message);

	switch (message.action) {
		case 'getCheckResult': {
			const domain = message.domain;
			if (!domain) {
				sendResponse({ phish: 'error', error: 'No domain provided' });
				return true;
			}

			const result = urlCheckResults.get(domain);
			if (!result) {
				// If no result is found, start a check and respond with checking status
				checkDomain(domain).then(() => {
					const updatedResult = urlCheckResults.get(domain);
					console.log('Check result:', updatedResult);
					if (updatedResult && updatedResult.status === 'phishing') {
						handlePhishingSite(domain, updatedResult.reasons);
					}
				}).catch(error => {
					console.error('Error in checkDomain:', error);
					urlCheckResults.set(domain, { status: 'error' });
				});
				sendResponse({ phish: 'checking' });
			} else if (result.status === 'phishing') {
				handlePhishingSite(domain, result.reasons);
				sendResponse({ phish: result.status });
			} else {
				sendResponse({ phish: result.status });
			}
			return true;
		}
	}
	return true;
});

// Function to handle phishing site detection
function handlePhishingSite(domain, reasons = []) {
	console.log('Handling phishing site:', domain, 'reasons:', reasons);
	chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
		const currentTab = tabs[0];
		if (currentTab && currentTab.id) {
			const warningUrl = chrome.runtime.getURL('public/phishing.html');
			const params = new URLSearchParams({
				url: currentTab.url,
				reasons: JSON.stringify(reasons)
			});
			const redirectUrl = `${warningUrl}?${params.toString()}`;
			console.log('Redirecting to:', redirectUrl);
			chrome.tabs.update(currentTab.id, { url: redirectUrl });
		}
	});
}

// Function to check a domain
async function checkDomain(domain) {
	try {
		// Get the OpenAI key from storage
		const result = await chrome.storage.local.get(['openAiKey']);
		const openAiKey = result.openAiKey;

		if (!openAiKey) {
			console.error('No API key found');
			urlCheckResults.set(domain, { status: 'error' });
			return;
		}

		// Format the URL properly
		const url = domain.startsWith('http') ? domain : `http://${domain}`;
		console.log('Checking URL:', url);

		// Make the API call to the correct port (5024)
		const response = await fetch('http://localhost:5024/check_url', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${openAiKey}`
			},
			body: JSON.stringify({ url })
		});

		if (!response.ok) {
			console.error('API Error:', response.status);
			const errorData = await response.json().catch(() => ({}));
			console.error('Error details:', errorData);
			urlCheckResults.set(domain, { status: 'error' });
			return;
		}

		const data = await response.json();
		console.log('API response:', data);
		urlCheckResults.set(domain, {
			status: data.status || 'safe',
			reasons: data.reasons || []
		});

	} catch (error) {
		console.error('Error checking domain:', error);
		urlCheckResults.set(domain, { status: 'error' });
	}
}
