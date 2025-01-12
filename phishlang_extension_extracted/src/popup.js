import { onPhishStatusAsync } from './utils.js';

/**
 * @param {Element|string} elementOrId
 * @param {string} text
 * @returns {void}
 */
function setElementText(elementOrId, text) {
	const element = typeof elementOrId === 'string'
		? document.getElementById(elementOrId)
		: elementOrId;
	element.textContent = text;
}

/**
 * @param {string} text
 * @param {string} [textFallback='N/A']
 * @returns {string}
 */
function stringOrNone(text, textFallback = 'N/A') {
	return text === ''
		? textFallback
		: text
}

/**
 * @param {URLSearchParams} params
 * @returns void
 */
function setSearchParams(params) {
	const parent = document.getElementById('uri-searchparams');
	if (params.size === 0) {
		const noneFound = document.createElement('p');
		noneFound.className = 'text-zinc-300';
		noneFound.textContent = 'No search params found';
		parent.appendChild(noneFound);
		return
	}

	const dlElement = document.createElement('dl');
	dlElement.className = 'grid grid-cols-2 gap-x-1 gap-y-2';
	for (const [key, value] of params.entries()) {
		// create container element
		const container = document.createElement('div');
		container.className = 'flex flex-col';

		// create key element
		const keyElement = document.createElement('dt');
		keyElement.textContent = key;

		// create value element
		const valueElement = document.createElement('dd');
		valueElement.setAttribute('title', value);
		valueElement.className = 'text-zinc-300 truncate font-mono';
		valueElement.textContent = value;

		// attach key+value elements to container,
		// then attach key-value container to parent
		container.appendChild(keyElement);
		container.appendChild(valueElement);
		dlElement.append(container);
	}
	parent.appendChild(dlElement);
}

/**
 * Remove CSS classes for an element that match a given predicate pattern
 * @param {Element} element
 * @param {(s: string) => boolean} predicate
 * @returns {void}
 */
function classRemoveBy(element, predicate) {
	const classList = element.classList;

	// not very safe to remove while iterating, do it after
	/** @type string[] */
	const candidates = [];
	classList.forEach((classToken) => {
		if (predicate(classToken)) {
			candidates.push(classToken);
		}
	});
	candidates.forEach(c => classList.remove(c));
}

/**
 * @param {HTMLElement} element
 * @param {string} prefix
 * @param {string} newClass
 */
function toggleTwClass(element, prefix, newClass) {
	classRemoveBy(element, s => s.startsWith(prefix));
	element.classList.add(newClass);
}

document.addEventListener('DOMContentLoaded', async () => {
	// Get the current tab URL
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	let url, domain;
	
	try {
		url = new URL(tab.url);
		domain = url.hostname;
	} catch (e) {
		console.error('Error parsing URL:', e);
		const statusElement = document.getElementById('status');
		const warningElement = document.getElementById('warning');
		setElementText(statusElement, 'Error');
		setElementText(warningElement, 'Unable to analyze this page. Please try a different page.');
		return;
	}

	// Initialize user settings
	const openAiKeySection = document.getElementById('openai-key-section');
	const openAiKeyInput = document.getElementById('openai-key-input');
	const checkboxBlocklist = document.getElementById('checkbox-blocklist');

	// Load saved API key and hide the section by default
	chrome.storage.local.get(['openAiKey', 'showBlocklist'], (result) => {
		if (result.openAiKey) {
			openAiKeyInput.value = result.openAiKey;
		}
		
		// Always keep the section hidden initially
		openAiKeySection.classList.remove('flex');
		openAiKeySection.classList.add('hidden');
		
		// Set checkbox state but don't show the key section
		checkboxBlocklist.checked = result.showBlocklist || false;
	});

	// Save API key when changed
	openAiKeyInput.addEventListener('change', () => {
		chrome.storage.local.set({ openAiKey: openAiKeyInput.value });
	});

	// Keep the API key section hidden even when checkbox changes
	checkboxBlocklist.addEventListener('change', () => {
		chrome.storage.local.set({ showBlocklist: checkboxBlocklist.checked });
		// Always keep the section hidden
		openAiKeySection.classList.remove('flex');
		openAiKeySection.classList.add('hidden');
	});

	// Check phishing status
	try {
		const warningElementTwStyles = 'text-left p-4 pb-2';
		const warningElement = document.getElementById('warning');
		const statusElement = document.getElementById('status');
		const popupHeader = document.getElementById('popup-header');

		if (!url || url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
			setElementText(statusElement, 'Special Page');
			setElementText(warningElement, 'This is a special browser page that cannot be analyzed.');
			warningElement.className = warningElementTwStyles;
			return;
		}

		// Set initial state
		setElementText(statusElement, 'Checking...');
		setElementText(warningElement, '');
		warningElement.className = '';
		toggleTwClass(popupHeader, 'bg-', 'bg-blue-700');

		// Request check result
		chrome.runtime.sendMessage({ action: 'getCheckResult', domain }, async (response) => {
			try {
				if (!response) {
					return; // Keep showing "Checking..." state
				}

				const phishStatus = response.phish || 'checking';
				
				if (phishStatus === 'phishing') {
					// Let the service worker handle the redirect
					return;
				}

				await onPhishStatusAsync(phishStatus, {
					onPhishing: async () => {
						setElementText(statusElement, 'Unsafe');
						setElementText(warningElement, 'This website has been detected as dangerous by Maverick Safe AI. Please do not access this website or share any personal information.');
						warningElement.className = warningElementTwStyles;
						toggleTwClass(popupHeader, 'bg-', 'bg-red-500');
					},
					onSuspicious: async () => {
						setElementText(statusElement, 'Suspicious');
						setElementText(warningElement, 'This website looks suspicious. Please take caution when entering any information on this website.');
						warningElement.className = warningElementTwStyles;
						toggleTwClass(popupHeader, 'bg-', 'bg-orange-500');
					},
					onSafe: async () => {
						setElementText(statusElement, 'Safe');
						setElementText(warningElement, '');
						warningElement.className = '';
						toggleTwClass(popupHeader, 'bg-', 'bg-blue-700');

						const statusContainer = document.getElementById('website-status');
						const existingReport = statusContainer.querySelector('.report-section');
						if (!existingReport) {
							const reportParent = document.createElement('div');
							reportParent.className = 'mt-4 flex flex-row gap-2 items-start text-left justify-between report-section';

							let reportText = document.createElement('div');
							reportText.textContent = 'Does this website not seem safe? Let us know by reporting it.';
							reportParent.appendChild(reportText);

							const reportButton = document.createElement('div');
							reportButton.className = 'inline-flex bg-red-500 rounded-md px-4 py-2 font-medium text-white';
							reportButton.textContent = 'Report';
							reportButton.addEventListener('click', async () => {
								reportButton.textContent = 'Website reported';
								reportText.textContent = 'Thank you for reporting.';
							});

							reportParent.appendChild(reportButton);
							statusContainer.appendChild(reportParent);
						}
					},
					onDefault: async () => {
						setElementText(statusElement, 'Checking...');
						setElementText(warningElement, '');
						warningElement.className = '';
						toggleTwClass(popupHeader, 'bg-', 'bg-blue-700');
					},
				});
			} catch (error) {
				console.error('Error handling phish status:', error);
				setElementText(statusElement, 'Error');
				setElementText(warningElement, 'There was an error checking this website. Please try again later.');
				warningElement.className = warningElementTwStyles;
				toggleTwClass(popupHeader, 'bg-', 'bg-gray-700');
			}
		});
	} catch (error) {
		console.error('Error in popup initialization:', error);
		const statusElement = document.getElementById('status');
		const warningElement = document.getElementById('warning');
		setElementText(statusElement, 'Error');
		setElementText(warningElement, 'An unexpected error occurred. Please try again later.');
	}
});
